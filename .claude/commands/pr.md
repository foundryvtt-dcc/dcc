---
description: "Create a pull request for the DCC system. Handles branch verify, i18n translation, version bump, checks, simplify, commit, push, create/update PR, review, auto-fix."
argument-hint: "optional: base branch (default: main)"
---

# DCC PR Workflow

Execute each step below sequentially using your tools directly. Do NOT use the Task tool with `pr-workflow-manager` — run everything in the main context except for Step 11 (review agent).

## Step 1: Branch Verification

Run `git branch --show-current` to get the current branch name.

- If on `main` or `master`: **STOP** and tell the user to create/checkout a feature branch.
- Otherwise, confirm the branch and proceed.

## Step 2: i18n Translation Sync

If any `lang/*.json` files have been modified (check `git diff --name-only main...HEAD` and `git diff --name-only`):

1. **New keys in `lang/en.json`**: For every key added to `en.json`, add properly translated equivalents to ALL other language files (`cn.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `pl.json`). Never leave English text in non-English files.
2. **Removed keys from `lang/en.json`**: Remove the same keys from all other language files.
3. **Renamed/moved keys**: Apply the same structural changes to all language files, preserving existing translations.
4. **Run `npm run compare-lang`** to verify all language files have matching keys. Fix any discrepancies before proceeding.

If NO lang files were modified in the diff, check whether any new `game.i18n.localize()` or `game.i18n.format()` calls were added in changed JS/HBS files that reference keys not present in `lang/en.json`. If so, add the missing keys to `en.json` and translate to all other languages.

## Step 3: Version Bump

Read `version.txt` to get the current version (format: `MAJOR.MINOR.PATCH`).

- Increment the **patch** version (e.g., `0.66.39` → `0.66.40`).
- Write the new version to `version.txt` (just the version number, no `v` prefix, with a trailing newline).
- Do NOT update `system.json` or `package.json` — the GitHub Action handles that from `version.txt`.

## Step 4: Pre-Flight Checks

Run `npm run check` (which runs format, scss, test, and compare-lang).

- If checks **fail**: **STOP** and report the failures clearly. Do not proceed until all checks pass.
- If checks **pass**: proceed.

## Step 5: Code Simplification

1. Run `git diff --stat` to identify modified files.
2. Review the changed code for:
  - Unnecessary complexity
  - Poor variable/function naming
  - Duplicate logic
  - Inconsistent code style
  - Hardcoded user-facing strings that should use `game.i18n.localize()`
3. Make simplifications that improve clarity without changing behavior.
4. After simplification, re-run `npm run check`. If checks fail, revert those changes.

## Step 6: Documentation Update

1. Check the `docs/` folder for any progress tracking or other docs and update them.
2. Look for relevant documentation that would need to be updated based on this PR, including `CLAUDE.md` and `README.md`.
3. Include those doc updates in the commits/PR.

## Step 7: Dependent Module Check

Check that changes don't break dependent modules. Grep for any classes, functions, or constants that were renamed or removed in the diff, then search for their usage in:
- `../../modules/dcc-qol`
- `../../modules/xcc`

If a dependent module references something that was changed, **STOP** and report the potential breakage to the user before proceeding.

## Step 8: Atomic Commit Creation

1. Run `git status` and `git diff` to see all changes.
2. Group changes into logical, atomic commits. Each commit should:
  - Represent a single logical change
  - Be independently reversible
  - Have a clear commit message following conventional commits format
3. Recommended commit ordering:
  - Feature/fix commits first
  - i18n translation commits (e.g., `chore: translate new i18n keys to all languages`)
  - Version bump commit last (e.g., `chore: bump version to X.Y.Z`)
4. Stage and commit each group separately. Use `git add <specific files>` — avoid `git add -A`.
5. End each commit message with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Step 9: Push Changes

```bash
git push -u origin $(git branch --show-current)
```

If push is rejected due to conflicts, **STOP** and report to user.

## Step 10: PR Creation or Update

1. Check if a PR already exists: `gh pr view --json number,title,url 2>/dev/null`
2. **If NO existing PR**: Create one with `gh pr create`:
  - Clear, descriptive title (under 70 chars)
  - Body with `## Summary` (bullet points) and `## Test plan` (checklist)
  - Do not prompt user to accept PR description
3. **If PR EXISTS**: Update it with `gh pr edit --title "..." --body "..."`:
  - Always regenerate title and description from current diff
  - Never preserve stale descriptions
4. Use `git diff main...HEAD` (or appropriate base branch) to understand the full scope of changes for the PR description.

If `$ARGUMENTS` is provided, use it as the base branch instead of `main`.

## Step 11: Automated PR Review

Launch the `foundryvtt-dev:foundryvtt-reviewer` agent using the Agent tool with `isolation: "worktree"` to prevent branch switching in the main working directory.

The reviewer will check for CLAUDE.md compliance, bugs, style issues, empty catches, swallowed errors, and test coverage gaps.

Collect and consolidate findings. Categorize as: Critical, High, Medium, Low.

## Step 12: Auto-Fix High-Priority Issues

For any issues flagged by the code review (confidence ≥80):

1. Implement the fix directly (read the file, edit it).
2. Re-run `npm run check` to ensure the fix doesn't break anything.
3. If fix breaks checks, revert it and report instead.
4. Create a new atomic commit for the fixes.
5. Push the fix commit.

**Escalation**: If more than 3 issues need fixing, confirm with user before proceeding.

If a fix is complex or risky, **report it** instead of implementing it.

## Step 13: Final Summary

Output a structured summary:

```
[PR SUMMARY]
PR URL: <url>
Version: <old> → <new>
i18n: <count> keys added/removed across <count> language files
Commits: <count> (<original> original + <fix> fixes)
Issues fixed: <count>
Remaining: <count> (manual review suggested)
Dependent modules: OK / <issues found>
Status: Ready for review / Needs attention
```

## Escalation Criteria

**STOP and report** (do not proceed automatically) when:
- On main/master branch
- Pre-flight checks fail
- i18n keys are missing translations and auto-translation confidence is low
- Push is rejected due to conflicts
- PR creation fails
- Critical issues found that are too complex to auto-fix
- More than 3 high-priority issues need fixing
- Dependent modules (`dcc-qol`, `xcc`) reference changed/removed APIs

## Edge Cases

- **No changes to commit**: Report this and ask if user wants to proceed.
- **Branch ahead of remote main**: Offer to rebase first.
- **PR already exists**: Update title AND description to match current changes.
- **Review finds no issues**: Report clean PR.
- **Auto-fixes fail checks**: Revert them and report the issue.
- **Language files out of sync**: Run `npm run compare-lang` and fix before proceeding.