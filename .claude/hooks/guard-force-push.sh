#!/usr/bin/env bash
# Tripwire for git pushes that force-update or delete a branch other than agent/<topic>.
#
# Design: default-deny. Earlier versions tried to understand any shell text and lost to every review
# (10, 8, 30 and 29 bypasses). Now any Bash command that could push must be one plain command:
#   git [-C <dir>] push [<known options>] [<remote> [<refspec>...]] [2>&1 | tail -<n>]
# with plain characters only. Anything else that could push is blocked. Text that mentions a push
# (a commit message, a PR body) goes in a file written with the Write tool; searches use the Grep tool.
# A plain push is then checked against the repository's own git config: where it lands, and whether it
# forces, deletes or mirrors.
#
# Known limits: a push inside a script file or a git hook, a command built at run time without the word
# push, an interpreter (python3 -c, node -e), and tools other than Bash and Write/Edit. GitHub's
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
  grep -Eqi "g['\"\\\\]*i['\"\\\\]*t|pu['\"\\\\]*s['\"\\\\]*h|send-pack" <<<"$input" &&
    block "this guard can't read the command. Install jq (or python3) and try again."
  exit 0
fi
[ -n "$curdir" ] || curdir=$PWD

# Write and Edit: git config files and git hooks can redirect, force or run a push later.
if [ -n "$file" ]; then
  f=$(printf '%s' "$file" | sed -E 's#/+#/#g; s#/(\./)+#/#g' | tr '[:upper:]' '[:lower:]')
  case $f in
    */.git/config|*/.git/config.worktree|*/.git/worktrees/*/config*|*/.git/hooks/*|*gitconfig|*/git/config)
      block "editing $file can change where pushes go or run one. Ask the user to change git config." ;;
  esac
  exit 0
fi
[ -n "$cmd" ] || exit 0

# Normalized text for the tripwires: quotes, backslashes and brackets removed, lowercase.
norm=$(printf '%s' "$cmd" | tr -d "'\"\\\\[]{}" | tr '[:upper:]' '[:lower:]')
norm=${norm//stash push/stash}
push_re='(^|[^a-z])(push|send-pack|remote-https?|remote-ext|remote-fd)([^a-z]|$)'
risky_re='alias\.|autocorrect|include\.path|includeif|config-env|remote\.[^[:space:]]*\.(push|mirror)([^a-z]|$)|pushdefault|pushremote|recursesubmodules'
git_re='(^|[^a-z0-9_])git([^a-z0-9_]|$)|git-'

# GitHub's API can move or delete a branch without git.
if [[ $norm =~ gh[[:space:]]+api ]] && [[ $norm == *git/refs* ]] &&
   [[ $norm =~ (-x|--method)[[:space:]]*(patch|delete|post|put)|force ]]; then
  block "this changes a branch through the GitHub API."
fi

could_push=0
if [[ $norm =~ $push_re || $norm =~ $risky_re ]] && [[ $norm =~ $git_re || $cmd == *'$'* || $cmd == *'`'* ]]; then
  could_push=1
fi

if [ $could_push = 0 ]; then
  # Not push-shaped. Still check each git word: an alias or autocorrect can turn it into a push, and some
  # subcommands run other commands, which must not be built at run time.
  known=' add am annotate apply archive bisect blame branch bundle cat-file check-attr check-ignore check-mailmap check-ref-format checkout checkout-index cherry cherry-pick clean clone column commit commit-graph commit-tree config count-objects credential describe diff diff-files diff-index diff-tree difftool fetch fetch-pack for-each-ref format-patch fsck gc grep hash-object help hook index-pack init interpret-trailers log ls-files ls-remote ls-tree maintenance merge merge-base merge-file merge-tree mergetool mktag mktree mv notes pack-objects pack-refs prune pull range-diff read-tree rebase reflog remote repack replace rerere reset restore rev-list rev-parse revert rm shortlog show show-branch show-ref sparse-checkout stash status stripspace submodule switch symbolic-ref tag update-index update-ref var verify-commit verify-tag version whatchanged worktree write-tree lfs '
  line=$cmd; line=${line//&&/$'\n'}; line=${line//||/$'\n'}; line=${line//;/$'\n'}; line=${line//|/$'\n'}
  while IFS= read -r seg; do
    seg=${seg//[\"\']/}
    read -ra w <<<"$seg"
    n=${#w[@]}; i=0
    while [ $i -lt $n ]; do
      t=${w[$i]}; t=${t#\\}
      if [ "${t##*/}" = git ]; then
        j=$((i + 1))
        while [ $j -lt $n ]; do
          case ${w[$j]} in
            *'$'*|*'`'*) block "git's options here are built at run time, so the guard can't check them." ;;
            -C|-c|--git-dir|--work-tree|--namespace|--super-prefix|--exec-path) j=$((j + 2)) ;;
            -*) j=$((j + 1)) ;;
            *) break ;;
          esac
        done
        sub=${w[$j]}
        [ -n "$sub" ] || break
        case $sub in *[\$\`\\\*\?\[\]\{\}]*) block "the shell picks this git command at run time, so it can't be checked." ;; esac
        case $sub in rebase|submodule|bisect|difftool|mergetool|filter-branch|worktree)
          [[ $cmd == *'$'* || $cmd == *'`'* ]] && block "git $sub runs other commands, and this one is built at run time." ;;
        esac
        if [[ $known != *" $sub "* ]]; then
          a=$(git -C "$curdir" config --get "alias.$sub" 2>/dev/null)
          case $a in *push*|*send-pack*|'!'*) block "git $sub is an alias that pushes or runs a shell command." ;; esac
          if [ -z "$a" ]; then
            ac=$(git -C "$curdir" config --get help.autocorrect 2>/dev/null)
            case $ac in ''|0|false|never|show) ;; *) block "git $sub is not a git command, and autocorrect could run a push." ;; esac
          fi
        fi
        break
      fi
      i=$((i + 1))
    done
  done <<<"$line"
  exit 0
