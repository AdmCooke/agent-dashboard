#!/usr/bin/env bash
# Best-effort guard: blocks a git push that force-updates or deletes any branch other than agent/<topic>.
# It reads the Bash command's text, so it refuses any push the shell could rewrite before git runs
# ($, backticks, backslashes, braces, wildcards), and it reads the push settings in git config.
# Known limits: a push inside a script file, a git alias or config set outside a Bash command, or an
# encoded command gets past it. GitHub's protect-main ruleset is the server-side guarantee for main.
# Every form it must handle is in guard-force-push.cases. Run test-guard-force-push.sh after any change.
# Bash 3.2 compatible (macOS).
input=$(cat)
block() {
  echo "Blocked: $1 Agents may force-push or delete only agent/ branches they created (PLAYBOOK.md)." >&2
  exit 2
}

if [ -n "$GUARD_NO_JQ" ] || ! command -v jq >/dev/null 2>&1; then
  # Without jq the command can't be read safely. Any push that looks forced, deleting, rewritable,
  # config-driven or run in another directory is blocked, and so is any push from a repository whose
  # git config forces or mirrors pushes.
  if grep -qi 'push' <<<"$input"; then
    grep -Eqi -- '--force|--mirror|--delete|(^|[[:space:]"])-[[:alnum:]]*[fd]|[[:space:]"'\'':=]\+|[[:space:]]:|\$|`|\\|[][{}*?]|GIT_CONFIG|remote\.[^[:space:]]*\.(push|mirror)|alias\.|[[:space:]]-C[[:space:]]|["[:space:];&|]cd[[:space:]]' <<<"$input" &&
      block "jq is not installed, so this guard can't read the command. Install jq."
    dir=$(sed -nE 's/.*"cwd"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' <<<"$input")
    git -C "${dir:-$PWD}" config --get-regexp '^remote\..*\.(push|mirror)$' 2>/dev/null | grep -Eq ' \+| true$' &&
      block "jq is not installed, and this repository's git config forces or mirrors pushes. Install jq."
  fi
  exit 0
fi
cmd=$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null)
curdir=$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)
[ -n "$curdir" ] || curdir=$PWD

config_re='remote\.[^[:space:]=]*\.(push|mirror)([[:space:]=]|$)'   # git config keys ignore case
alias_re='alias\.'

# Join backslash-continued lines, then one simple command per line: split on newlines, ;, &&, || and |.
# 2>&1 and &> are redirections, not splits.
cmd=${cmd//$'\\\n'/ }
cmd=${cmd//>&/>}; cmd=${cmd//&>/>}
cmd=${cmd//&&/$'\n'}; cmd=${cmd//||/$'\n'}
cmd=${cmd//;/$'\n'}; cmd=${cmd//|/$'\n'}; cmd=${cmd//&/$'\n'}

# dst_ok REF: true when REF lands on an agent/ branch.
dst_ok() { local d=${1#+}; d=${d##*:}; d=${d#refs/heads/}; [[ $d == agent/?* ]]; }

while IFS= read -r raw; do
  seg=${raw//[\"\'()\`]/ }
  read -ra w <<<"$seg"
  n=${#w[@]}
  [ $n -gt 0 ] || continue

  # Track cd, so git config is read from the repository the push runs in.
  if [ "${w[0]}" = cd ] || [ "${w[0]}" = pushd ]; then
    case ${w[1]} in /*) curdir=${w[1]} ;; '') ;; *) curdir=$curdir/${w[1]} ;; esac
    continue
  fi

  # Writing a push refspec, a mirror setting or a pushing alias into git config is a push in disguise.
  case $raw in *--get*|*--list*) ;; *)
    shopt -s nocasematch
    [[ $raw =~ $config_re ]] && block "this sets a push refspec or mirror in git config."
    [[ $raw =~ $alias_re ]] && [[ $raw == *push* ]] && block "this defines a git alias that pushes."
    shopt -u nocasematch
  esac

  # Find git (or a variable standing in for it) whose subcommand is push.
  start=-1; cdir=; i=0; isgit=0
  while [ $i -lt $n ]; do
    t=${w[$i]}; t=${t#\\}
    if [ "${t##*/}" = git ] || [[ $t == *'$'* ]]; then
      isgit=1; j=$((i + 1))
      while [ $j -lt $n ]; do
        case ${w[$j]} in
          -C) cdir=${w[$((j + 1))]}; j=$((j + 2)) ;;
          -c|--git-dir|--work-tree|--namespace|--config-env|--super-prefix) j=$((j + 2)) ;;
          -*) j=$((j + 1)) ;;
          *) break ;;
        esac
      done
      if [ "${w[$j]}" = push ]; then start=$((j + 1)); break; fi
    fi
    i=$((i + 1))
  done
  [ $isgit = 1 ] && [[ $raw == *--mirror* ]] && block "--mirror can overwrite every branch on the remote."
  [ $start -ge 0 ] || continue
  [[ $raw == *GIT_CONFIG* ]] && block "this push takes git config from the environment, so its destination can't be checked."
  # The shell rewrites these after this hook reads the text, so the push could turn into a force push.
  case $raw in *'$'*|*'`'*|*'\'*|*'{'*|*'}'*|*'['*|*'*'*|*'?'*)
    block "this push uses \$, backticks, backslashes, braces or wildcards, so the shell could turn it into a force push. Write the command out plainly." ;;
  esac

  force=0; del=0; many=0; remote=; refs=()
  j=$start
  while [ $j -lt $n ]; do
    a=${w[$j]}
    case $a in
      -o|--push-option|--repo|--receive-pack|--exec) j=$((j + 1)) ;;
      [0-9]'>'*|'>'*|[0-9]'<'*|'<'*) case $a in *'>'|*'<') j=$((j + 1)) ;; esac ;;   # redirection, and its file
      --force|--force-with-lease|--force-with-lease=*|--force-if-includes) force=1 ;;
      --delete) del=1 ;;
      --all|--branches|--tags) many=1 ;;
      --*) ;;
      -*) [[ $a == *f* ]] && force=1; [[ $a == *d* ]] && del=1 ;;
      *) if [ -z "$remote" ]; then remote=$a; else refs+=("$a"); fi ;;
    esac
    j=$((j + 1))
  done

  # A push that names no branch uses the remote's configured push refspecs, so read them.
  if [ ${#refs[@]} -eq 0 ] && [ $del = 0 ]; then
    repo=$curdir
    if [ -n "$cdir" ]; then case $cdir in /*) repo=$cdir ;; *) repo=$curdir/$cdir ;; esac; fi
    r=${remote:-origin}
    [ "$(git -C "$repo" config --get "remote.$r.mirror" 2>/dev/null)" = true ] && block "remote '$r' is set to mirror, which can overwrite every branch."
    while IFS= read -r spec; do [ -n "$spec" ] && refs+=("$spec"); done < <(git -C "$repo" config --get-all "remote.$r.push" 2>/dev/null)
  fi

  for r in "${refs[@]}"; do
    [[ $r == +* ]] && force=1
    if [[ $r == :* ]] || [ $del = 1 ]; then dst_ok "$r" || block "this deletes '${r#:}'."; fi
  done
  [ $force = 1 ] || continue
  [ $many = 1 ] && block "a force push with --all, --branches or --tags reaches branches other than agent/."
  [ ${#refs[@]} -eq 0 ] && block "this force push names no branch, so where it lands depends on the checkout and config. Name the agent/ branch explicitly."
  for r in "${refs[@]}"; do
    dst_ok "$r" || { d=${r#+}; d=${d##*:}; block "force push to '${d#refs/heads/}'."; }
  done
done <<<"$cmd"
exit 0
