---
name: needanything
description: Read-only sweep of everything that may be waiting on a human — open PRs (contributor PRs to review, Dependabot and Audit Fix bot PRs that didn't land, red CI, conflicts, the E2E gate waiting on an `e2e-approved` label, stacked drafts whose base merged, green-but-unmerged), issues awaiting a reply, the release state (a draft waiting to be published, unreleased commits on main, a dead release workflow), red scheduled jobs on main, the dcc-core-lib sync state, the sibling modules, and this checkout's leftover branches and worktrees. Use when Tim asks "need anything?", "anything waiting on me?", "what needs attention", "check open PRs and issues", or at the start of a session before picking work.
---

# Does anything need us?

Reference: `CONTRIBUTING.md` (contributor PRs, stacked drafts, "Depends on
#N"), `docs/dev/RELEASE_PROCESS.md` (the draft-only release workflow and the
Foundry package-release endpoint), `deploy/e2e-runner/README.md` and the
header comment of `.github/workflows/e2e-gate.yml` (who may run E2E), the
header comments of `audit-fix.yml` and `dependabot-auto-merge.yml` (what the
bot PRs expect). This skill is the checklist; those are the truth when the
two disagree.

**Read-only.** Report and recommend; never label, comment, close, merge,
rebase, delete a branch, or run a workflow as part of the check. The only
thing the scan changes is the remote-tracking refs (`git fetch --prune`); it
never touches a local branch, the working tree, or GitHub. **Never
publish or promote a release** — the maintainer does that by hand, always
(see the standing authorizations in `CLAUDE.md`). Offer the action and wait
for a yes.

1. **Scan:**

   ```bash
   .claude/skills/needanything/scan.sh
   ```

   About 20 seconds; one tab-separated line per item. It reads
   `foundryvtt-dcc/dcc`, the lib repo `moonloch/dcc-core-lib`, the sibling
   modules (xcc, mcc-classes, dcc-crawl-classes, dcc-core-book — dcc-qol is
   deliberately skipped), and the local checkout. `gh` output is paged off
   with `GH_PAGER=cat`; the script sets it, so don't drop that if you edit it.

2. **Classify each open PR** (section `OPEN PRS`). There is no issue
   automation in this repo: every PR was opened by Tim, a contributor, or one
   of two bots.

   | PR state                                                              | Meaning / suggested action                                                                                                                                                                                                 |
   | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `author=app/dependabot`, `automerge=true`, checks pending or green    | In flight — `dependabot-auto-merge.yml` squash-merges it once the required checks pass (`Run Tests`, if it is required; with no required check it merges immediately). Say nothing unless it has sat for more than a day. |
   | `author=app/dependabot`, `automerge=false`                            | Auto-merge didn't take (repo setting, or no required check). **Needs a human merge** after a glance at the diff. Red `Run Tests` on it → read the failure first.                                                           |
   | `author=app/github-actions`, branch `automated/npm-audit-fix`         | The daily **Audit Fix** PR. `Run Tests` never runs on it (opened with `GITHUB_TOKEN`); the unit tests ran inside the workflow before it opened, so no checks on it is normal (`merge=UNSTABLE` or `CLEAN`; `BLOCKED` if `Run Tests` is ever made required, which then needs an admin merge). **Needs you**: read the lockfile diff and merge. It re-opens or updates itself daily until merged. |
   | author is not Tim and not a bot                                       | **Contributor PR.** Review per `CONTRIBUTING.md`: ask for specific changes if needed, then merge as submitted — never cherry-pick or trim it on their behalf. Say how long it has waited.                                   |
   | `e2e=PENDING` (or `-`) with no `e2e-approved` label, author not a member | The E2E gate is waiting: either Claude triage is still running, or it declined and a maintainer must add the **`e2e-approved`** label to run the PR's code on the self-hosted runner. A new push drops the label again. |
   | `e2e=FAILURE`                                                         | Either the gate's Claude triage **declined** the PR (the gate's PR comment says so; a maintainer overrides with `e2e-approved`) or the suite is **red** on the self-hosted runner. Read the status link to tell which. For a red suite, check the log before blaming the change — some specs are order-dependent or scene-drift flaky (`docs/dev/TESTING.md`); a standalone rerun is the first step. |
   | `e2e=ERROR`                                                           | The gate itself crashed (triage error), so nothing ran. A maintainer adds `e2e-approved` or the author re-pushes to retry.                                                                                                |
   | `checks_failed` non-empty                                             | **Red CI** — name the failing check(s) (`Run Tests`, `Check Translations`, `CodeQL`, …).                                                                                                                                   |
   | `merge=DIRTY` (or `CONFLICTING`)                                      | **Conflicts with main** — needs a rebase. A contributor's PR: ask them; ours: offer to do it.                                                                                                                              |
   | `draft=true`, `depends_on=#N(MERGED)`                                 | **Stacked PR whose base has landed.** It should be rebased onto `main` and marked ready (the author's job for a fork; ours if it's our branch). Offer the nudge or the rebase.                                              |
   | `draft=true`, `depends_on=#N(OPEN)`                                   | Waiting on #N — no action.                                                                                                                                                                                                 |
   | `draft=true`, no dependency                                           | Work in progress — no action unless it's older than a week, then ask whether it's abandoned.                                                                                                                              |
   | `merge=BLOCKED`, checks green                                         | Waiting on a required review/approval.                                                                                                                                                                                     |
   | ready, green, `merge=CLEAN`, author Tim or a contributor              | **Green but unmerged** — waiting on Tim's review/merge. After it lands, `/release` is the usual next step.                                                                                                                 |
   | `checks_pending > 0`, or `merge=UNKNOWN` on a fresh push              | In flight — not yet actionable.                                                                                                                                                                                            |

   A PR updated in the last few minutes may still be settling; say so rather
   than calling it stuck.

