#!/usr/bin/env bash
# Starts one ephemeral runner: provision, register, take exactly one job,
# exit. Docker's restart policy brings the container back for the next job.
#
# Runs as root only long enough to wipe the work volume, refresh the cached
# Foundry build and dcc-core-book, and mint a registration token. It then
# drops to `runner` with a scrubbed environment, so the PAT never reaches a
# job (root's /proc/<pid>/environ is unreadable to `runner`, and the exec
# below replaces this process). /cache is root-owned: jobs can read it but
# not change what the next job gets.
set -euo pipefail

: "${GH_RUNNER_PAT:?set GH_RUNNER_PAT (fine-grained PAT: Administration read/write on dcc, Contents read on dcc-core-book)}"
GH_REPO="${GH_REPO:-foundryvtt-dcc/dcc}"
CORE_BOOK_REPO="${CORE_BOOK_REPO:-foundryvtt-dcc/dcc-core-book}"
RUNNER_NAME="${RUNNER_NAME:-dcc-e2e-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-dcc-e2e}"
FELDDY=/mnt/felddy   # felddy/foundryvtt's /data volume, mounted read-only

log() { echo "[e2e-runner] $*"; }

# --- Fresh work area -------------------------------------------------------
# The root filesystem is read-only and /tmp is a tmpfs, so /work is the only
# place a previous job could have left anything.
find /work -mindepth 1 -delete
mkdir -p /work/runner /work/home /work/_work /work/userdata/Config /work/userdata/Data
cp -a /home/runner/. /work/runner/
mkdir -p /cache/foundry /cache/modules /cache/root-home /cache/pw-browsers

# --- Foundry build, from felddy's download cache ---------------------------
zip="${FOUNDRY_VERSION:+$FELDDY/container_cache/foundryvtt-$FOUNDRY_VERSION.zip}"
if [ -z "$zip" ]; then
  zip=$(ls "$FELDDY"/container_cache/foundryvtt-*.zip 2>/dev/null | sort -V | tail -n1 || true)
fi
[ -n "$zip" ] && [ -f "$zip" ] || {
  echo "No Foundry zip in $FELDDY/container_cache (set FOUNDRY_VERSION, and make sure felddy's CONTAINER_CACHE is on)" >&2
  exit 1
}
version=$(basename "$zip" .zip | sed 's/^foundryvtt-//')
foundry_dir="/cache/foundry/$version"
if [ ! -d "$foundry_dir" ]; then
  log "Unpacking Foundry $version"
  rm -rf /cache/foundry/.unpack && mkdir -p /cache/foundry/.unpack
  unzip -q "$zip" -d /cache/foundry/.unpack
  mv /cache/foundry/.unpack "$foundry_dir"
fi
find /cache/foundry -mindepth 1 -maxdepth 1 ! -name "$version" -exec rm -rf {} +
# Older zips nest the app under resources/app
[ -f "$foundry_dir/main.js" ] || foundry_dir="$foundry_dir/resources/app"
[ -f "$foundry_dir/main.js" ] || { echo "No main.js in the unpacked Foundry $version" >&2; exit 1; }

# --- Playwright browsers, matching main's lockfile ------------------------
# Dependabot auto-merges @playwright/test bumps, so the version comes from
# main rather than the image. A PR that bumps Playwright itself fails until
# it lands on main and the runner restarts.
pw_version=$(curl -fsSL "https://raw.githubusercontent.com/${GH_REPO}/main/pnpm-lock.yaml" \
  | sed -nE "s/^  '?@playwright\/test@([0-9][^:']*)'?:.*/\1/p" | head -n1)
[ -n "$pw_version" ] || { echo "Could not read @playwright/test's version from main's pnpm-lock.yaml" >&2; exit 1; }
pw_dir="/cache/pw-browsers/$pw_version"
if [ ! -d "$pw_dir" ]; then
  log "Installing Playwright $pw_version browsers"
  rm -rf /cache/pw-browsers/.install
  HOME=/cache/root-home PLAYWRIGHT_BROWSERS_PATH=/cache/pw-browsers/.install \
    npm exec --yes "playwright@${pw_version}" -- install chromium chromium-headless-shell
  mv /cache/pw-browsers/.install "$pw_dir"
fi
find /cache/pw-browsers -mindepth 1 -maxdepth 1 ! -name "$pw_version" -exec rm -rf {} +

# --- License ---------------------------------------------------------------
cp "$FELDDY/Config/license.json" /work/userdata/Config/license.json

# --- dcc-core-book, cloned and compiled ------------------------------------
auth="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_RUNNER_PAT" | base64 -w0)"
src=/cache/core-book-src
if [ -d "$src/.git" ]; then
  git -C "$src" -c http.extraHeader="$auth" fetch -q --depth=1 origin main
  git -C "$src" reset -q --hard FETCH_HEAD
else
  rm -rf "$src"
  git -c http.extraHeader="$auth" clone -q --depth=1 --branch main "https://github.com/${CORE_BOOK_REPO}.git" "$src"
fi
unset auth
head=$(git -C "$src" rev-parse HEAD)
if [ "$(cat /cache/modules/.core-book-head 2>/dev/null)" != "$head" ]; then
  log "Compiling dcc-core-book $head"
  # dcc-core-book's install scripts never see the PAT.
  (cd "$src" && export HOME=/cache/root-home CI=true && unset GH_RUNNER_PAT &&
    pnpm install --frozen-lockfile && pnpm run todb)
  rsync -a --delete --exclude .git --exclude node_modules "$src/" /cache/modules/dcc-core-book/
  echo "$head" > /cache/modules/.core-book-head
fi

chown -R runner:runner /work

# --- Register and run ------------------------------------------------------
token=$(curl -fsSL -X POST \
  -H "Authorization: Bearer ${GH_RUNNER_PAT}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GH_REPO}/actions/runners/registration-token" | jq -r .token)
[ -n "$token" ] && [ "$token" != "null" ] || { echo "Could not get a registration token" >&2; exit 1; }

# Everything a job runs inherits exactly this environment.
as_runner=(env -i
  HOME=/work/home
  PATH=/usr/local/bin:/usr/bin:/bin
  LANG=C.UTF-8
  FOUNDRY_PATH="$foundry_dir"
  DCC_FOUNDRY_USERDATA=/work/userdata
  DCC_MODULE_SOURCE=/cache/modules
  DCC_E2E_PORT="${DCC_E2E_PORT:-30100}"
  DCC_E2E_SKIP_BROWSER_INSTALL=1
  PLAYWRIGHT_BROWSERS_PATH="$pw_dir"
  setpriv --reuid=runner --regid=runner --init-groups --no-new-privs --)

cd /work/runner
"${as_runner[@]}" ./config.sh \
  --url "https://github.com/${GH_REPO}" \
  --token "$token" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work /work/_work \
  --ephemeral --unattended --replace --disableupdate
unset token GH_RUNNER_PAT

log "Runner up (Foundry $version, dcc-core-book ${head:0:7}, Playwright $pw_version)"
exec "${as_runner[@]}" ./run.sh
