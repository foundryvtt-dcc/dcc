> **Cutting a test build off a feature branch (not `main`)?** That's a
> different, manual flow — see
> [PRERELEASE_PROCESS.md](PRERELEASE_PROCESS.md). The steps below are the
> normal stable release from `main`.

When you are about to do a release, and not before:

For automated release process:
1. You need to have the foundry-cli installed ([https://github.com/FoundryApp/foundry-cli](https://github.com/foundryvtt/foundryvtt-cli))
1. Ensure you run `npm run tojson' to copy the data out of levelDB files and into JSON, since LevelDB files are not checked in
1. Merge all changes into main
1. Commit `version.txt` File with new release version number in it (no 'v')
   — this is the **only** file you hand-edit for a release. The
   `Create GitHub Release` workflow syncs `package.json` **and**
   `package-lock.json` to that version (via `npm version --no-git-tag-version`)
   before the release action rewrites `system.json` and commits the lot, so the
   lockfile no longer drifts behind the bumped `package.json`.
1. GitHub Action will automatically create a draft release
1. Edit draft release notes and title
1. Publish the release

For manual release process:
1. You need to have the foundry-cli installed ([https://github.com/FoundryApp/foundry-cli](https://github.com/foundryvtt/foundryvtt-cli))
1. Ensure you run `npm run tojson' to copy the data out of levelDB files and into JSON, since LevelDB files are not checked in
1. Merge in all changes to main
1. Update system.json to change the version number at the top
1. Update system.json to change the zipfile path at the bottom (you have to guess the path, because you haven't created release yet)
1. Update system.json to change the manifest path at the bottom — use the versioned per-release URL `https://github.com/foundryvtt-dcc/dcc/releases/download/v<version>/system.json` (see "Manifest URLs & the package-release endpoint" below). You have to guess the path, because you haven't created the release yet.
1. Create a release in Github with new version number
1. Go through commits since last release and use them to create release notes
1. Publish the release
1. Update Foundry admin with new release paths for both download and manifest

## Manifest URLs & the package-release endpoint

DCC and its family modules (`xcc`, `mcc-classes`, `dcc-crawl-classes`,
`dcc-qol`, `dcc-core-book`) all publish through the shared GitHub Actions in
`foundryvtt-dcc/foundry-release-action`, `foundry-manifest-update-action`, and
`foundry-package-release-action`. A release is triggered by committing a new
`version.txt` to `main`.

### All-versioned manifests

Each release ships a `system.json`/`module.json` whose `manifest` **and**
`download` both point at that exact release's immutable GitHub assets:

```
"manifest": "https://github.com/foundryvtt-dcc/dcc/releases/download/v<version>/system.json",
"download": "https://github.com/foundryvtt-dcc/dcc/releases/download/v<version>/dcc.zip",
```

`foundry-release-action` emits these automatically — you don't set them by
hand. This is a deliberate, race-proof choice: an immutable per-version
manifest can never report the wrong version.

### The package-release endpoint (the thing that actually broke)

After a release is published, `foundry-website-update.yml` runs
`foundry-package-release-action`, which POSTs the new version to Foundry's
Package Release API. It **must** POST to:

```
https://foundryvtt.com/_api/packages/release_version/
```

**NOT** `https://api.foundryvtt.com/...`. The old lambda host *registers* the
version (it shows up under "Available Versions" on the package page and the
API returns `status: success`) but **does not update Foundry's package
cache** — so the in-app installer never advances to the new version. This
silently froze DCC (stuck at 0.67.7) and XCC (stuck on a v13 version, so it
vanished entirely on v14) until Foundry support identified the wrong host on
2026-06-18. It is fixed in `foundry-package-release-action`.

### If a release won't appear in the in-app installer

1. Open the release's **Foundry Website Update** workflow run and confirm the
   log shows `url: 'https://foundryvtt.com/_api/packages/release_version/'`
   (not `api.foundryvtt.com`) with `status: 'success'`.
2. Give Foundry's cache a few minutes and restart the Foundry client — the
   install list is cached per session.
3. If still stuck, Foundry support can force-refresh the package cache (they
   "edit a release and change it back").

The per-version `manifest` field only affects manifest-URL-installed copies'
own update checks; it does **not** drive the in-app installer's current
version. That comes solely from the Package Release API submission reaching the
correct host.
