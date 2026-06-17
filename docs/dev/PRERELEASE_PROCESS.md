# Pre-Release Process (off-branch test builds)

How to cut a **Foundry-installable pre-release from any branch** (e.g.
`refactor/dcc-core-lib-adapter`) so testers can install it by pasting a
manifest URL into Foundry — without touching `main` or the stable
"Latest" release.

For the normal stable release flow (merge to `main`, bump `version.txt`,
let the GitHub Action build the zip) see
[RELEASE_PROCESS.md](RELEASE_PROCESS.md). **This doc is for the manual,
off-`main` case.**

## Why this is manual

The automated release action
(`.github/workflows/create-github-release.yml` →
`foundryvtt-dcc/foundry-release-action`) only triggers on **pushes to
`main` that touch `version.txt`**. It cannot build from a feature
branch. So a pre-release off a branch is assembled and published by hand
with the steps below.

## How Foundry install-by-manifest works

A tester picks **Game Systems → Install System → Manifest URL** and pastes
a URL to a `system.json`. Foundry reads it, downloads the zip named in the
`download` field, and extracts it into `Data/systems/<id>/`. So a working
pre-release needs **two assets** hosted at a stable URL (a GitHub release
is ideal):

| Asset | Purpose |
|-------|---------|
| `system.json` | The manifest the tester's URL points at. Its `manifest` field self-references this same URL (so Foundry's update check stays pinned to this pre-release line); its `download` field points at the zip. |
| `dcc.zip` | The packaged system, files at the **zip root** (`system.json` at top level, no wrapping folder). |

## Critical branch-specific gotchas

- **`module/vendor/dcc-core-lib/` MUST be in the zip.** On
  `refactor/dcc-core-lib-adapter` the system imports the vendored lib at
  runtime. The stable `main` zip does **not** contain `module/vendor/`, so
  you cannot reuse a `main` build — you must build from the branch's
  working tree (which includes `vendor/`). Always verify it's present in
  the zip (the build script below asserts this).
- **Compiled assets are gitignored.** `styles/dcc.css` is committed but
  may be stale — rebuild it. The LevelDB packs Foundry actually loads
  (`packs/**/*.ldb`, `CURRENT`, `MANIFEST*`, `LOG*`) are gitignored; only
  the JSON sources (`packs/*/src/*.json`) are committed. You must
  `npm run todb` to compile them into the zip.
- **Foundry must be shut down before `npm run todb`** — a running Foundry
  holds the pack LevelDB `LOCK` and the compile will fail or corrupt.
- **Same system `id` (`dcc`).** Keep it. Existing `dcc` worlds open under
  the pre-release. The cost: installing the pre-release **replaces** a
  stable DCC install in the *same* Foundry data dir (you cannot have two
  systems with id `dcc` side by side). Tell testers to use a separate data
  dir if they want to keep stable DCC too.

## Versioning convention

Use a semver **prerelease** string that sorts **above** the current
stable so Foundry never offers testers a "downgrade" back to stable:

- Current stable: `0.67.2` → pre-release line: **`0.68.0-refactor.N`**
  (tag `v0.68.0-refactor.N`), bump `N` for each rebuild.
- A prerelease string like `0.68.0-refactor.2` sorts **above**
  `0.68.0-refactor.1` and below the eventual `0.68.0`, so re-publishing
  with a higher `N` lets existing testers update in place.
- **Do not** use `0.67.2-refactor.1` — it sorts *below* `0.67.2`, so
  Foundry would offer testers an "update" back to stable.

## Step-by-step

Run from the repo root on the branch you want to ship. Set `TAG`/`VER`
once at the top.