fi

# Push-shaped. A few exact shapes that can't push are fine: a single git commit with a single-quoted
# message, and reading or unsetting git config.
commit_re="^[[:space:]]*git[[:space:]]+commit([[:space:]]+(--allow-empty|--amend|--no-verify|-[aqvs]+))*[[:space:]]+-m[[:space:]]+'[^']*'[[:space:]]*\$"
config_re='^[[:space:]]*git[[:space:]]+config[[:space:]]+(--global[[:space:]]+)?(--get|--get-all|--get-regexp|--list|-l|--unset|--unset-all)([[:space:]]+[A-Za-z0-9._-]+)?[[:space:]]*$'
[[ $cmd =~ $commit_re ]] && exit 0
[[ $cmd =~ $config_re ]] && exit 0

# Everything else must be one plain push.
c=$cmd
c=$(printf '%s' "$c" | sed -E 's/[[:space:]]+$//')
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

# Read the config of the repository this push runs in. If it can't be read, block.
repo=$curdir
if [ -n "$dir" ]; then case $dir in /*) repo=$dir ;; *) repo=$curdir/$dir ;; esac; fi
git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || block "the guard can't read the git config of '$repo'."
cfg() { git -C "$repo" config "$@" 2>/dev/null; }
r=$remote
if [ -z "$r" ]; then
  b=$(git -C "$repo" symbolic-ref --short -q HEAD 2>/dev/null)
  r=$(cfg --get "branch.$b.pushRemote"); [ -n "$r" ] || r=$(cfg --get remote.pushDefault)
  [ -n "$r" ] || r=$(cfg --get "branch.$b.remote"); [ -n "$r" ] || r=origin
fi
[ "$(cfg --type=bool --get "remote.$r.mirror")" = true ] && block "remote '$r' is set to mirror, which can overwrite every branch."
cfgrefs=()
while IFS= read -r spec; do [ -n "$spec" ] && cfgrefs+=("$spec"); done < <(cfg --get-all "remote.$r.push")
# A branch named without a colon can be sent elsewhere by remote.*.push or push.default=upstream/tracking.
remap=0
[ ${#cfgrefs[@]} -gt 0 ] && remap=1
case $(cfg --get push.default) in upstream|tracking) remap=1 ;; esac
case $(cfg --get push.recurseSubmodules) in on-demand|only) [ $force = 1 ] && block "push.recurseSubmodules would force-push submodules too." ;; esac
[ ${#refs[@]} -eq 0 ] && [ $del = 0 ] && refs=("${cfgrefs[@]}")

dst_ok() { local d=${1#+}; d=${d##*:}; d=${d#refs/heads/}; [[ $d == agent/?* ]]; }
for x in "${refs[@]}"; do
  [[ $x == +* ]] && force=1
  if [[ $x == :* ]] || [ $del = 1 ]; then dst_ok "$x" || block "this deletes '${x#:}'."; fi
done
[ $force = 1 ] || exit 0
[ ${#refs[@]} -eq 0 ] && block "this force push names no branch, so where it lands depends on the checkout and config. Name the agent/ branch explicitly."
for x in "${refs[@]}"; do
  if [[ $x != *:* ]] && [ $remap = 1 ]; then
    block "git config here could send '$x' to another branch. Write the destination out, for example $x:$x."
  fi
  dst_ok "$x" || { d=${x#+}; d=${d##*:}; block "force push to '${d#refs/heads/}'."; }
done
exit 0
