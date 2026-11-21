#!/usr/bin/env bash
# Tripwire for git pushes that force-update or delete a branch other than agent/<topic>.
#
# Design: default-deny. Earlier versions tried to understand any shell text and lost to every review
# (10, 8, 30, 29 and 14 bypasses). Any Bash command that could push must be one plain command:
#   git [-C <dir>] push [<known options>] [<remote> [<refspec>...]] [2>&1 | tail -<n>]
# with plain characters only. Anything else that could push is blocked. Text that mentions a push
# (a commit message, a PR body) goes in a file written with the Write tool; searches use the Grep tool.
# A plain push is then checked against the repository's own state: config, legacy remote files and
# symbolic refs decide where it lands and whether it forces, deletes or mirrors. Every program a command
# runs is resolved, so git under another name (a symlink, a glob) is still git, and git aliases are
# resolved before they run.
#
# Known limits: a push inside a script file or a git hook, a command built at run time without the word
# push or git, an interpreter (python3 -c, node -e), and tools other than Bash and Write/Edit. GitHub's
# protect-main ruleset is the only server-side guarantee, and it covers main only.
# Every form it must handle is in guard-force-push.cases. Run test-guard-force-push.sh after any change.
# Bash 3.2 compatible (macOS).
input=$(cat)
block() {
  echo "Blocked: $1 Agents may force-push or delete only agent/ branches they created (PLAYBOOK.md)." >&2
  exit 2
}
deny() {
  block "$1 Run the push as one plain command: git push [-u] <remote> <branch>. For a commit message or PR body that mentions a push, write it to a file with the Write tool (git commit -F <file>, gh pr create --body-file <file>). To search, use the Grep tool."
}

# json_get a.b: print a string field from the hook input with jq, else python3. Fails if neither can read it.
json_get() {
  if [ -z "$GUARD_NO_JQ" ] && command -v jq >/dev/null 2>&1; then
    jq -r ".$1 // \"\" | strings" <<<"$input" 2>/dev/null; return $?
  fi
  if [ -z "$GUARD_NO_PY" ] && command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json, sys
d = json.loads(sys.stdin.read() or "{}")
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
sys.stdout.write(d if isinstance(d, str) else "")' "$1" <<<"$input" 2>/dev/null; return $?
  fi
  return 1
}

if ! cmd=$(json_get tool_input.command) || ! file=$(json_get tool_input.file_path) || ! curdir=$(json_get cwd); then
  # The input can't be read, so anything that might touch git is blocked.
  grep -Eqi "g['\"\\\\]*i['\"\\\\]*t|pu['\"\\\\]*s['\"\\\\]*h|send-pack|gh[[:space:]]+api|deleteref|updateref" <<<"$input" &&
    block "this guard can't read the command. Install jq (or python3) and try again."
  exit 0
fi
[ -n "$curdir" ] || curdir=$PWD

# Write and Edit: git config files and git hooks can redirect, force or run a push later.
if [ -n "$file" ]; then
  f=$(printf '%s' "$file" | sed -E 's#/+#/#g; s#/(\./)+#/#g' | tr '[:upper:]' '[:lower:]')
  case $f in
    */.git/config|*/.git/config.worktree|*/.git/worktrees/*/config*|*/.git/hooks/*|*/.git/remotes/*|*/.git/branches/*|*gitconfig|*/git/config)
      block "editing $file can change where pushes go or run one. Ask the user to change git config." ;;
  esac
  exit 0
fi
[ -n "$cmd" ] || exit 0

# Exact shapes that can't push: one git commit with a single-quoted message, and reading or unsetting git config.
commit_re="^[[:space:]]*git[[:space:]]+commit([[:space:]]+(--allow-empty|--amend|--no-verify|-[aqvs]+))*[[:space:]]+-[aqvs]*m[[:space:]]+'[^']*'[[:space:]]*\$"
config_re='^[[:space:]]*git[[:space:]]+config[[:space:]]+(--global[[:space:]]+)?(--get|--get-all|--get-regexp|--list|-l|--unset|--unset-all)([[:space:]]+[A-Za-z0-9._-]+)?[[:space:]]*$'
[[ $cmd =~ $commit_re ]] && exit 0
[[ $cmd =~ $config_re ]] && exit 0