```bash
export TAG=v0.68.0-refactor.1
export VER=0.68.0-refactor.1
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24   # V14 needs Node 24

# 1. Shut down any running Foundry (releases the pack LevelDB locks).
#    The fvtt CLI launch runs `node .../foundry-14/main.js`; find + kill it:
pkill -f "foundry-14/main.js"
#    Confirm it's down:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:30000 --max-time 3 || echo "down"

# 2. Compile fresh CSS + LevelDB packs.
npm run scss
npm run todb

# 3. Stage the working tree, excluding dev cruft (mirrors the official
#    zip: files at root, no tests/docs/node_modules). Keeps module/vendor/
#    and the compiled packs/CSS.
STAGE=/tmp/dcc-rel
rm -rf "$STAGE"; mkdir -p "$STAGE"
rsync -a \
  --exclude='.git/' --exclude='.github/' --exclude='.husky/' --exclude='.idea/' \
  --exclude='.claude/' --exclude='.foundry-dev/' --exclude='node_modules/' \
  --exclude='docs/' --exclude='browser-tests/' --exclude='test-results/' \
  --exclude='scripts/' --exclude='coverage/' \
  --exclude='module/__tests__/' --exclude='__mocks__/' --exclude='module/**/__tests__/' \
  --exclude='package.json' --exclude='package-lock.json' --exclude='version.txt' \
  --exclude='CLAUDE.md' --exclude='.editorconfig' --exclude='.gitattributes' \
  --exclude='.gitignore' --exclude='.nvmrc' --exclude='.readthedocs.yaml' \
  --exclude='packs/**/LOCK' \
  ./ "$STAGE/"

# 4. Patch the STAGED system.json only (repo copy stays untouched — these
#    throwaway pre-release URLs never get committed).
node -e '
const fs=require("fs");
const p=process.env.STAGE+"/system.json";
const j=JSON.parse(fs.readFileSync(p,"utf8"));
const base="https://github.com/foundryvtt-dcc/dcc/releases/download/"+process.env.TAG;
j.version=process.env.VER;
j.manifest=base+"/system.json";
j.download=base+"/dcc.zip";
fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
console.log("patched", j.version, j.manifest);
'

# 5. Build dcc.zip with files at the zip root.
( cd "$STAGE" && rm -f /tmp/dcc.zip && zip -rq /tmp/dcc.zip . -x '.*' )

# 6. Sanity-check the zip BEFORE publishing.
unzip -l /tmp/dcc.zip | awk '{print $4}' | grep -qx 'system.json'                         && echo "OK system.json at root"
unzip -l /tmp/dcc.zip | awk '{print $4}' | grep -qx 'module/vendor/dcc-core-lib/index.js' && echo "OK vendored lib present"
unzip -l /tmp/dcc.zip | awk '{print $4}' | grep -qx 'styles/dcc.css'                       && echo "OK compiled css present"
unzip -l /tmp/dcc.zip | awk '{print $4}' | grep -qE 'packs/.*\.ldb$'                        && echo "OK compiled packs present"
[ "$(unzip -l /tmp/dcc.zip | awk '{print $4}' | grep -cE '__tests__|browser-tests|/docs/|node_modules')" = "0" ] && echo "OK no dev cruft"

# 7. Publish the pre-release. The tag is created at the branch tip.
gh release create "$TAG" \
  --repo foundryvtt-dcc/dcc \
  --target "$(git rev-parse --abbrev-ref HEAD)" \
  --prerelease \
  --title "$VER — dcc-core-lib adapter preview" \
  --notes "Pre-release test build off \`$(git rev-parse --abbrev-ref HEAD)\` (commit $(git rev-parse --short HEAD)). Install via Manifest URL: https://github.com/foundryvtt-dcc/dcc/releases/download/$TAG/system.json — requires FoundryVTT v14. Replaces stable DCC in the same data dir (id stays \`dcc\`)." \
  "$STAGE/system.json" /tmp/dcc.zip

# 8. Verify the published assets are reachable (what testers will hit).
curl -sL "https://github.com/foundryvtt-dcc/dcc/releases/download/$TAG/system.json" --max-time 30 \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("version",j.version,"\ndownload",j.download)})'
curl -sL -o /dev/null -w "zip: %{http_code} (%{size_download} bytes)\n" \
  "https://github.com/foundryvtt-dcc/dcc/releases/download/$TAG/dcc.zip" --max-time 60

# 9. Clean up.
rm -rf "$STAGE" /tmp/dcc.zip
```

## Hand-out to testers

```
https://github.com/foundryvtt-dcc/dcc/releases/download/<TAG>/system.json
```

→ Foundry **Game Systems → Install System → Manifest URL** → paste → Install.

## Re-publishing an updated build

Bump the trailing number (`v0.68.0-refactor.2`, `VER=0.68.0-refactor.2`)
and re-run. Because the new version sorts above the previous one, testers
who installed an earlier build get an in-place **Update** offer in Foundry.

## Permissions

Publishing needs `gh` authenticated with write access to
`foundryvtt-dcc/dcc` (the `repo` scope; the maintainers have `ADMIN`).
Check with `gh auth status` and
`gh repo view foundryvtt-dcc/dcc --json viewerPermission`.

## Cleanup / retiring a pre-release

Pre-releases are cheap to delete once a branch merges or a build is
superseded:

```bash
gh release delete v0.68.0-refactor.1 --repo foundryvtt-dcc/dcc --cleanup-tag --yes
```
