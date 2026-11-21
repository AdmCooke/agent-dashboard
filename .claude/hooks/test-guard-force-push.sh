#!/usr/bin/env bash
# Runs every case in guard-force-push.cases through guard-force-push.sh, then checks that a plain push
# reads the forced refspecs and mirror settings in a repository's git config.
# Usage: bash .claude/hooks/test-guard-force-push.sh   (exit 1 if any case fails)
# GUARD_NO_JQ=1 also runs the blocked cases through the no-jq fallback, which must block them too.
# The config checks leave two small throwaway repositories under the system temp folder.
dir=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$dir/../.." && pwd)
hook=$dir/guard-force-push.sh
pass=0; fail=0

# check WANT CWD COMMAND: run the hook as Claude Code would and compare.
check() {
  local want=$1 cwd=$2 cmd=$3 json code got
  json=$(jq -cn --arg c "$cmd" --arg d "$cwd" '{cwd: $d, tool_input: {command: $c}}')
  env -u GUARD_NO_JQ bash "$hook" <<<"$json" >/dev/null 2>&1
  code=$?
  got=allow; [ "$code" = 2 ] && got=block
  if [ "$got" = "$want" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL want $want, got $got (exit $code): $cmd"; fi
  if [ -n "$GUARD_NO_JQ" ] && [ "$want" = block ]; then
    GUARD_NO_JQ=1 bash "$hook" <<<"$json" >/dev/null 2>&1
    if [ $? = 2 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL no-jq fallback let through: $cmd"; fi
  fi
}

while IFS=$'\t' read -r want cmd; do
  case $want in block|allow) ;; *) continue ;; esac
  check "$want" "$root" "${cmd//<NL>/$'\n'}"
done < "$dir/guard-force-push.cases"

# A plain push uses the remote's configured push refspecs and mirror setting.
forced=$(mktemp -d)
git -C "$forced" init -q && git -C "$forced" config remote.origin.push +HEAD:refs/heads/main
check block "$forced" "git push origin"
check block "$forced" "git push"
check allow "$forced" "git push origin agent/x"
check block "$root" "cd $forced && git push origin"
check block "$root" "git -C $forced push"
mirror=$(mktemp -d)
git -C "$mirror" init -q && git -C "$mirror" config remote.origin.mirror true
check block "$mirror" "git push origin"

echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
