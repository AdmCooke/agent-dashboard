#!/usr/bin/env bash
# Blocks a force push unless every destination is an agent/ branch.
# Permission patterns can't see where a src:dst refspec lands, so this checks it.
# shortcut: reads the first `git push` in the command only, upgrade if agents chain several pushes.
cmd=$(jq -r '.tool_input.command // empty')
# Allows git options before push, including ones with a value (git -C dir push).
push=$(grep -oE 'git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+push([[:space:]][^;&|]*)?' <<<"$cmd" | head -1)
[ -z "$push" ] && exit 0

read -ra words <<<"${push#*push}"
force=0; remote=; refspecs=()
for w in "${words[@]}"; do
  case $w in
    --force|--force-with-lease|--force-with-lease=*|--force-if-includes|-f) force=1 ;;
    -*) ;;
    *) if [ -z "$remote" ]; then remote=$w; else refspecs+=("$w"); fi ;;
  esac
done
for r in "${refspecs[@]}"; do [[ $r == +* ]] && force=1; done
[ "$force" = 1 ] || exit 0

# No refspec pushes the current branch.
[ ${#refspecs[@]} -eq 0 ] && refspecs=("$(git rev-parse --abbrev-ref HEAD 2>/dev/null)")
for r in "${refspecs[@]}"; do
  dst=${r#+}; dst=${dst##*:}; dst=${dst#refs/heads/}
  if [[ $dst != agent/?* ]]; then
    echo "Blocked: force push to '$dst'. Agents may force-push only to agent/ branches they created (PLAYBOOK.md)." >&2
    exit 2
  fi
done
exit 0
