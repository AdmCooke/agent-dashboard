#!/usr/bin/env bash
# Best-effort tripwire: blocks a git push that force-updates or deletes any branch other than agent/<topic>.
# It reads the Bash command's text and the repository's git config, and refuses what it can't check:
# git commands the shell could rewrite ($, backticks, backslashes, braces, wildcards), pushes run with a
# changed environment, and force pushes whose destination git config could redirect.
# Known limits: a text check can't follow a push inside a script file, git run under another name, a
# command built at runtime (sh -c "$C", base64), or tools other than Bash and Write/Edit. GitHub's
# protect-main ruleset is the only server-side guarantee, and it covers main only.
# Every form it must handle is in guard-force-push.cases. Run test-guard-force-push.sh after any change.
# Bash 3.2 compatible (macOS).
input=$(cat)
block() {
  echo "Blocked: $1 Agents may force-push or delete only agent/ branches they created (PLAYBOOK.md)." >&2
  exit 2
}

# json_get a.b: print a string field from the hook input, with jq, else python3.
json_get() {
  if [ -z "$GUARD_NO_JQ" ] && command -v jq >/dev/null 2>&1; then
    jq -r ".$1 // empty" <<<"$input" 2>/dev/null; return 0
  fi
  if [ -z "$GUARD_NO_PY" ] && command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json, sys
d = json.loads(sys.stdin.read() or "{}")
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
sys.stdout.write(d if isinstance(d, str) else "")' "$1" <<<"$input" 2>/dev/null; return 0
  fi
  return 1
}

if ! cmd=$(json_get tool_input.command); then
  # No JSON reader: block anything that might be a push or a git config write. Install jq to lift this.
  grep -Eqi "g['\"\\\\]*i['\"\\\\]*t" <<<"$input" || exit 0
  grep -Eqi 'push|pu['\''"\\]|send-pack|config|\$|`' <<<"$input" &&
    block "neither jq nor python3 is installed, so this guard can't read the command. Install jq."
  exit 0
fi

# Write and Edit: block direct edits of git config files, which can force or mirror later pushes.
file=$(json_get tool_input.file_path)
if [ -n "$file" ]; then
  case $file in */.git/config|*/.gitconfig|*/git/config|*.git/config) block "editing $file can change where pushes go. Use git config instead." ;; esac
  exit 0
fi

curdir=$(json_get cwd); [ -n "$curdir" ] || curdir=$PWD
config_re='remote\.[^[:space:]=]*\.(push|mirror)([[:space:]=]|$)'   # git config keys ignore case
alias_re='alias\.'
meta_re='[][$`\\{}*?]'

# Writing a git config file through a redirection or tee can force or mirror the next push.
cfgfile_re='(>>?|tee([[:space:]]+-a)?)[[:space:]]*["'\'']?[^[:space:];&|]*(\.git/config|\.gitconfig|/git/config)'
[[ $cmd =~ $cfgfile_re ]] && block "this writes a git config file directly."

# Drop the bodies of quoted heredocs whose line starts with cat, git ... commit, or gh pr/issue: that
# text is data and never runs. Everything else keeps its body: an unquoted heredoc expands $(...), and
# bash -c "$(cat <<'EOF' ...)", x=$(cat ...), eval or a pipe would run it.
hd_re="<<-?[[:space:]]*['\"\\\\]([A-Za-z_][A-Za-z0-9_]*)"
data_re='^[[:space:]]*(cat[[:space:]]|git[[:space:]](.*[[:space:]])?commit[[:space:]]|gh[[:space:]]+(pr|issue)[[:space:]])'
out=; skip=
while IFS= read -r line || [ -n "$line" ]; do
  if [ -n "$skip" ]; then
    t=${line#"${line%%[!$'\t']*}"}
    [ "$t" = "$skip" ] && skip=
    continue
  fi
  out=$out$line$'\n'
  if [[ $line != *'|'* ]] && [[ $line =~ $data_re ]] && [[ $line =~ $hd_re ]]; then
    case $line in *bash*|*' sh '*|*eval*|*source*|*exec*) ;; *) skip=${BASH_REMATCH[1]} ;; esac
  fi
done <<<"$cmd"
cmd=$out

