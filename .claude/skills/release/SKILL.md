---
name: release
description: Release a new version of the DCC system
---

# Release Process for DCC System

Execute these steps in order:

## 1. Merge the PR

- Check current branch: `git branch --show-current`
- If on a feature branch, merge to main:
  ```bash
  gh pr merge --merge --delete-branch
  git checkout main
  git pull
  ```
- If already on main, confirm with user before proceeding

## 2. Update version.txt

- Read current version from `version.txt`
- Increment the final number (e.g., 0.66.27 → 0.66.28)
- Write new version to `version.txt`
- Commit: `Update version.txt`
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

### Example Release Notes

```
Release v0.66.27

## Release Notes:
* Fix Active Effects not working for NPC attack/damage bonuses (Tim L. White)
* Add responsive tabs dropdown for actor sheets (Tim L. White)
```

## 5. Publish the Release

```bash
gh release edit v{version} --draft=false --latest
```

## Important

- GitHub Action auto-creates draft release when version.txt updates on main
- Never manually edit system.json version - it's auto-generated
- If action fails, check logs with `gh run view`
