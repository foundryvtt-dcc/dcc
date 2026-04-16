#!/usr/bin/env bash
# merge-main-into-v14-org.sh
#
# Merges the main/default branch into the v14 branch across every repo in the
# foundryvtt-dcc GitHub org that ships a module.json or system.json (i.e.
# every FoundryVTT module or system).
#
# Goal: coordinate a V14 compatibility release across the whole ecosystem so
# the modules go out at roughly the same time. The DCC system itself is
# excluded by default so it can be released LAST after the modules land.
#
# Behavior:
#   - Never aborts on a single repo failure; failures are collected and
#     reported in a summary at the end.
#   - Only pushes if the merge succeeded and actually advanced the v14 branch.
#   - Supports --dry-run to preview without merging or pushing.
#
# Requirements:
#   - gh CLI authenticated against github.com (gh auth status)
#   - git 2.30+
#   - jq
#
# Usage:
#   scripts/merge-main-into-v14-org.sh                   # merge + push
#   scripts/merge-main-into-v14-org.sh --dry-run         # preview only
#   scripts/merge-main-into-v14-org.sh --include-dcc     # include the system
#   scripts/merge-main-into-v14-org.sh --org other-org   # different org
#   scripts/merge-main-into-v14-org.sh --v14 v14         # alternate v14 branch
#
# Environment:
#   ORG              org name (default: foundryvtt-dcc)
#   V14_BRANCH       branch name to merge into (default: auto-detect
#                    feature/v14 then v14)
#   MAIN_BRANCH      branch to merge from (default: repo default branch)
#   WORKDIR          working directory for clones (default: mktemp)
#   KEEP_WORKDIR     if set, do not delete WORKDIR on exit

set -u
set -o pipefail

ORG="${ORG:-foundryvtt-dcc}"
V14_BRANCH_OVERRIDE="${V14_BRANCH:-}"
MAIN_BRANCH_OVERRIDE="${MAIN_BRANCH:-}"
WORKDIR="${WORKDIR:-}"
KEEP_WORKDIR="${KEEP_WORKDIR:-}"

DRY_RUN=0
INCLUDE_DCC=0
# DCC system repo is excluded by default — released last, separately.
EXCLUDE_REPOS=("dcc")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)      DRY_RUN=1; shift ;;
    --include-dcc)  INCLUDE_DCC=1; shift ;;
    --org)          ORG="$2"; shift 2 ;;
    --v14)          V14_BRANCH_OVERRIDE="$2"; shift 2 ;;
    --main)         MAIN_BRANCH_OVERRIDE="$2"; shift 2 ;;
    --workdir)      WORKDIR="$2"; shift 2 ;;
    --keep-workdir) KEEP_WORKDIR=1; shift ;;
    --exclude)      EXCLUDE_REPOS+=("$2"); shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$INCLUDE_DCC" -eq 1 ]]; then
  EXCLUDE_REPOS=("${EXCLUDE_REPOS[@]/dcc}")
fi

for cmd in gh git jq; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $cmd" >&2
    exit 1
  }
done

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

if [[ -z "$WORKDIR" ]]; then
  WORKDIR="$(mktemp -d -t v14-merge-XXXXXX)"
fi
mkdir -p "$WORKDIR"

cleanup() {
  if [[ -z "$KEEP_WORKDIR" ]]; then
    rm -rf "$WORKDIR"
  else
    echo "Keeping working directory: $WORKDIR"
  fi
}
trap cleanup EXIT

# Arrays of outcome summaries. Each entry is "repo<TAB>detail".
SUCCESS=()       # merge completed and pushed (or was already up to date)
ALREADY_MERGED=()
SKIPPED_NO_MANIFEST=()
SKIPPED_NO_V14=()
SKIPPED_EXCLUDED=()
FAILED_CONFLICT=()
FAILED_OTHER=()

is_excluded() {
  local name="$1"
  local excluded
  for excluded in "${EXCLUDE_REPOS[@]}"; do
    [[ "$name" == "$excluded" ]] && return 0
  done
  return 1
}

# Fetch all non-archived, non-fork repos in the org.
echo "Listing repos in $ORG ..."
mapfile -t REPOS < <(gh repo list "$ORG" --limit 1000 --no-archived --source \
  --json name,defaultBranchRef,isFork \
  --jq '.[] | select(.isFork==false) | "\(.name)\t\(.defaultBranchRef.name // "main")"')

