#!/usr/bin/env bash
# Runs every case in guard-force-push.cases through guard-force-push.sh.
# Usage: bash .claude/hooks/test-guard-force-push.sh   (exit 1 if any case fails)
# GUARD_NO_JQ=1 also runs the cases through the no-jq fallback, which must block
# every force push it can't read.
dir=$(cd "$(dirname "$0")" && pwd)
hook=$dir/guard-force-push.sh
pass=0; fail=0
while IFS=$'\t' read -r want cmd; do
  case $want in block|allow) ;; *) continue ;; esac
  json=$(jq -cn --arg c "$cmd" '{tool_input: {command: $c}}')
  env -u GUARD_NO_JQ bash "$hook" <<<"$json" >/dev/null 2>&1
  code=$?
  got=allow; [ "$code" = 2 ] && got=block
  if [ "$got" = "$want" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL want $want, got $got (exit $code): $cmd"; fi
  if [ -n "$GUARD_NO_JQ" ] && [ "$want" = block ]; then
    GUARD_NO_JQ=1 bash "$hook" <<<"$json" >/dev/null 2>&1
    if [ $? = 2 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL no-jq fallback let through: $cmd"; fi
  fi
done < "$dir/guard-force-push.cases"
echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