3. **Issues.** There is no triage pipeline; the open issues are Tim's own
   backlog unless someone else shows up in them.
   - `ISSUES AWAITING A REPLY` — someone other than Tim spoke last (or
     opened it and nobody answered). **Needs you**: read the newest comments
     (`gh issue view <n> --comments`) and say what they're asking.
   - `BUG / FOUNDRY-API-CHANGE ISSUES` — list these ahead of enhancements;
     a `foundry-api-change` issue usually means a Foundry update broke
     something and players are seeing it.
   - `BACKLOG` — the rest is available to pick up; give the count and the
     lowest number. Don't list them one by one.

4. **Release state** (section `RELEASE`).
   - `draft_release=` line → **Needs you now**: a draft is waiting to be
     published, and only the maintainer may publish it (`CLAUDE.md`
     standing authorizations). Offer to tidy its notes, never to promote it.
   - `unreleased_commits > 0` and no draft → feature work sits on `main`
     unreleased. Offer the `version.txt` bump from `/release` (its own
     commit on `main`, never inside a PR). CI-only or docs-only commits
     don't need a release; say so instead of offering one.
   - `bump_unreleased=yes` with **no** draft and no `Create GitHub Release`
     run newer than the bump → the release
     workflow was skipped. A very large squash-merge can trip the
     `paths: version.txt` filter; recovery is a small whitespace push to
     `version.txt` on `main`, which needs Tim's go-ahead.
   - `Create GitHub Release` red → no draft was made; read
     `gh run view <run> --log-failed`.
   - `Foundry Website Update` or `Update Foundry Manifest Post-Release` red
     → a release was published but **Foundry's registry never heard of it**:
     in-app installs stay frozen on the previous version. **Needs you now.**
     See `docs/dev/RELEASE_PROCESS.md` § Manifest URLs & the package-release
     endpoint.

5. **Scheduled and push jobs on main** (`NEWEST RUN PER WORKFLOW ON MAIN`,
   plus one `red_now=` line per workflow whose newest run failed). Green →
   say nothing. Red:
   - `Run Tests` on main → **main is red**; name the commit.
   - `Audit Fix` → the daily audit either found an advisory with no in-range
     fix (left for a human) or the job itself broke at `Create or update fix
     PR`; read the log and say which.
   - `Dependabot Updates` → Dependabot can't produce its bumps; a long red
     streak here means security updates silently stopped. Read the log, file
     an issue if none tracks it.
   - `CodeQL` → read the alert; usually a real finding or a config break.

6. **Core lib** (`CORE LIB`).
   - `sync_due=yes` (vendored behind the latest published lib release) → a
     `/sync-core-lib` is due. Note whether
     the branch carries a temporary adapter workaround that the sync should
     remove.
   - Our own open lib PR → after it merges, the sync + workaround removal is
     the next step; a lib Dependabot PR with green checks is a one-click
     merge for Tim.
   - Lib issues awaiting a reply → someone outside is asking; the lib is
     public and must stay free of book text, so check any answer for that.

7. **Sibling modules** (`SIBLING MODULES`): open PRs and issues awaiting a
   reply in xcc, mcc-classes, dcc-crawl-classes and dcc-core-book. These are
   usually low priority; list them under **Worth a look** with the module
   name and age, and flag a module PR that depends on an unreleased DCC
   change.

8. **Local checkout** (`LOCAL CHECKOUT`): housekeeping, never urgent.
   - `dirty_files` on `main` → say what's uncommitted before anyone switches
     branches (Tim does his own git work in this checkout).
   - `fetch=failed` → the ahead/gone lines are stale; say so.
   - `branch=… [ahead N]` → unpushed commits; offer the push if the branch
     isn't `main`.
   - `gone_branches=` → local branches whose remote was deleted. PRs are
     squash-merged, so `git branch -d` refuses them; before offering
     `git branch -D`, confirm each one's PR merged
     (`gh pr list --head <branch> --state merged`) and leave out any that
     didn't.
   - A worktree whose `PR: #N MERGED` → offer `pnpm run work:finish`.

9. **Report**, grouped, most urgent first — one line per item with the
   number, the reason, and the one next step:

   ```
   Needs you now
   - Draft release v0.70.76 waiting 3h — publish it (yours to do)
   - PR #1094 — Audit Fix lockfile bump, no checks by design; review and merge
   - #1101 — reporter replied 2h ago with a repro; they're waiting on an answer

   Worth a look
   - Dependabot Updates red 6 runs in a row on main (Run Dependabot step) — no issue tracks it
   - mcc-classes #30 — PhDoom's sheet request, 632d without a reply
   - 8 local branches with a deleted remote (all merged PRs) to delete; worktree for #1075 can be finished

   In flight (no action)
   - PR #1102 — contributor PR, E2E gate triage running
   ```

   If nothing qualifies, say so in one line and give the counts checked
   (for example: "Nothing needs you — 1 open PR (bot, in flight), 0 issues
   awaiting a reply, 23 backlog issues, v0.70.75 published with nothing
   unreleased, main green, lib in sync."). Skip empty groups. Finish by
   offering the obvious next action (merge the audit-fix PR, run
   `/release`, start `/sync-core-lib`, pick up the lowest-numbered
   backlog issue) and do it only on a yes.
