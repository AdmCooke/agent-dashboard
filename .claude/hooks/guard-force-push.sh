#!/usr/bin/env bash
# Blocks a git force push unless every destination is an agent/ branch named in the command.
# Permission patterns can't see where a src:dst refspec lands, so this reads the command itself.
# Every form it must handle is in guard-force-push.cases. Run test-guard-force-push.sh after any change.
# Limits: it reads the command text only, so a force push inside a script file or a git alias
# gets past it. Bash 3.2 compatible (macOS).
input=$(cat)
block() {
  echo "Blocked: $1 Agents may force-push only to agent/ branches they created (PLAYBOOK.md)." >&2
  exit 2
}

if [ -n "$GUARD_NO_JQ" ] || ! command -v jq >/dev/null 2>&1; then
  # Without jq the command can't be read safely, so anything that looks like a force push is blocked.
  if grep -q 'push' <<<"$input" &&
     grep -Eq -- '--force|--mirror|(^|[[:space:]"])-[[:alnum:]]*f|[[:space:]"'\'']\+' <<<"$input"; then
    block "jq is not installed, so this guard can't read the command. Install jq."
  fi
  exit 0
fi
cmd=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null)

# One simple command per line: split on newlines, ;, &&, || and |. 2>&1 and &> are redirections, not splits.
cmd=${cmd//>&/>}; cmd=${cmd//&>/>}
cmd=${cmd//&&/$'\n'}; cmd=${cmd//||/$'\n'}
cmd=${cmd//;/$'\n'}; cmd=${cmd//|/$'\n'}; cmd=${cmd//&/$'\n'}

while IFS= read -r seg; do
  case $seg in *push*) ;; *) continue ;; esac
  # The shell rewrites these after this hook reads the text, so a destination using them can't be checked.
  expands=0
  case $seg in *'$'*|*'`'*|*'{'*|*'\'*) expands=1 ;; esac
  seg=${seg//[\"\'()\`]/ }
  read -ra w <<<"$seg"
  n=${#w[@]}

  # Find git (or a variable standing in for it) whose subcommand is push.
  start=-1; i=0
  while [ $i -lt $n ]; do
    t=${w[$i]}; t=${t#\\}
    if [ "${t##*/}" = git ] || [[ $t == *'$'* ]]; then
      j=$((i + 1))
      while [ $j -lt $n ]; do
        case ${w[$j]} in
          -C|-c|--git-dir|--work-tree|--namespace|--config-env|--super-prefix) j=$((j + 2)) ;;
          -*) j=$((j + 1)) ;;
          *) break ;;
        esac
      done
      if [ "${w[$j]}" = push ]; then start=$((j + 1)); break; fi
    fi
    i=$((i + 1))
  done
  [ $start -ge 0 ] || continue

  force=0; mirror=0; many=0; remote=; refs=()
  j=$start
  while [ $j -lt $n ]; do
    a=${w[$j]}
    case $a in
      -o|--push-option|--repo|--receive-pack|--exec) j=$((j + 1)) ;;
      [0-9]'>'*|'>'*|[0-9]'<'*|'<'*) case $a in *'>'|*'<') j=$((j + 1)) ;; esac ;;   # redirection, and its file
      --force|--force-with-lease|--force-with-lease=*|--force-if-includes) force=1 ;;
      --mirror) mirror=1 ;;
      --all|--branches|--tags) many=1 ;;
      --*) ;;
      -*f*) force=1 ;;
      -*) ;;
      *) if [ -z "$remote" ]; then remote=$a; else refs+=("$a"); fi ;;
    esac
    j=$((j + 1))
  done
  for r in "${refs[@]}"; do [[ $r == +* ]] && force=1; done

  [ $mirror = 1 ] && block "git push --mirror can overwrite every branch on the remote."
  [ $force = 1 ] || continue
  [ $expands = 1 ] && block "this force push uses \$, backticks, braces or a backslash, so its real destination can't be checked. Write the branch name out."
  [ $many = 1 ] && block "a force push with --all, --branches or --tags reaches branches other than agent/."
  [ ${#refs[@]} -eq 0 ] && block "this force push names no branch, so where it lands depends on the checkout and config. Name the agent/ branch explicitly."
  for r in "${refs[@]}"; do
    dst=${r#+}; dst=${dst##*:}; dst=${dst#refs/heads/}
    [[ $dst == agent/?* ]] || block "force push to '$dst'."
  done
done <<<"$cmd"
exit 0
