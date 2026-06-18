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
1. GitHub Action will automatically create a draft release
1. Edit draft release notes and title
1. Publish the release

For manual release process:
1. You need to have the foundry-cli installed ([https://github.com/FoundryApp/foundry-cli](https://github.com/foundryvtt/foundryvtt-cli))
1. Ensure you run `npm run tojson' to copy the data out of levelDB files and into JSON, since LevelDB files are not checked in
1. Merge in all changes to main
1. Update system.json to change the version number at the top
1. Update system.json to change the zipfile path at the bottom (you have to guess the path, because you haven't created release yet)
1. Update system.json to change the manifest path at the bottom — it **must** be the versioned per-release URL `https://github.com/foundryvtt-dcc/dcc/releases/download/v<version>/system.json` (see "Manifest URLs & registry promotion" below). You have to guess the path, because you haven't created the release yet.
1. Create a release in Github with new version number
1. Go through commits since last release and use them to create release notes
1. Publish the release
1. Update Foundry admin with new release paths for both download and manifest

## Manifest URLs & registry promotion

**Critical rule:** the `manifest` field in a release's `system.json` (the
asset Foundry validates when you submit a release) **must be a versioned,
immutable URL** that points at *that exact release's* manifest asset:

```
"manifest": "https://github.com/foundryvtt-dcc/dcc/releases/download/v<version>/system.json",
"download": "https://github.com/foundryvtt-dcc/dcc/releases/download/v<version>/dcc.zip",
```

This is emitted automatically by `foundryvtt-dcc/foundry-release-action`
(public modules use the versioned manifest URL; protected modules use the
content-repo manifest). You normally never set it by hand.

### Why it must be versioned

When you submit a release, Foundry's Package Release API accepts it (it shows
up in the package's "Available Versions" list and the API returns
`status: success`) but it will only **promote** the release to the package's
installable *current version* if the manifest URL's content reports the **same
version as the release at validation time**. A versioned URL is immutable, so
it can never mismatch.

A **moving** manifest URL (e.g. a `latest.json` on `main`, or `system.json`
on a branch) is risky because it is refreshed by a *post-release* action that
can race the registry submission — at validation time the moving file may
still show the previous version → mismatch → **the release is recorded but
never promoted, silently freezing the in-app installer on the last
versioned-manifest release.** This is exactly what happened from v0.67.8
through v0.70.0 (frozen at 0.67.7). Note this is a *consistency* requirement,
not a ban on `raw.githubusercontent` URLs — dnd5e ships a stable raw manifest
successfully because it keeps `system.json` version-correct on `master`
*before* releasing.

### What `latest.json` is for

`latest.json` is a clone of the latest release's manifest, refreshed each
release by `foundryvtt-dcc/foundry-manifest-update-action` and committed to
`main`. It is **never submitted to the registry**, so it does not affect
promotion. It exists as a stable poll target for copies that were installed
via a manifest URL (their installed `manifest` field points at it), so keeping
it maintained lets those installs detect new versions. Do **not** put the
`latest.json` URL in a release asset's `manifest` field.

### Symptoms of a frozen registry

- The package page header / in-app installer shows an older version than the
  newest entry in the "Available Versions" list.
- A dependent module (e.g. XCC, which requires `dcc >= x`) becomes
  un-installable because the in-app installer can't supply the required DCC
  version.

**Recovery:** ensure `foundry-release-action` emits a versioned `manifest`,
then cut a fresh release — the new submission validates cleanly and promotes,
which also unblocks dependents. To rescue an *already-shipped* frozen version
whose zip points at itself, rebuild that zip's internal `system.json` with
`manifest` → `https://github.com/foundryvtt-dcc/dcc/releases/latest/download/system.json`
(GitHub's stable "latest release" redirect) so existing installs can move
forward.
