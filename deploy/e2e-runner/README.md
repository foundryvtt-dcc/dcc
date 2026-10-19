# Self-hosted E2E runner

A single, permanent GitHub Actions runner that runs the Playwright E2E suite
(`browser-tests/e2e/`) against a real Foundry v14 server for every PR,
contributor PRs included. It runs on a Coolify host as one Docker container.
Jobs queue and run one at a time.

## How a PR gets tested

```
PR opened / pushed
  └─ e2e-gate.yml   (GitHub-hosted, pull_request_target, never runs PR code)
       ├─ member/collaborator branch in this repo ──────────────┐
       ├─ maintainer adds the `e2e-approved` label ─────────────┤
       └─ anyone else → Claude reads the diff                   │
            ├─ approve ─────────────────────────────────────────┤
            ├─ needs_human → status "Needs a maintainer"        │
            └─ reject      → status failure + PR comment        │
                                                                ▼
                         e2e.yml (workflow_dispatch, runs from main)
                           start  (GitHub-hosted): PR head still == approved SHA?
                           e2e    (this runner):   checkout SHA, pnpm install,
                                                   pnpm run e2e:env test
                           report (GitHub-hosted): commit status + artifacts
```

Results show up on the PR as the **E2E (self-hosted)** commit status, with the
Playwright HTML report and the Foundry log attached to the run.

**Why the gate exists:** a job runs whatever the PR contains: `pnpm install`
lifecycle scripts, the Node-side specs, and system code in Chromium. This box
holds the Foundry license and the paid `dcc-core-book` module, and both are
readable by the job. The gate makes sure someone (Claude or a maintainer) has
read the code before it runs.

- `.github/scripts/e2e-triage.mjs` routes anything touching runner tooling,
  dependencies or lockfiles, and any symlink or submodule, to a human no
  matter what Claude says.
- Claude runs as the Claude Code CLI in `--restricted` mode with only
  Read/Grep/Glob. It loads no settings files, hooks or MCP servers. It reads
  the diff and the changed files from a scratch directory. Its answer is
  schema-constrained, and anything else fails closed to `needs_human`.
- The prompt (`.github/prompts/e2e-triage.md`) treats any text in the PR that
  addresses the reviewer as grounds to reject.
- An approval is tied to one commit. A new push removes `e2e-approved` and goes
  through the gate again. `e2e.yml` refuses to run if the PR's head has moved
  on from the approved SHA.

**Container hardening:** read-only root filesystem, `/work` wiped before every
job, Foundry and dcc-core-book in a root-owned cache that jobs can't modify, ephemeral runner registration (one job per registration), no sudo,
dropped capabilities, and a job environment with no credentials. The
registration PAT stays in the root phase of the entrypoint.

## One-time setup

### 1. Where Foundry, the license and dcc-core-book come from

Nothing is copied to the host by hand:

- **Foundry and the license** come from your existing **felddy/foundryvtt**
  container. It already uses your foundryvtt.com login (set in Coolify) to
  download the Foundry zip into `/data/container_cache` and to write
  `/data/Config/license.json`. The runner mounts that directory **read-only**,
  unpacks the newest cached zip into its own cache volume (once per version)
  and copies the license into each job. Your Foundry credentials never reach
  the runner.
- **dcc-core-book** is cloned from GitHub when the container starts and
  compiled (`pnpm install` + `pnpm run todb`) only when `main` has moved. The
  compiled module lives in the root-owned cache volume, so jobs can read it
  but can't change it.

Find the host directory felddy mounts at `/data` (Coolify services use a
bind mount, e.g. `/data/foundryvtte2e`):

```bash
docker inspect <felddy-container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
```

Check that its download cache is populated (`CONTAINER_CACHE` is on by
default in felddy):

```bash
ls <path>/container_cache <path>/Config
```

### 2. Personal access token

Create a **fine-grained personal access token** with:

- Resource owner `foundryvtt-dcc`, repository access limited to `dcc` and
  `dcc-core-book`
- Repository permissions: **Administration: Read and write** (to mint runner
  registration tokens for `dcc`) and **Contents: Read** (to clone
  `dcc-core-book`)

