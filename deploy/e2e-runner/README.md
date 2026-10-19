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
job, ephemeral runner registration (one job per registration), no sudo,
dropped capabilities, and a job environment with no credentials. The
registration PAT stays in the root phase of the entrypoint.

## One-time setup

### 1. Files on the Coolify host

The container mounts two host directories read-only. Defaults are below;
override them with `FOUNDRY_INSTALL_DIR` / `FOUNDRY_USERDATA_DIR` in Coolify.

```
/srv/dcc-e2e/foundryvtt/                     Foundry v14 "Node.js" build (main.js, package.json, …)
/srv/dcc-e2e/userdata/Config/license.json    a signed license.json
/srv/dcc-e2e/userdata/Data/modules/dcc-core-book/   module with COMPILED packs
```

From the Mac, with the live install as the source:

```bash
HOST=coolify-box   # ssh alias
ssh $HOST 'sudo mkdir -p /srv/dcc-e2e/userdata/Config /srv/dcc-e2e/userdata/Data/modules && sudo chown -R $USER /srv/dcc-e2e'
rsync -a --delete ~/Applications/foundry-14/ $HOST:/srv/dcc-e2e/foundryvtt/
rsync -a ~/FoundryVTT-Next/Config/license.json $HOST:/srv/dcc-e2e/userdata/Config/
rsync -a --delete ~/FoundryVTT-Next/Data/modules/dcc-core-book/ $HOST:/srv/dcc-e2e/userdata/Data/modules/dcc-core-book/
# The container's `runner` user is uid 1001 and needs read access
ssh $HOST 'sudo chown -R 1001:1001 /srv/dcc-e2e && sudo chmod -R go-rwx /srv/dcc-e2e'
```

The Foundry Node.js build is platform-independent, so the Mac copy works on
Linux. You can also download the Linux/Node.js zip from foundryvtt.com. Make
sure `dcc-core-book` has its LevelDB packs compiled (`npm run todb` in the
module); the compiled files are gitignored.

### 2. Registration token

Create a **fine-grained personal access token** with:

- Resource owner `foundryvtt-dcc`, repository access limited to `dcc`
- Repository permissions: **Administration: Read and write** (needed to mint
  runner registration tokens; nothing else)

It's used only by the entrypoint's root phase to fetch a one-hour
registration token on each restart. Set a calendar reminder for its expiry.

### 3. Coolify resource

1. **New Resource → Docker Compose**, source: the `foundryvtt-dcc/dcc` repo,
   branch `main`, base directory `/deploy/e2e-runner`, compose file
   `docker-compose.yml`.
2. Environment variables: `GH_RUNNER_PAT` (secret). Optionally set
   `RUNNER_NAME`, `FOUNDRY_INSTALL_DIR` and `FOUNDRY_USERDATA_DIR`.
3. Deploy. **Settings → Actions → Runners** on the repo should show the runner
   as *Idle* with the `dcc-e2e` label.

The host needs about 4 GB RAM free for Foundry plus headless Chromium, and a
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
| Foundry | After a Foundry update you want CI to test against | Re-rsync `/srv/dcc-e2e/foundryvtt` (and the license if re-signed) |
| dcc-core-book | When the module changes | Re-rsync it with compiled packs |
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