if [[ ${#REPOS[@]} -eq 0 ]]; then
  echo "ERROR: no repos found in $ORG (check permissions)." >&2
  exit 1
fi

echo "Found ${#REPOS[@]} repos. Processing..."
echo

process_repo() {
  local name="$1"
  local default_branch="$2"
  local repo="$ORG/$name"
  local repo_dir="$WORKDIR/$name"

  echo "=== $repo ==="

  if is_excluded "$name"; then
    echo "  SKIP: in exclude list"
    SKIPPED_EXCLUDED+=("$name	excluded")
    return 0
  fi

  # Quickly check for module.json / system.json via the API before cloning.
  local has_manifest=0
  local path
  for path in module.json system.json; do
    if gh api "repos/$repo/contents/$path" >/dev/null 2>&1; then
      has_manifest=1
      break
    fi
  done
  if [[ "$has_manifest" -eq 0 ]]; then
    echo "  SKIP: no module.json/system.json"
    SKIPPED_NO_MANIFEST+=("$name	no manifest")
    return 0
  fi

  local main_branch="${MAIN_BRANCH_OVERRIDE:-$default_branch}"

  # Clone (shallow-ish — full history keeps merges sane, avoid --depth).
  if ! git clone --quiet "https://github.com/$repo.git" "$repo_dir" 2>/tmp/v14-clone-err; then
    echo "  FAIL: git clone"
    FAILED_OTHER+=("$name	clone: $(cat /tmp/v14-clone-err | tr '\n' ' ' | head -c 200)")
    return 0
  fi

  pushd "$repo_dir" >/dev/null

  # Pick the v14 branch: explicit override, else feature/v14, else v14.
  local v14_branch=""
  if [[ -n "$V14_BRANCH_OVERRIDE" ]]; then
    if git ls-remote --exit-code --heads origin "$V14_BRANCH_OVERRIDE" >/dev/null 2>&1; then
      v14_branch="$V14_BRANCH_OVERRIDE"
    fi
  else
    local candidate
    for candidate in feature/v14 v14; do
      if git ls-remote --exit-code --heads origin "$candidate" >/dev/null 2>&1; then
        v14_branch="$candidate"
        break
      fi
    done
  fi

  if [[ -z "$v14_branch" ]]; then
    echo "  SKIP: no v14 branch found"
    SKIPPED_NO_V14+=("$name	no v14 branch")
    popd >/dev/null
    return 0
  fi

  # Ensure main branch is reachable.
  if ! git ls-remote --exit-code --heads origin "$main_branch" >/dev/null 2>&1; then
    echo "  FAIL: main branch '$main_branch' not found"
    FAILED_OTHER+=("$name	main branch '$main_branch' missing")
    popd >/dev/null
    return 0
  fi

  git fetch --quiet origin "$main_branch" "$v14_branch"
  git checkout --quiet -B "$v14_branch" "origin/$v14_branch"

  # Check whether main is already merged into v14.
  local main_sha v14_sha
  main_sha="$(git rev-parse "origin/$main_branch")"
  v14_sha="$(git rev-parse "origin/$v14_branch")"
  if git merge-base --is-ancestor "$main_sha" "$v14_sha"; then
    echo "  OK: $v14_branch already contains $main_branch"
    ALREADY_MERGED+=("$name	$v14_branch already contains $main_branch")
    popd >/dev/null
    return 0
  fi

  # Attempt the merge. We use --no-ff so we always get a clean merge commit
  # that's easy to revert if something later goes wrong.
  local merge_msg="Merge branch '$main_branch' into $v14_branch"
  if ! git merge --no-ff --no-edit -m "$merge_msg" "origin/$main_branch" >/tmp/v14-merge-out 2>&1; then
    if git status --porcelain | grep -qE '^(UU|AA|DD|AU|UA|DU|UD) '; then
      echo "  FAIL: merge conflict"
      FAILED_CONFLICT+=("$name	conflicts: $(git diff --name-only --diff-filter=U | tr '\n' ' ')")
      git merge --abort 2>/dev/null || true
    else
      echo "  FAIL: merge error"
      FAILED_OTHER+=("$name	merge: $(tail -c 300 /tmp/v14-merge-out | tr '\n' ' ')")
      git merge --abort 2>/dev/null || true
    fi
    popd >/dev/null
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  DRY-RUN: merged locally; not pushing"
    SUCCESS+=("$name	merged (dry-run, not pushed)")
    popd >/dev/null
    return 0
  fi

  if ! git push --quiet origin "$v14_branch" 2>/tmp/v14-push-err; then
    echo "  FAIL: push"
    FAILED_OTHER+=("$name	push: $(cat /tmp/v14-push-err | tr '\n' ' ' | head -c 200)")
    popd >/dev/null
    return 0
  fi

  echo "  OK: merged $main_branch -> $v14_branch and pushed"
  SUCCESS+=("$name	pushed $v14_branch")
  popd >/dev/null
  return 0
}

for entry in "${REPOS[@]}"; do
  name="${entry%%$'\t'*}"
  default_branch="${entry#*$'\t'}"
  [[ -z "$name" ]] && continue
  process_repo "$name" "$default_branch"
done

print_section() {
  local title="$1"; shift
  local -a items=("$@")
  if [[ ${#items[@]} -eq 0 ]]; then
    return
  fi
  echo
  echo "### $title (${#items[@]})"
  for item in "${items[@]}"; do
    printf '  - %s\n' "$item" | tr '\t' ' '
  done
}

echo
echo "============================================================"
echo "V14 merge summary ($ORG)"
echo "============================================================"
echo "  Pushed:          ${#SUCCESS[@]}"
echo "  Already merged:  ${#ALREADY_MERGED[@]}"
echo "  No manifest:     ${#SKIPPED_NO_MANIFEST[@]}"
echo "  No v14 branch:   ${#SKIPPED_NO_V14[@]}"
echo "  Excluded:        ${#SKIPPED_EXCLUDED[@]}"
echo "  Merge conflicts: ${#FAILED_CONFLICT[@]}"
echo "  Other failures:  ${#FAILED_OTHER[@]}"

print_section "Pushed"            "${SUCCESS[@]:-}"
print_section "Already merged"    "${ALREADY_MERGED[@]:-}"
print_section "Merge conflicts"   "${FAILED_CONFLICT[@]:-}"
print_section "Other failures"    "${FAILED_OTHER[@]:-}"
print_section "Skipped: no v14"   "${SKIPPED_NO_V14[@]:-}"
print_section "Skipped: excluded" "${SKIPPED_EXCLUDED[@]:-}"

total_failed=$(( ${#FAILED_CONFLICT[@]} + ${#FAILED_OTHER[@]} ))
if [[ "$total_failed" -gt 0 ]]; then
  echo
  echo "$total_failed repo(s) need manual attention."
  exit 1
fi
echo
echo "All eligible repos merged successfully."
