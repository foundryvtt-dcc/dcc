#!/usr/bin/env bash
# Read-only scan for /needanything: prints what may be waiting on a human in
# the DCC system repo, its upstream lib, the sibling modules and this checkout,
# one tab-separated line per item. Never labels, comments, merges, publishes
# or pushes. Usage: .claude/skills/needanything/scan.sh
set -euo pipefail
export GH_PAGER=cat

REPO=${REPO:-foundryvtt-dcc/dcc}
LIB_REPO=${LIB_REPO:-moonloch/dcc-core-lib}
# dcc-qol is deliberately absent: it is deprioritised and needs socketlib to test.
SIBLINGS=${SIBLINGS:-"foundryvtt-dcc/xcc foundryvtt-dcc/mcc-classes foundryvtt-dcc/dcc-crawl-classes foundryvtt-dcc/dcc-core-book"}
ME=${ME:-$(gh api user -q .login)}
# jq helper: "3h" under two days, "15d" after. Prepend to any jq program.
AGE='def age(t): ((now - (t | fromdateiso8601)) / 3600 | floor) as $h | if $h < 48 then "\($h)h" else "\($h / 24 | floor)d" end;'


# Issues where someone other than the maintainer spoke last (or opened it and
# nobody answered). Bots don't count as "someone". One line per issue.
awaiting_reply() { # <repo>
  gh issue list -R "$1" --state open --limit 300 \
    --json number,title,labels,author,createdAt,comments \
    | jq -r --arg me "$ME" "$AGE"'
      .[] | (.comments[-1] // null) as $c
      | (if $c == null then .author.login else $c.author.login end) as $who
      | (if $c == null then .createdAt else $c.createdAt end) as $when
      | select($who != $me and ($who | test("\\[bot\\]|^app/|github-actions|dependabot") | not))
      | "#\(.number)\tlast=\($who)\(if $c == null then " (opened, no reply)" else "" end)\t\(age($when)) ago\tlabels=\([.labels[].name] | join(",") | if . == "" then "-" else . end)\t\(.title)"'
}

pr_lines() { # <repo>
  gh pr list -R "$1" --state open --limit 100 \
    --json number,title,isDraft,labels,author,mergeStateStatus,reviewDecision,statusCheckRollup,autoMergeRequest,headRefName,baseRefName,updatedAt,body \
    | jq -r "$AGE"'
      .[]
      | ([.statusCheckRollup[]? | select((.conclusion // .state // "") | test("^(FAILURE|CANCELLED|TIMED_OUT|ERROR|ACTION_REQUIRED)$")) | (.name // .context)]) as $failed
      | ([.statusCheckRollup[]? | select(.status == "IN_PROGRESS" or .status == "QUEUED" or .state == "PENDING" or .state == "EXPECTED")] | length) as $pending
      | ([.statusCheckRollup[]? | select(.context == "E2E (self-hosted)") | .state] | first // "-") as $e2e
      | ([(.body // "") | capture("[Dd]epends on #(?<n>[0-9]+)") | .n] | first // "-") as $dep
      | "#\(.number)\tdraft=\(.isDraft)\tauthor=\(.author.login)\tlabels=\([.labels[].name] | join(",") | if . == "" then "-" else . end)\tmerge=\(.mergeStateStatus)\treview=\(.reviewDecision | if . == "" or . == null then "-" else . end)\tautomerge=\(.autoMergeRequest != null)\tchecks_failed=\($failed | join("|") | if . == "" then "-" else . end)\tchecks_pending=\($pending)\te2e=\($e2e)\tdepends_on=\($dep)\tbranch=\(.headRefName)->\(.baseRefName)\tupdated=\(age(.updatedAt)) ago\t\(.title)"'
}

echo "== OPEN PRS ($REPO) =="
pr_lines "$REPO" | while IFS= read -r line; do
  dep=$(sed -n 's/.*depends_on=\([0-9]*\).*/\1/p' <<<"$line")
  if [ -n "$dep" ]; then
    st=$(gh pr view "$dep" -R "$REPO" --json state -q .state 2>/dev/null || echo UNKNOWN)
    line=${line/depends_on=$dep/depends_on=#$dep($st)}
  fi
  printf '%s\n' "$line"
done
echo

echo "== ISSUES AWAITING A REPLY ($REPO) =="
awaiting_reply "$REPO"
echo
echo "== BUG / FOUNDRY-API-CHANGE ISSUES =="
gh issue list -R "$REPO" --state open --limit 300 --json number,title,labels,createdAt \
  | jq -r '.[] | select([.labels[].name] | (index("bug") or index("foundry-api-change")))
    | "#\(.number)\tlabels=\([.labels[].name] | join(","))\tage=\(((now - (.createdAt | fromdateiso8601)) / 86400 | floor))d\t\(.title)"'
echo
echo "== BACKLOG =="
gh issue list -R "$REPO" --state open --limit 300 --json number,labels \
  | jq -r '"open=\(length)\tlowest=#\(map(.number) | min // "-")\tby_label=\([.[] | .labels[].name] | group_by(.) | map("\(.[0]):\(length)") | join(","))"'
echo

echo "== RELEASE =="
releases=$(gh release list -R "$REPO" --limit 10 --json tagName,isDraft,createdAt)
echo "$releases" | jq -r '.[] | select(.isDraft) | "draft_release=\(.tagName)\tage=\(((now - (.createdAt | fromdateiso8601)) / 3600 | floor))h"'
latest=$(echo "$releases" | jq -r '[.[] | select(.isDraft | not)] | .[0].tagName')
main_version=$(gh api "repos/$REPO/contents/version.txt?ref=main" -q .content | base64 -d | tr -d '[:space:]')
echo "latest_published=$latest	version_txt_on_main=$main_version"
# Feature commits on main that no release carries yet. The bump and the
# release commit themselves don't count.
unreleased=$(gh api "repos/$REPO/compare/$latest...main" \
  -q '.commits[] | .commit.message | split("\n")[0]' \
  | grep -vE '^(Update version\.txt|Release v[0-9])' || true)
echo "unreleased_commits=$(grep -c . <<<"$unreleased" || true)"
[ -n "$unreleased" ] && sed 's/^/  /' <<<"$unreleased"
echo

echo "== NEWEST RUN PER WORKFLOW ON MAIN =="
# A red run on main alerts no one. Release-side failures are the ones that
# bite: a dead "Create GitHub Release" means no draft; a dead "Foundry
# Website Update" after a publish means Foundry's registry never heard of the
# version (install-in-app freezes). See docs/dev/RELEASE_PROCESS.md.
gh run list -R "$REPO" --branch main --limit 80 \
  --json databaseId,workflowName,status,conclusion,createdAt,displayTitle,event \
  | jq -r '
    group_by(.workflowName) | map(sort_by(.createdAt) | reverse | .[0]) | sort_by(.workflowName) | .[]
    | "\(.workflowName)\t\(.status)\t\(.conclusion // "-")\tage=\(((now - (.createdAt | fromdateiso8601)) / 3600 | floor))h\trun=\(.databaseId)\t\(.displayTitle)"'
gh run list -R "$REPO" --branch main --limit 80 --json databaseId,workflowName,status,conclusion,createdAt \
  | jq -r 'group_by(.workflowName) | map(sort_by(.createdAt) | reverse | .[0])
    | .[] | select(.status == "completed" and .conclusion == "failure") | "\(.databaseId)\t\(.workflowName)"' \
  | while IFS=$'\t' read -r id wf; do
      step=$(gh run view "$id" -R "$REPO" --json jobs \
        -q '[.jobs[] | select(.conclusion == "failure") as $j | $j.steps[] | select(.conclusion == "failure") | "\($j.name) › \(.name)"] | first // "-"' 2>/dev/null || echo "-")
      printf 'red_now=%s\trun=%s\tfailed_step=%s\n' "$wf" "$id" "$step"
    done
echo

echo "== CORE LIB ($LIB_REPO) =="
vendored=$(jq -r .version module/vendor/dcc-core-lib/VERSION.json 2>/dev/null || echo "?")
lib_latest=$(gh release list -R "$LIB_REPO" --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || echo "?")
echo "vendored=$vendored	lib_latest=$lib_latest"
echo "-- open lib PRs"
pr_lines "$LIB_REPO" | cut -f1-3,5,8,9,13,14 || true
echo "-- lib issues awaiting a reply"
awaiting_reply "$LIB_REPO"
echo

echo "== SIBLING MODULES =="
for r in $SIBLINGS; do
  prs=$(gh pr list -R "$r" --state open --limit 20 --json number,title,isDraft,author,mergeStateStatus \
    -q '.[] | "PR #\(.number)\tdraft=\(.isDraft)\tauthor=\(.author.login)\tmerge=\(.mergeStateStatus)\t\(.title)"' 2>/dev/null || true)
  issues=$(awaiting_reply "$r" 2>/dev/null || true)
  if [ -n "$prs$issues" ]; then
    echo "-- $r"
    [ -n "$prs" ] && printf '%s\n' "$prs"
    [ -n "$issues" ] && printf '%s\n' "$issues"
  fi
done
echo

echo "== LOCAL CHECKOUT =="
echo "branch=$(git branch --show-current)	dirty_files=$(git status --porcelain | wc -l | tr -d ' ')"
git fetch -q --prune origin 2>/dev/null || true
git for-each-ref --format='%(refname:short)	%(upstream:track)' refs/heads \
  | awk -F'\t' '$2 != "" && $2 != "[gone]" { print "branch=" $1 "\t" $2 }'
gone=$(git for-each-ref --format='%(refname:short)	%(upstream:track)' refs/heads | awk -F'\t' '$2 == "[gone]" { print $1 }' | paste -sd' ' -)
[ -n "$gone" ] && echo "merged_branches_to_delete=$(wc -w <<<"$gone" | tr -d ' ')	$gone"
echo "-- worktrees (pnpm run work:list)"
pnpm run --silent work:list 2>/dev/null || echo "(work:list unavailable)"
