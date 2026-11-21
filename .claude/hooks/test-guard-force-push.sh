#!/usr/bin/env bash
# Runs every case in guard-force-push.cases through guard-force-push.sh in three modes: with jq, with
# python3 only (both must give the same answer for every case), and with no JSON reader at all (every
# blocked case must still be blocked). Then checks that pushes read the git config that decides where
# they go, and that Write/Edit can't edit a git config file.
# Usage: bash .claude/hooks/test-guard-force-push.sh   (exit 1 if any check fails)
# The config checks leave a few small throwaway repositories under the system temp folder.
dir=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$dir/../.." && pwd)
hook=$dir/guard-force-push.sh
pass=0; fail=0

run() {  # run MODE JSON: exit code of the hook in that mode
  case $1 in
    jq) env -u GUARD_NO_JQ -u GUARD_NO_PY bash "$hook" <<<"$2" >/dev/null 2>&1 ;;
    py) GUARD_NO_JQ=1 bash "$hook" <<<"$2" >/dev/null 2>&1 ;;
    none) GUARD_NO_JQ=1 GUARD_NO_PY=1 bash "$hook" <<<"$2" >/dev/null 2>&1 ;;
  esac
}
verdict() { [ "$1" = 2 ] && echo block || echo allow; }

# check WANT CWD COMMAND
check() {
  local want=$1 json got mode
  json=$(jq -cn --arg c "$3" --arg d "$2" '{cwd: $d, tool_input: {command: $c}}')
  for mode in jq py; do
    run $mode "$json"; got=$(verdict $?)
    if [ "$got" = "$want" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL [$mode] want $want, got $got: $3"; fi
  done
  if [ "$want" = block ]; then
    run none "$json"; got=$(verdict $?)
    if [ "$got" = block ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL [no reader] let through: $3"; fi
  fi
}

while IFS=$'\t' read -r want cmd; do
  case $want in block|allow) ;; *) continue ;; esac
  check "$want" "$root" "${cmd//<NL>/$'\n'}"
done < "$dir/guard-force-push.cases"

# Pushes read the remote's push refspecs, its mirror setting, push.default and the push remote.
repo() { local d; d=$(mktemp -d); git -C "$d" init -q -b agent/topic; echo "$d"; }
forced=$(repo); git -C "$forced" config remote.origin.push +HEAD:refs/heads/main
check block "$forced" "git push origin"
check block "$forced" "git push"
check allow "$forced" "git push origin agent/x:agent/x"
check block "$forced" "git push --force-with-lease origin agent/x"
check block "$root" "cd $forced && git push origin"
check block "$root" "git -C $forced push"
mapped=$(repo); git -C "$mapped" config remote.origin.push refs/heads/agent/x:refs/heads/main
check block "$mapped" "git push --force-with-lease origin agent/x"
check allow "$mapped" "git push --force-with-lease origin agent/x:agent/x"
upstream=$(repo); git -C "$upstream" config push.default upstream
check block "$upstream" "git push --force-with-lease origin agent/topic"
check allow "$upstream" "git push --force-with-lease origin agent/topic:agent/topic"
mirror=$(repo); git -C "$mirror" config remote.origin.mirror true
check block "$mirror" "git push origin"
pushdefault=$(repo); git -C "$pushdefault" config remote.backup.mirror true; git -C "$pushdefault" config remote.pushDefault backup
check block "$pushdefault" "git push"

# Write and Edit must not change a git config file.
for f in "$root/.git/config" "$HOME/.gitconfig" "$HOME/.config/git/config"; do
  json=$(jq -cn --arg f "$f" '{tool_input: {file_path: $f, content: "x"}}')
  run jq "$json"; got=$(verdict $?)
  if [ "$got" = block ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL Write/Edit allowed: $f"; fi
done
json=$(jq -cn --arg f "$root/README.md" '{tool_input: {file_path: $f, content: "x"}}')
run jq "$json"; got=$(verdict $?)
if [ "$got" = allow ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL Write/Edit blocked README.md"; fi

echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
