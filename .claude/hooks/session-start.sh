#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Deterministic install from pnpm-lock.yaml: --frozen-lockfile never rewrites
# the lockfile and fails if it's out of sync with package.json, which is the
# desired failure mode in an ephemeral session.
pnpm install --frozen-lockfile
