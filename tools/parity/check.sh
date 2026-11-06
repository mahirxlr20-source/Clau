#!/usr/bin/env bash
# Checks that the app's planner engine gives exactly the same results as the HTML
# planners: CGPA, credits, every row's status and unlock check, standing, gateways,
# and every log-sheet and calculator formula, on a filled-in test state.
#
#   tools/parity/check.sh <folder with the planner HTML files>
#
# Needs Node 22, Playwright with Chromium, and npx (it runs tsx).
set -u
dir=$(cd "$(dirname "$0")" && pwd); pass=0; fail=0
while IFS= read -r f; do
  id=$(grep -o '"product":{"id":"[^"]*"' "$f" | head -1 | sed 's/.*"id":"//;s/"//')
  (cd "$dir" && npx --yes tsx@4 ts-side.ts "$id") > /tmp/tabula-ts.json
  node "$dir/html-side.cjs" "$f" "$dir/state.mjs" > /tmp/tabula-html.json
  if node -e '
    const a=require("/tmp/tabula-ts.json"), b=require("/tmp/tabula-html.json"); delete a.parts;
    for (const k of Object.keys(b)) if (JSON.stringify(a[k])!==JSON.stringify(b[k])) { console.log("  differs:", k); process.exitCode=1 }'; then
    echo "MATCH $id"; pass=$((pass+1)); else echo "DIFF  $id"; fail=$((fail+1)); fi
done < <(find "$1" -name '*-Planner_*.html' | sort)
echo "pass=$pass fail=$fail"; [ "$fail" -eq 0 ]