# Join backslash-continued lines, then one simple command per line: split on newlines, ;, &&, || and |.
# 2>&1 and &> are redirections, not splits.
cmd=${cmd//$'\\\n'/ }
cmd=${cmd//>&/>}; cmd=${cmd//&>/>}
cmd=${cmd//&&/$'\n'}; cmd=${cmd//||/$'\n'}
cmd=${cmd//;/$'\n'}; cmd=${cmd//|/$'\n'}; cmd=${cmd//&/$'\n'}

# dst_ok REF: true when REF lands on an agent/ branch.
dst_ok() { local d=${1#+}; d=${d##*:}; d=${d#refs/heads/}; [[ $d == agent/?* ]]; }
# prefix NAME FULL MIN: git accepts any unambiguous prefix of a long option.
prefix() { [ ${#1} -ge "$3" ] && [ "${2#"$1"}" != "$2" ]; }
# cfg ARGS: read effective git config for the repository the push runs in.
cfg() { git "${gitloc[@]}" config "$@" 2>/dev/null; }

envchanged=0
while IFS= read -r raw; do
  # A comment ends the command. Only look for one in a segment without quotes.
  case $raw in *[\"\']*) ;; '#'*|*' #'*) raw=${raw%%#*} ;; esac
  seg=${raw//[\"\']/}           # the shell joins quoted pieces: pu''sh is push
  seg=${seg//[()\`]/ }
  read -ra w <<<"$seg"
  n=${#w[@]}
  [ $n -gt 0 ] || continue

  # Track cd, so git config is read from the repository the push runs in.
  if [ "${w[0]}" = cd ] || [ "${w[0]}" = pushd ]; then
    case ${w[1]} in /*) curdir=${w[1]} ;; '') ;; *) curdir=$curdir/${w[1]} ;; esac
    continue
  fi
  # A command that only sets or exports git's environment affects the pushes after it.
  case ${w[0]} in export|GIT_*=*|HOME=*|XDG_CONFIG_HOME=*)
    [[ $seg == *GIT_* || $seg == *HOME=* ]] && envchanged=1 ;;
  esac

  # Find git, git-push, or a variable standing in for git, and its subcommand.
  sub=; cfgflag=; hasc=0; cdir=; gdir=; pre=; i=0; gi=-1; j=0
  while [ $i -lt $n ]; do
    t=${w[$i]}; t=${t#\\}; base=${t##*/}
    case $base in
      git-push) sub=push; gi=$i; j=$((i + 1)); break ;;
      git-send-pack) block "git send-pack pushes refs directly." ;;
    esac
    if [ "$base" = git ] || { [[ $t == *'$'* ]] && [ "${w[$((i + 1))]}" = push ]; }; then
      gi=$i; j=$((i + 1))
      while [ $j -lt $n ]; do
        case ${w[$j]} in
          -C) cdir=${w[$((j + 1))]}; j=$((j + 2)) ;;
          --git-dir) gdir=${w[$((j + 1))]}; j=$((j + 2)) ;;
          --git-dir=*) gdir=${w[$j]#--git-dir=}; j=$((j + 1)) ;;
          -c) hasc=1; j=$((j + 2)) ;;
          -c*) hasc=1; j=$((j + 1)) ;;
          --work-tree|--namespace|--config-env|--super-prefix|--shallow-file|--attr-source) j=$((j + 2)) ;;
          -*) # An unknown option may take an argument: if push follows that, take it.
              if [ "${w[$((j + 2))]}" = push ] && [[ ${w[$((j + 1))]} != -* ]]; then j=$((j + 2)); else j=$((j + 1)); fi ;;
          *) break ;;
        esac
      done
      sub=${w[$j]}
      [ "$sub" = config ] && cfgflag=${w[$((j + 1))]}
      j=$((j + 1))
      break
    fi
    pre="$pre ${w[$i]}"
    i=$((i + 1))
  done

  # Git config writes that set a push refspec, a mirror, or a pushing alias are pushes in disguise.
  # Reading or unsetting them with git config is fine.
  case $cfgflag in --get*|--list|-l|--unset*|--remove-section) readonly=1 ;; *) readonly=0 ;; esac
  if [ "$sub" != config ] || [ $hasc = 1 ] || [ $readonly = 0 ]; then
    shopt -s nocasematch
    [[ $seg =~ $config_re ]] && block "this sets a push refspec or mirror in git config."
    [[ $seg =~ $alias_re ]] && [[ $seg == *push* ]] && block "this defines a git alias that pushes."
    shopt -u nocasematch
  fi
  [ $gi -ge 0 ] || continue

  if [[ $seg == *--mi* ]]; then
    for a in "${w[@]}"; do prefix "${a%%=*}" --mirror 4 && block "--mirror can overwrite every branch on the remote."; done
  fi
  [[ $sub =~ $meta_re ]] && block "the shell picks this git command at run time, so it can't be checked. Write it out plainly."
  case $sub in send-pack) block "git send-pack pushes refs directly." ;; push) ;; *) continue ;; esac

  # From here on it is a push.
  [[ $raw =~ $meta_re ]] && block "this push uses \$, backticks, backslashes, braces or wildcards, so the shell could turn it into a force push. Write the command out plainly."
  case " $pre " in *' env '*|*' xargs '*) block "this push runs through env or xargs, which can change its arguments or environment." ;; esac
  [[ $pre == *GIT_* || $pre == *HOME=* || $pre == *XDG_CONFIG_HOME=* ]] && block "this push changes git's environment, so its config and destination can't be checked."
  [ $envchanged = 1 ] && block "an earlier part of this command changes git's environment, so this push can't be checked."

  force=0; del=0; many=0; prune=0; remote=; refs=()
  while [ $j -lt $n ]; do
    a=${w[$j]}
    case $a in
      -o|--push-option|--repo|--receive-pack|--exec) j=$((j + 1)) ;;
      [0-9]'>'*|'>'*|[0-9]'<'*|'<'*)
        case $a in
          *:*) refs+=("$a") ;;                      # a quoted '>:main' is a refspec, not a redirection
          *'>'|*'<') j=$((j + 1)) ;;                 # the operator alone: skip its file too
        esac ;;
      --*) o=${a%%=*}
        if prefix "$o" --force 4 || prefix "$o" --force-with-lease 4 || prefix "$o" --force-if-includes 4; then force=1
        elif prefix "$o" --delete 4; then del=1
        elif prefix "$o" --prune 5; then prune=1
        elif prefix "$o" --all 4 || prefix "$o" --branches 4 || prefix "$o" --tags 4; then many=1
        fi ;;
      -*) [[ $a == *f* ]] && force=1; [[ $a == *d* ]] && del=1 ;;
      *) if [ -z "$remote" ]; then remote=$a; else refs+=("$a"); fi ;;
    esac
    j=$((j + 1))
  done
  [ $prune = 1 ] && block "--prune deletes remote branches."

  # Read the config that decides where this push goes.
  repo=$curdir
  if [ -n "$cdir" ]; then case $cdir in /*) repo=$cdir ;; *) repo=$curdir/$cdir ;; esac; fi
  gitloc=(-C "$repo"); [ -n "$gdir" ] && gitloc=(-C "$repo" --git-dir="$gdir")
  r=$remote
  if [ -z "$r" ]; then
    b=$(git "${gitloc[@]}" symbolic-ref --short -q HEAD 2>/dev/null)
    r=$(cfg --get "branch.$b.pushRemote"); [ -n "$r" ] || r=$(cfg --get remote.pushDefault)
    [ -n "$r" ] || r=$(cfg --get "branch.$b.remote"); [ -n "$r" ] || r=origin
  fi
  [ "$(cfg --get "remote.$r.mirror")" = true ] && block "remote '$r' is set to mirror, which can overwrite every branch."
  cfgrefs=()
  while IFS= read -r spec; do [ -n "$spec" ] && cfgrefs+=("$spec"); done < <(cfg --get-all "remote.$r.push")
  # Named refs without a colon get remapped by remote.*.push, or by push.default=upstream/tracking.
  remap=0
  [ ${#cfgrefs[@]} -gt 0 ] && remap=1
  case $(cfg --get push.default) in upstream|tracking) remap=1 ;; esac
  shopt -s nocasematch; [[ $seg =~ push\.default=(upstream|tracking) ]] && remap=1; shopt -u nocasematch
  [ ${#refs[@]} -eq 0 ] && [ $del = 0 ] && refs=("${cfgrefs[@]}")

  for x in "${refs[@]}"; do
    [[ $x == +* ]] && force=1
    if [[ $x == :* ]] || [ $del = 1 ]; then dst_ok "$x" || block "this deletes '${x#:}'."; fi
  done
  [ $force = 1 ] || continue
  [ $many = 1 ] && block "a force push with --all, --branches or --tags reaches branches other than agent/."
  [ ${#refs[@]} -eq 0 ] && block "this force push names no branch, so where it lands depends on the checkout and config. Name the agent/ branch explicitly."
  for x in "${refs[@]}"; do
    if [[ $x != *:* ]] && [ $remap = 1 ]; then
      block "git config here could send '$x' to another branch. Write the destination out, for example $x:$x."
    fi
    dst_ok "$x" || { d=${x#+}; d=${d##*:}; block "force push to '${d#refs/heads/}'."; }
  done
done <<<"$cmd"
exit 0
