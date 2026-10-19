#!/usr/bin/env bash
# Starts one ephemeral runner: register, take exactly one job, exit. Docker's
# restart policy brings the container back for the next job.
#
# Runs as root only long enough to wipe the work volume and mint a
# registration token, then drops to `runner` with a scrubbed environment, so
# the PAT never reaches a job (root's /proc/<pid>/environ is unreadable to
# `runner`, and the exec below replaces this process).
set -euo pipefail

: "${GH_RUNNER_PAT:?set GH_RUNNER_PAT (fine-grained PAT, Administration: read/write on the repo)}"
GH_REPO="${GH_REPO:-foundryvtt-dcc/dcc}"
RUNNER_NAME="${RUNNER_NAME:-dcc-e2e-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-dcc-e2e}"

# Fresh state for every job. The root filesystem is read-only and /tmp is a
# tmpfs, so /work is the only place a previous job could have left anything.
find /work -mindepth 1 -delete
mkdir -p /work/runner /work/home /work/_work
cp -a /home/runner/. /work/runner/
chown -R runner:runner /work

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
  FOUNDRY_PATH=/opt/foundryvtt
  DCC_FOUNDRY_USERDATA=/opt/foundry-userdata
  DCC_E2E_PORT="${DCC_E2E_PORT:-30100}"
  DCC_E2E_SKIP_BROWSER_INSTALL=1
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
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

exec "${as_runner[@]}" ./run.sh
