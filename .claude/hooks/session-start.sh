#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Use `npm ci` for a deterministic install from package-lock.json: it never
# rewrites the lockfile (unlike `npm install`, which can reconcile it and leave
# stray churn in the working tree). Requires the lockfile to be in sync, which
# is the desired failure mode in an ephemeral session.
npm ci --no-audit --no-fund
