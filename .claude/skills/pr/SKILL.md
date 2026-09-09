---
name: pr
description: Create a pull request for the DCC system. Handles branch verify, i18n translation, checks, E2E gate, simplify, commit, push, create/update PR, review, auto-fix. No version bump — that happens on main at release time.
---

# DCC PR Workflow

Execute each step below sequentially using your tools directly. Run everything
in the main context except for Step 12 (review agent).

If arguments are provided, treat them as the base branch (default: `main`).

**This repo is pnpm-only.** `package.json` has `"preinstall": "npx only-allow
pnpm"` and `packageManager: pnpm@11.25.0`, and only `pnpm-lock.yaml` is
committed. Every command below is `pnpm run ...`; never `npm`.

## Step 1: Branch Verification

Run `git branch --show-current` to get the current branch name.

- If on `main` or `master`: **STOP** and tell the user to create/checkout a feature branch.
- Otherwise, confirm the branch and proceed.

Tim does his own git work in this checkout, so re-verify `git status` right
before any branch operation and stop if the tree is mid-merge or mid-rebase.

## Step 2: i18n Translation Sync

If any `lang/*.json` files have been modified (check `git diff --name-only main...HEAD` and `git diff --name-only`):

1. **New keys in `lang/en.json`**: For every key added to `en.json`, add properly translated equivalents to ALL other language files (`cn.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `pl.json`). Never leave English text in non-English files.
2. **Removed keys from `lang/en.json`**: Remove the same keys from all other language files.
3. **Renamed/moved keys**: Apply the same structural changes to all language files, preserving existing translations.
4. **Run `pnpm run compare-lang`** to verify all language files have matching keys. Fix any discrepancies before proceeding.

If NO lang files were modified in the diff, check whether any new `game.i18n.localize()` or `game.i18n.format()` calls were added in changed JS/HBS files that reference keys not present in `lang/en.json`. If so, add the missing keys to `en.json` and translate to all other languages.

## Step 3: Version Bump — NOT in the PR

Do **NOT** change `version.txt` in the PR. The bump always lands on `main` as
its **own commit**, after the PR merges (that's the `/release` skill's job —
see `docs/dev/RELEASE_PROCESS.md`).

Why: PRs are squash-merged, so a bump inside the PR gets folded into the
feature commit. The `foundry-release-action` builds release notes from commits
since the last release but **excludes the commit that carries the
`version.txt` change** — so the PR vanishes from its own release notes (this
bit #849 in v0.70.35 and #852 in v0.70.37).

If the diff already touches `version.txt`, revert that change before
committing and mention it in the final summary.

- Never update `system.json` or `package.json` versions either — the GitHub
  Action derives them from `version.txt`.

## Step 4: Vendored dcc-core-lib Check

`module/vendor/dcc-core-lib/` is generated output, synced by `pnpm run
sync-core-lib` (the `/sync-core-lib` skill). Check the diff for it:

```bash
git diff --name-only main...HEAD -- module/vendor/dcc-core-lib | head
```

- **Hand-edited vendor files** (a vendor diff without a matching
  `VERSION.json` bump, or a commit that isn't a `vendor: sync ...` commit):
  **STOP** and report. The fix belongs upstream in `moonloch/dcc-core-lib`,
  then flows in through the sync skill.
- **Temporary adapter workarounds**: if the branch added an adapter-side
  compensation for a lib bug while a lib PR was in flight, say so explicitly
  in the PR description — including the upstream PR link and the fact that
  the workaround must be removed after the next `sync-core-lib`. A permanent
  adapter workaround for a lib bug is not acceptable; if the lib PR has
  already merged, run the sync and drop the workaround in this PR instead.

## Step 5: Test Updates — Unit *and* E2E

CLAUDE.md requires that any behavior change updates the affected unit tests
**and** the `browser-tests/e2e/` Playwright specs in the *same* change.

1. Identify user-visible output the diff changed: DOM classes/text, button or
   action selectors, chat-card shape, flags, roll formulas, sheet markup,
   settings keys, data-model fields.
2. Grep for specs still asserting the old contract:
   ```bash
   grep -rn "<old class|old text|old flag|old selector>" browser-tests/e2e/ module/**/__tests__/
   ```
   Rewrite every stale assertion to the new contract.
3. Add at least one assertion covering the **new** behavior — in a unit test,
   and in an E2E spec when the change is user-visible.

A change to a chat card, roll, sheet, data model, or any user-visible output
that touches **no** spec almost always means one was missed. Say so in the
summary if you concluded none was needed, and why.

## Step 6: Pre-Flight Checks

Run `pnpm run check` (which runs `format`, `scss`, `test`, and `compare-lang`).

- If checks **fail**: **STOP** and report the failures clearly. Do not proceed until all checks pass.
- If checks **pass**: proceed.

## Step 7: E2E Gate (attack / card / roll / sheet paths)

`pnpm run check` is Vitest-only. If the diff touches the attack, chat-card,
roll, or sheet paths (broadly: `module/*attack*`, `module/chat*`,
`module/*roll*`, `module/*sheet*`, `module/vendor/dcc-core-lib/`, `styles/`,
`templates/`), the **full** `browser-tests/e2e` suite must run before pushing.

```bash
pnpm run e2e:env test                          # full suite, isolated per-worktree env (#893)
pnpm run e2e:env test some-spec.spec.js        # single spec while iterating (no `--` separator)
```

Notes:
- Iterating on one spec is fine; run the full suite before the push.
- Do **not** edit files under `module/**` while a run is in flight — a run
  that spans an edit mixes code versions into one green summary. Batch edits
  between runs.
- Known flakes: rerun standalone before blaming the change —
  `v14-features` effect toggle, two-weapon primary in `adapter-dispatch.spec.js`
  (#867), and a tour overlay on the first run against a fresh world.
- If you push **without** running the suite on one of these paths, say so
  explicitly in the final summary.

## Step 8: Code Simplification

1. Run `git diff --stat` to identify modified files.
2. Review the changed code for:
  - Unnecessary complexity
  - Poor variable/function naming
  - Duplicate logic
  - Inconsistent code style
  - Hardcoded user-facing strings that should use `game.i18n.localize()`
  - SCSS edited in `styles/dcc.scss` only — never `styles/dcc.css`
3. Make simplifications that improve clarity without changing behavior.
4. After simplification, re-run `pnpm run check`. If checks fail, revert those changes.

## Step 9: Documentation Update

Update the docs the diff actually invalidates. The usual suspects:

| Change | Doc |
|---|---|
| Public/extension surface (class registration, hooks, `CONFIG.DCC`) | `docs/dev/EXTENSION_API.md` — known to drift; check it every time |
| New/changed classes, data models, dispatch flow | `docs/dev/ARCHITECTURE.md` |
| New spec, fixture, or test command | `docs/dev/TESTING.md`, `docs/dev/TEST_COVERAGE.md` |
| New i18n conventions | `docs/dev/I18N.md` |
| Compendium/pack workflow | `docs/dev/PACKS.md`, `docs/dev/LEVELDB_WORKFLOW.md` |
| Release/versioning behavior | `docs/dev/RELEASE_PROCESS.md` |
| New setting or user-visible feature | `docs/user-guide/`, `README.md` |
| New rule for how Claude works in this repo | `CLAUDE.md` |

Include the doc updates in the same commits/PR.

## Step 10: Dependent Module Check

Grep for any class, function, constant, hook name, setting key, or template
path that was renamed or removed in the diff, then search for its usage in all
four dependent modules:

- `../../modules/dcc-qol`
- `../../modules/xcc`
- `../../modules/mcc-classes`
- `../../modules/dcc-crawl-classes`

`mcc-classes` and `dcc-crawl-classes` are real consumers of the class
registration / extension API, so extension-surface changes are most likely to
break there.

If a dependent module references something that was changed, **STOP** and report the potential breakage to the user before proceeding.

## Step 11: Atomic Commit Creation

1. Run `git status` and `git diff` to see all changes.
2. **The pre-commit hook runs `git add .`** (`.husky/pre-commit`: `pnpm run
   format && git add . && pnpm test`). It sweeps every untracked file into the
   commit, so staging specific paths is not enough on its own — before
   committing, confirm `git status` shows no stray untracked files, and move
   scratch files out of the repo (use the session scratchpad) if it does.
3. Group changes into logical, atomic commits. Each commit should:
  - Represent a single logical change
  - Be independently reversible
  - Have a clear commit message following conventional commits format
4. Recommended commit ordering:
  - Feature/fix commits first
  - i18n translation commits (e.g., `chore: translate new i18n keys to all languages`)
  - No version bump commit — `version.txt` is bumped on `main` after the merge (Step 3)
5. Stage with `git add <specific files>` — avoid `git add -A` (and see the hook caveat above).
6. End each commit message with **the attribution lines supplied for the
   current session** (the `Co-Authored-By:` / `Claude-Session:` lines from the
   session's attribution system-reminder). Do not hardcode a model version
   here — it goes stale every release.

## Step 12: Push Changes

```bash
git push -u origin $(git branch --show-current)
```

If push is rejected due to conflicts, **STOP** and report to user.

## Step 13: PR Creation or Update

1. Check if a PR already exists: `gh pr view --json number,title,url 2>/dev/null`
2. **If NO existing PR**: Create one with `gh pr create`:
  - Clear, descriptive title (under 70 chars)
  - Body with `## Summary` (bullet points) and `## Test plan` (checklist)
  - End the body with the session's PR attribution lines
  - Do not prompt user to accept PR description
3. **If PR EXISTS**: Update it with `gh pr edit --title "..." --body "..."`:
  - Always regenerate title and description from current diff
  - Never preserve stale descriptions
4. Use `git diff main...HEAD` (or the base branch passed as an argument) to understand the full scope of changes for the PR description.

## Step 14: Automated PR Review

Launch the `foundryvtt-dev:foundryvtt-reviewer` agent using the Agent tool, pointed at the current working directory. Do **not** use `isolation: "worktree"`: the reviewer is read-only (`Read`, `Grep`, `Glob`), so it cannot switch branches or modify anything — and when running inside a per-issue `work:start` worktree, a spawned worktree comes from the shared parent repo and lands on a stale `worktree-agent-*` branch that does not contain the PR's changes.

The reviewer will check for CLAUDE.md compliance, bugs, style issues, empty catches, swallowed errors, and test coverage gaps.

Collect and consolidate findings. Categorize as: Critical, High, Medium, Low.

## Step 15: Auto-Fix High-Priority Issues

Fix the findings categorized **Critical** or **High** in Step 14 (the reviewer
emits severities, not numeric confidence scores — judge by severity). For each:

1. Implement the fix directly (read the file, edit it).
2. Re-run `pnpm run check` — plus the affected E2E spec(s) if the fix touches an E2E-gated path (Step 7).
3. If the fix breaks checks, revert it and report instead.
4. Create a new atomic commit for the fixes.
5. Push the fix commit.

**Escalation**: If more than 3 issues need fixing, confirm with user before proceeding.

If a fix is complex or risky, **report it** instead of implementing it. Leave
Medium/Low findings for the summary.

## Step 16: Final Summary

Output a structured summary:

```
[PR SUMMARY]
PR URL: <url>
Version: unchanged (bump happens on main at release time)
i18n: <count> keys added/removed across <count> language files
Tests: unit <updated/added> | E2E <specs updated / suite run or "not required (paths untouched)">
Commits: <count> (<original> original + <fix> fixes)
Issues fixed: <count>
Remaining: <count> (manual review suggested)
Dependent modules: OK / <issues found>
core-lib: clean / <temporary workaround pending sync>
Status: Ready for review / Needs attention
```

## Escalation Criteria

**STOP and report** (do not proceed automatically) when:
- On main/master branch, or the tree is mid-merge/mid-rebase
- Pre-flight checks fail
- The E2E suite fails on a gated path and the failure is not one of the known flakes
- `module/vendor/dcc-core-lib/` was hand-edited
- i18n keys are missing translations and auto-translation confidence is low
- Push is rejected due to conflicts
- PR creation fails
- Critical issues found that are too complex to auto-fix
- More than 3 high-priority issues need fixing
- Dependent modules (`dcc-qol`, `xcc`, `mcc-classes`, `dcc-crawl-classes`) reference changed/removed APIs

## Edge Cases

- **No changes to commit**: Report this and ask if user wants to proceed.
- **Branch ahead of remote main**: Offer to rebase first.
- **PR already exists**: Update title AND description to match current changes.
- **Review finds no issues**: Report clean PR.
- **Auto-fixes fail checks**: Revert them and report the issue.
- **Language files out of sync**: Run `pnpm run compare-lang` and fix before proceeding.
- **E2E env won't boot**: a license-reconfirm screen can block autolaunch; `e2e:env` handles it since #898 — if it still hangs, report rather than retrying blindly.