# Normalized text: quotes, backslashes, brackets and braces removed, lowercase. Words split on whitespace,
# shell punctuation and =, each reduced to its basename.
norm=$(printf '%s' "$cmd" | tr -d "'\"\\\\[]{}" | tr '[:upper:]' '[:lower:]')
norm=${norm//stash push/stash}
words=$(printf '%s' "$norm" | tr -s ' \t\n;&|()<>=,`$' '\n' | sed 's#.*/##')
push_word='^[^a-z0-9]*(push|git-push|send-pack|git-send-pack|remote-https?|remote-ext|remote-fd)[^a-z0-9]*$'
git_word='^(git|git-.*)$'
risky_re='alias\.|autocorrect|include\.path|includeif|config-env|remote\.[^[:space:]]*\.(push|mirror)([^a-z]|$)|pushdefault|pushremote|recursesubmodules'
has_git=0; grep -Eq "$git_word" <<<"$words" && has_git=1

# GitHub's API can move or delete a branch without git.
if [[ $norm =~ gh[[:space:]]+api ]]; then
  if [[ $norm == *git/refs* ]] && [[ $norm =~ (-x|--method)[[:space:]=]*(patch|delete|post|put)|force ]]; then
    block "this changes a branch through the GitHub API."
  fi
  [[ $norm =~ (deleteref|updateref|createref|updaterefs) ]] && block "this changes a branch through the GitHub API."
fi

# Writing inside .git or a git config file through the shell can redirect, force or run a later push.
gitpath='(\.git/|gitconfig|/git/config)'
write_re=">>?[[:space:]]*[^[:space:]]*$gitpath|(^|[^a-z])(tee|cp|mv|ln|install|dd|rsync|truncate|patch)[[:space:]][^;&|]*$gitpath|(sed|perl)[[:space:]]+-[a-z]*i[^;&|]*$gitpath"
[[ $norm =~ $write_re ]] && block "this writes inside .git or a git config file through the shell. Ask the user to change git settings."

could_push=0
if grep -Eq "$push_word" <<<"$words"; then
  [ $has_git = 1 ] || [[ $cmd == *'$'* || $cmd == *'`'* ]] && could_push=1
fi
[ $has_git = 1 ] && [[ $norm =~ $risky_re ]] && could_push=1

# Check the program each simple command runs. One the shell picks at run time is refused when git could be
# involved, git under another name is still git, and a git alias is resolved before it runs.
known=' add am annotate apply archive bisect blame branch bundle cat-file check-attr check-ignore check-mailmap check-ref-format checkout checkout-index cherry cherry-pick clean clone column commit commit-graph commit-tree config count-objects credential describe diff diff-files diff-index diff-tree difftool fetch fetch-pack for-each-ref format-patch fsck gc grep hash-object help hook index-pack init interpret-trailers log ls-files ls-remote ls-tree maintenance merge merge-base merge-file merge-tree mergetool mktag mktree mv notes pack-objects pack-refs prune pull range-diff read-tree rebase reflog remote repack replace rerere reset restore rev-list rev-parse revert rm shortlog show show-branch show-ref sparse-checkout stash status stripspace submodule switch symbolic-ref tag update-index update-ref var verify-commit verify-tag version whatchanged worktree write-tree lfs '
is_git_prog() {   # is_git_prog WORD: true when WORD runs git (a path, a symlink, or a command on PATH)
  local p=$1 real
  case ${p##*/} in git|git-*) return 0 ;; esac
  case $p in /*) ;; */*) p=$curdir/$p ;; *) p=$(command -v -- "$p" 2>/dev/null) ;; esac
  [ -n "$p" ] && [ -e "$p" ] || return 1
  real=$(readlink -f -- "$p" 2>/dev/null) || real=$p
  case ${real##*/} in git|git-*) return 0 ;; esac
  return 1
}
segs=$cmd; segs=${segs//&&/$'\n'}; segs=${segs//||/$'\n'}; segs=${segs//;/$'\n'}; segs=${segs//|/$'\n'}; segs=${segs//&/$'\n'}
while IFS= read -r seg; do
  s=${seg//[\"\']/}
  read -ra w <<<"$s"
  n=${#w[@]}; k=0; pre=
  # Skip NAME=value assignments, { grouping, and wrappers that run the next word.
  while [ $k -lt $n ]; do
    t=${w[$k]}
    if [[ $t =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then pre="$pre $t"; k=$((k + 1)); continue; fi
    case $t in
      '{'|'}'|'('|')'|'!'|then|do|else|if|while|until) k=$((k + 1)); continue ;;
      sudo|exec|command|builtin|nice|nohup|time|stdbuf|unbuffer) k=$((k + 1)); continue ;;
      env)
        k=$((k + 1))
        while [ $k -lt $n ]; do
          case ${w[$k]} in
            -S*|--split-string*) block "env -S runs a command from a string, so it can't be checked." ;;
            -u|-C|--chdir|--unset) pre="$pre env"; k=$((k + 2)) ;;
            -*|*=*) pre="$pre env"; k=$((k + 1)) ;;
            *) break ;;
          esac
        done
        continue ;;
      xargs)
        pre="$pre xargs"; k=$((k + 1))
        while [ $k -lt $n ]; do
          case ${w[$k]} in
            -I|-L|-n|-P|-d|-E|-s|-a) k=$((k + 2)) ;;
            -*) k=$((k + 1)) ;;
            *) break ;;
          esac
        done
        continue ;;
      timeout) k=$((k + 1)); while [ $k -lt $n ] && [[ ${w[$k]} == -* || ${w[$k]} =~ ^[0-9.]+[smhd]?$ ]]; do k=$((k + 1)); done; continue ;;
    esac
    break
  done
  prog=${w[$k]}
  [ -n "$prog" ] || continue
  prog=${prog//\\/}
  # A program name the shell builds at run time can be git.
  case $prog in *'$'*|*'`'*)
    [ $has_git = 1 ] || [ $could_push = 1 ] && deny "the program this runs is built by the shell at run time, so the guard can't check it." ;;
  esac
  case $prog in *'{'*|*'}'*) deny "the program this runs comes from brace expansion, so the guard can't check it." ;; esac
  case $prog in *'*'*|*'?'*|*'['*)
    hit=
    while IFS= read -r g; do is_git_prog "$g" && hit=1; done < <(cd "$curdir" 2>/dev/null && compgen -G "$prog")
    [ -n "$hit" ] && deny "this glob runs git, so the guard can't check it." ;;
  esac
  is_git_prog "$prog" || continue

  # A git invocation: global options must be plain, and the subcommand must be a real command or an
  # alias that doesn't push.
  j=$((k + 1)); cdir=; gdir=
  while [ $j -lt $n ]; do
    case ${w[$j]} in
      *'$'*|*'`'*|*'\'*) block "git's options here are built at run time, so the guard can't check them." ;;
    esac
    case ${w[$j]} in
      -C) cdir=${w[$((j + 1))]}; j=$((j + 2)) ;;
      --git-dir) gdir=${w[$((j + 1))]}; j=$((j + 2)) ;;
      --git-dir=*) gdir=${w[$j]#--git-dir=}; j=$((j + 1)) ;;
      -c|--work-tree|--namespace|--super-prefix|--exec-path|--config-env|--shallow-file|--attr-source)
        case ${w[$((j + 1))]} in *'$'*|*'`'*|*'\'*) block "git's options here are built at run time, so the guard can't check them." ;; esac
        j=$((j + 2)) ;;
      -*) j=$((j + 1)) ;;
      *) break ;;
    esac
  done
  sub=${w[$j]}
  [ -n "$sub" ] || continue
  case $sub in *[\$\`\\\*\?\[\]\{\}]*) block "the shell picks this git command at run time, so it can't be checked." ;; esac
  # git under any name, pushing: the plain-push check below decides.
  case $sub in push|send-pack) could_push=1; continue ;; esac
  case $sub in rebase|submodule|bisect|difftool|mergetool|filter-branch|worktree)
    [[ $cmd == *'$'* || $cmd == *'`'* ]] && block "git $sub runs other commands, and this one is built at run time." ;;
  esac
  [ $could_push = 1 ] && continue
  if [[ $known != *" $sub "* ]]; then
    [[ $pre == *GIT_* || $pre == *HOME=* || $pre == *XDG_CONFIG_HOME=* || $pre == *env* ]] &&
      block "git $sub runs with a changed environment, so the guard can't tell what it does."
    repo=$curdir
    if [ -n "$cdir" ]; then case $cdir in /*) repo=$cdir ;; *) repo=$curdir/$cdir ;; esac; fi
    loc=(-C "$repo"); [ -n "$gdir" ] && loc=(-C "$repo" --git-dir="$gdir")
    a=$sub; depth=0
    while [[ $known != *" $a "* ]]; do
      v=$(git "${loc[@]}" config --get "alias.$a" 2>/dev/null)
      if [ -z "$v" ]; then
        [ $depth = 0 ] || break
        ac=$(git "${loc[@]}" config --get help.autocorrect 2>/dev/null)
        case $ac in ''|0|false|never|show) ;; *) block "git $sub is not a git command, and autocorrect could run a push." ;; esac
        break
      fi
      case $v in '!'*) block "git $sub is an alias that runs a shell command." ;; esac
      vn=$(printf '%s' "$v" | tr -d "'\"\\\\" | tr '[:upper:]' '[:lower:]')
      printf '%s' "$vn" | tr -s ' \t' '\n' | grep -Eq "$push_word" && block "git $sub is an alias that pushes."
      depth=$((depth + 1)); [ $depth -lt 5 ] || block "git $sub is an alias chain the guard won't follow."
      read -r a _ <<<"$vn"
    done
  fi
done <<<"$segs"
[ $could_push = 1 ] || exit 0

# Everything that could push must be one plain push.
c=$(printf '%s' "$cmd" | sed -E 's/[[:space:]]+$//')
case $c in *$'\n'*) deny "this push spans more than one line." ;; esac
c=$(printf '%s' "$c" | sed -E 's/[[:space:]]+(2>&1|2>\/dev\/null|>\/dev\/null[[:space:]]+2>&1)([[:space:]]*\|[[:space:]]*(tail|head)([[:space:]]+-n)?[[:space:]]+-?[0-9]+)?$//')
# A whole word in quotes, made of plain characters, means the same without them.
c=$(printf '%s' "$c" | sed -E "s/\"([A-Za-z0-9._\/:@+=^-]+)\"/\\1/g; s/'([A-Za-z0-9._\/:@+=^-]+)'/\\1/g")
[[ $c =~ ^[A-Za-z0-9[:space:]._/:@+=^-]+$ ]] || deny "this command could push in a way the guard can't check."
read -ra w <<<"$c"
n=${#w[@]}; i=1; dir=
[ "${w[0]}" = git ] || deny "this command could push in a way the guard can't check."
if [ "${w[1]}" = -C ]; then dir=${w[2]}; i=3; fi
[ "${w[$i]}" = push ] || deny "this command could push in a way the guard can't check."
i=$((i + 1))

force=0; del=0; remote=; refs=()
while [ $i -lt $n ]; do
  a=${w[$i]}
  case $a in
    -u|--set-upstream|-q|--quiet|-v|--verbose|-n|--dry-run|--porcelain|--no-verify|--verify|--follow-tags|--no-follow-tags|--atomic|--no-atomic|--progress|--no-progress|-4|-6|--ipv4|--ipv6|--signed|--no-signed|--signed=*|--push-option=*) ;;
    -o) i=$((i + 1)) ;;
    --force|--force-with-lease|--force-with-lease=*|--force-if-includes|--no-force-if-includes) force=1 ;;
    --delete) del=1 ;;
    --*) deny "git push $a is not an option this guard allows." ;;
    -*) [[ $a =~ ^-[uqvnf46d]+$ ]] || deny "git push $a is not an option this guard allows."
        [[ $a == *f* ]] && force=1; [[ $a == *d* ]] && del=1 ;;
    *) if [ -z "$remote" ]; then remote=$a; else refs+=("$a"); fi ;;
  esac
  i=$((i + 1))
done

# Read the state of the repository this push runs in. If it can't be read, block.
repo=$curdir
if [ -n "$dir" ]; then case $dir in /*) repo=$dir ;; *) repo=$curdir/$dir ;; esac; fi
gd=$(git -C "$repo" rev-parse --absolute-git-dir 2>/dev/null) || block "the guard can't read the git config of '$repo'."
cfg() { git -C "$repo" config "$@" 2>/dev/null; }
r=$remote
if [ -z "$r" ]; then
  b=$(git -C "$repo" symbolic-ref --short -q HEAD 2>/dev/null)
  r=$(cfg --get "branch.$b.pushRemote"); [ -n "$r" ] || r=$(cfg --get remote.pushDefault)
  [ -n "$r" ] || r=$(cfg --get "branch.$b.remote")
  if [ -z "$r" ]; then
    # git falls back to origin, or to the only remote when there's no origin.
    remotes=$(git -C "$repo" remote 2>/dev/null)
    if [ -n "$(cfg --get remote.origin.url)" ] || [ -z "$remotes" ]; then r=origin
    elif [ "$(printf '%s\n' "$remotes" | wc -l | tr -d ' ')" = 1 ]; then r=$remotes
    else block "this push has no remote set and several remotes exist, so its destination can't be checked."; fi
  fi
fi
[ -e "$gd/remotes/$r" ] || [ -e "$gd/branches/$r" ] && block "remote '$r' comes from a legacy .git/remotes or .git/branches file, which the guard doesn't read."
[ "$(cfg --type=bool --get "remote.$r.mirror")" = true ] && block "remote '$r' is set to mirror, which can overwrite every branch."
cfgrefs=()
while IFS= read -r spec; do [ -n "$spec" ] && cfgrefs+=("$spec"); done < <(cfg --get-all "remote.$r.push")
for x in "${cfgrefs[@]}"; do [[ $x == +* ]] && force=1; done
# A branch named without a colon can be sent elsewhere by remote.*.push or push.default=upstream/tracking.
remap=0
[ ${#cfgrefs[@]} -gt 0 ] && remap=1
case $(cfg --get push.default) in upstream|tracking) remap=1 ;; esac
case $(cfg --get push.recurseSubmodules) in on-demand|only) [ $force = 1 ] && block "push.recurseSubmodules would force-push submodules too." ;; esac
[ ${#refs[@]} -eq 0 ] && [ $del = 0 ] && refs=("${cfgrefs[@]}")

# dst REF: where REF lands, following a symbolic ref when it names no destination.
dst() {
  local x=${1#+} d s
  case $x in
    *:*) d=${x##*:} ;;
    *) d=$x
       s=$(git -C "$repo" symbolic-ref -q "refs/heads/${x#refs/heads/}" 2>/dev/null) && [ -n "$s" ] && d=$s ;;
  esac
  printf '%s' "${d#refs/heads/}"
}
for x in "${refs[@]}"; do
  [[ $x == +* ]] && force=1
  if [[ $x == :* ]] || [ $del = 1 ]; then d=$(dst "$x"); [[ $d == agent/?* ]] || block "this deletes '$d'."; fi
done
[ $force = 1 ] || exit 0
[ ${#refs[@]} -eq 0 ] && block "this force push names no branch, so where it lands depends on the checkout and config. Name the agent/ branch explicitly."
for x in "${refs[@]}"; do
  if [[ $x != *:* ]] && [ $remap = 1 ]; then
    block "git config here could send '$x' to another branch. Write the destination out, for example $x:$x."
  fi
  d=$(dst "$x"); [[ $d == agent/?* ]] || block "force push to '$d'."
done
exit 0
