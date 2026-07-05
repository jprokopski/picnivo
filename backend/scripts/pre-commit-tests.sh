#!/usr/bin/env bash
set -e

staged_cs=$(git diff --cached --name-only --diff-filter=ACM | grep '^backend/.*\.cs$' || true)

if [ -z "$staged_cs" ]; then
  exit 0
fi

run_full=0
tokens_file=$(mktemp)
trap 'rm -f "$tokens_file"' EXIT

while IFS= read -r file; do
  [ -z "$file" ] && continue
  after_features="${file#*/Features/}"
  if [ "$after_features" = "$file" ]; then
    # No "Features/<Area>/<Action>/" segment in the path — cross-cutting change.
    run_full=1
    continue
  fi
  area="${after_features%%/*}"
  rest="${after_features#*/}"
  action="${rest%%/*}"
  if [ -z "$area" ] || [ -z "$action" ] || [ "$action" = "$rest" ]; then
    run_full=1
    continue
  fi
  echo "Features.${area}.${action}" >>"$tokens_file"
done <<<"$staged_cs"

cd "$(dirname "$0")/.."

echo "Backend pre-commit gate: building test project..."
dotnet build Picnivo.Tests

if [ "$run_full" = "1" ] || [ ! -s "$tokens_file" ]; then
  echo "Backend pre-commit gate: cross-cutting change staged, running full backend suite."
  dotnet test Picnivo.Tests --no-build --no-restore
else
  filter_expr=$(sort -u "$tokens_file" | sed 's/^/FullyQualifiedName~/' | paste -sd'|' -)
  echo "Backend pre-commit gate: running scoped slices -> $filter_expr"
  dotnet test Picnivo.Tests --no-build --no-restore --filter "$filter_expr"
fi