Only the entrypoint's root phase uses it, before it drops to the job user.
Set a calendar reminder for its expiry.

### 3. Coolify resource

1. **New Resource → Docker Compose**, source: the `foundryvtt-dcc/dcc` repo,
   branch `main`, base directory `/deploy/e2e-runner`, compose file
   `docker-compose.yml`.
2. Environment variables: `GH_RUNNER_PAT` (secret) and `FELDDY_DATA_PATH`
   (e.g. `/data/foundryvtte2e`).
   Optionally set `RUNNER_NAME`, and `FOUNDRY_VERSION` to pin a specific
   cached build (e.g. `14.369`) instead of the newest one.
3. Deploy. **Settings → Actions → Runners** on the repo should show the runner
   as *Idle* with the `dcc-e2e` label.

The first start takes a few minutes: it unpacks Foundry and installs and
compiles dcc-core-book. Later restarts (one per job) take seconds unless
something changed. The host needs about 4 GB RAM free for Foundry plus headless Chromium, and a
few GB of disk for the work volume. Both amd64 and arm64 hosts work.

### 4. GitHub repository settings

- **Secret** `CLAUDE_CODE_OAUTH_TOKEN`: from `claude setup-token`, same as the
  credit-cards pipeline. To bill an API key instead, add `ANTHROPIC_API_KEY`
  and set the variable `CLAUDE_AUTH_MODE=api`.
- **Label** `e2e-approved`: `gh label create e2e-approved --color 0E8A16 --description "Maintainer approval to run E2E on the self-hosted runner"`
- Optional variables: `E2E_TRIAGE_MODEL` (default `claude-opus-5-5`) and
  `E2E_TRIAGE_EFFORT` (default `high`).
- Optional: make **E2E (self-hosted)** a required status check on `main` once
  it has proven stable.

### 5. First run

Dispatch a run by hand against an open PR from the Actions tab
(**E2E (self-hosted) → Run workflow**) with the PR number and its full head
SHA. Or run `gh workflow run e2e.yml -f pr=<n> -f sha=<sha>`.

Things that may need attention on the first Linux run:

- Foundry's "hardware acceleration" banner. The runner has no GPU, so
  Chromium renders WebGL with SwiftShader (see the Linux launch flags in
  `playwright.config.js`). Specs that click near the top of the screen may
  need the notification hygiene `extension-api.spec.js` already does.
- Load-sensitive specs (see the flake notes in `docs/dev/TESTING.md`) are
  more likely to flake on CPU-only rendering. CI runs with two retries.

## Maintenance

| What | When | How |
|------|------|-----|
| Runner version | Monthly, or when GitHub warns the runner is outdated | Bump the `FROM` tag in `Dockerfile`, redeploy |
| Playwright | When `@playwright/test` changes in the lockfile | Bump `PLAYWRIGHT_VERSION` in `Dockerfile` to match, redeploy. Until then the e2e job fails with "Executable doesn't exist" |
| Foundry | When felddy updates | Nothing, unless `FOUNDRY_VERSION` is pinned: the runner picks up the newest zip in felddy's cache on its next restart |
| dcc-core-book | When the module changes | Nothing: recompiled automatically when `main` moves |
| PAT | Before expiry | New token → update `GH_RUNNER_PAT` in Coolify → restart |
| Claude token | If triage starts reporting "Claude run failed" | Re-run `claude setup-token`, update the secret |

## Optional: restrict outbound network

The gate is the main control. If you want a backstop in case a malicious
change ever gets through it, restrict the container's egress to the hosts a
job actually needs: `github.com`, `api.github.com`, `*.actions.githubusercontent.com`,
`codeload.github.com`, `objects.githubusercontent.com`,
`results-receiver.actions.githubusercontent.com`, `*.blob.core.windows.net`
(artifacts), `registry.npmjs.org` and `npm.pkg.github.com`. A Squid sidecar
on an internal Docker network, with `HTTPS_PROXY` set for the runner, is the
usual way to do this. The entrypoint would then need to pass the proxy
variables through to `as_runner`.
