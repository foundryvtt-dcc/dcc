---
name: release
description: Release a new version of the DCC system
---

# Release Process for DCC System

Execute these steps in order:

## 1. Merge the PR

- Identify the PR: use the number the user gave, or the PR for the current
  branch (`gh pr view --json number -q .number`). If there is no PR to merge
  (already on main), confirm with the user before proceeding.
- Verify it is `OPEN` and `MERGEABLE` (`gh pr view <N> --json state,mergeable`).
- **Squash-merge** — the repo's history is one squashed commit per PR, never
  a merge commit:
  ```bash
  gh pr merge <N> --squash --delete-branch
  git checkout main
  git pull
  ```
- Delete the local copy of the branch if one exists (`git branch -D <branch>`).

## 2. Update version.txt — always its own commit on main

- Read current version from `version.txt`
- Increment the final number (e.g., 0.66.27 → 0.66.28)
- Write new version to `version.txt`
- Commit: `Update version.txt` — the commit must contain **only** the
  `version.txt` change, and it happens **on `main` after the PR merges**,
  never inside a feature PR. Squash-merge folds an in-PR bump into the
  feature commit, and `foundry-release-action` excludes the bump-carrying
  commit when generating release notes — the feature then vanishes from its
  own release notes (this bit #849 in v0.70.35 and #852 in v0.70.37).
- Push to main

## 3. Wait for GitHub Actions

- Poll workflow status until release workflow completes:
  ```bash
  gh run list --limit 5
  ```
- The workflow creates a draft release tagged with the version

## 4. Edit Release Notes

Release notes must be VERY terse. Follow this exact format:

```
Release v{version}

## Release Notes:
* Brief description of change (Contributor Name)
```

Look at commits since last release:
```bash
gh release view --json tagName -q '.tagName'
git log {previous_tag}..HEAD --oneline
```

Use `gh release edit v{version} --notes-file -` to update.

The workflow's auto-generated notes are the raw commit title plus a
`— @handle`. **Always rewrite them** into the format above: a plain-English
description of the user-visible change (no `fix:`/`feat:` prefix, no PR
number), credited by the contributor's display name, not their handle:
```bash
gh api users/<login> -q .name   # e.g. blaze-sanecki → Blaze Sanecki
```
Fall back to the login if the account has no display name.

### Example Release Notes

```
Release v0.66.27

## Release Notes:
* Fix Active Effects not working for NPC attack/damage bonuses (Tim L. White)
* Add responsive tabs dropdown for actor sheets (Tim L. White)
```

## 5. Hand Off the Draft — Do NOT Publish

The release stays a **draft**. **Do not publish or promote it.** The maintainer
publishes the draft manually. Stop here and tell the maintainer that draft
`v{version}` is ready (with notes), and they will push it out.

Publishing is what fires the downstream `release: published` workflows
(`foundry-website-update`, `update-foundry-manifest-after-release`) that push the
version to Foundry's registry — that step is the maintainer's call, not yours.

Only run the publish command if the maintainer **explicitly tells you to in that
session**:

```bash
# ONLY when explicitly instructed by the maintainer:
gh release edit v{version} --draft=false --latest
```

## Important

- GitHub Action auto-creates a **draft** release when version.txt updates on main.
- **Never publish/promote a release** (no `gh release edit --draft=false`, no
  marking latest) unless the maintainer explicitly tells you to. The default is
  always: leave the draft for the maintainer to push out.
- Never manually edit system.json version - it's auto-generated.
- If action fails, check logs with `gh run view`.
