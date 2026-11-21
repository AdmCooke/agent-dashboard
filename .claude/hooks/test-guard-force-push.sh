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
plain=$(repo)
check allow "$root" "git -C $plain push --force-with-lease origin agent/x"
check block "$root" "git -C /nonexistent/repo push origin agent/x"
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

# A symbolic ref named agent/* can point at another branch.
sym=$(repo); git -C "$sym" symbolic-ref refs/heads/agent/sneaky refs/heads/main
check block "$sym" "git push --force-with-lease origin agent/sneaky"
# A legacy .git/remotes file can carry forced push lines.
legacy=$(repo); mkdir -p "$legacy/.git/remotes"; printf 'URL: ../bare.git\nPush: +refs/heads/main:refs/heads/main\n' > "$legacy/.git/remotes/gh"
check block "$legacy" "git push gh"
# A forced push refspec in config, with no force flag on the command line.
cfgforce=$(repo); git -C "$cfgforce" config remote.origin.push +refs/heads/agent/x:refs/heads/main
check block "$cfgforce" "git push origin agent/x"
# With no origin, git falls back to the only remote.
single=$(repo); git -C "$single" remote add gh ../bare.git; git -C "$single" config remote.gh.push +refs/heads/main:refs/heads/main
check block "$single" "git push"
# Aliases: quoted, nested, read from the -C repo, and run through a symlink to git.
aliased=$(repo)
git -C "$aliased" config alias.q "pu'sh'"; git -C "$aliased" config alias.x y; git -C "$aliased" config alias.y push
check block "$root" "git -C $aliased q -f origin main"
check block "$root" "git -C $aliased x -f origin main"
links=$(mktemp -d); ln -s "$(command -v git)" "$links/g"
check block "$root" "$links/g push -f origin main"
# Known gap, no-reader mode only (neither jq nor python3): a symlinked git running a pushing alias has no
# text to catch, so this one is checked with jq and python3 only.
json=$(jq -cn --arg c "$links/g -C $aliased x -f origin main" --arg d "$root" '{cwd: $d, tool_input: {command: $c}}')
for mode in jq py; do
  run $mode "$json"; got=$(verdict $?)
  if [ "$got" = block ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL [$mode] symlinked git alias let through"; fi
done
# Globs that expand to git or git-push.
check block "$root" "$(dirname "$(command -v git)")/g?t push -f origin main"
check block "$root" "$(git --exec-path)/git-pus? -f origin main"

# Input the JSON readers can't decode (a lone surrogate) must fail closed.
raw='{"cwd":"/tmp","tool_input":{"command":"git push -f origin main \ud800"}}'
for mode in jq py none; do
  run $mode "$raw"; got=$(verdict $?)
  if [ "$got" = block ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL [$mode] unreadable input let through"; fi
done

# Write and Edit must not change a git config file.
for f in "$root/.git/config" "$HOME/.gitconfig" "$HOME/.config/git/config" /etc/gitconfig "$root/.git/config.worktree" "$root/.GIT/config" "$root/.git//config" "$root/.git/hooks/pre-push"; do
  json=$(jq -cn --arg f "$f" '{tool_input: {file_path: $f, content: "x"}}')
  run jq "$json"; got=$(verdict $?)
  if [ "$got" = block ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL Write/Edit allowed: $f"; fi
done
json=$(jq -cn --arg f "$root/README.md" '{tool_input: {file_path: $f, content: "x"}}')
run jq "$json"; got=$(verdict $?)
if [ "$got" = allow ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL Write/Edit blocked README.md"; fi

echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
