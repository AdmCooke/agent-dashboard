# Agent playbook

The main conversation and general-purpose subagents load this file through `CLAUDE.md`. Built-in Explore subagents do not. The Chief of Staff curates it after each review. Keep it short, because every agent pays for it in context.

## Standing rules

- Never report something as done or passing unless you saw the evidence in this run. Say what you did not check.
- Stay inside the task you were given. Name extra ideas in one line rather than building them.
- When the user asks you to merge a pull request, merge it. Their request is enough; don't wait for checks or a review first.
- Name branches you create `agent/<topic>`. Force-push (`--force-with-lease`, never `--force`) only to an `agent/` branch you created in this session, never to anyone else's branch or to `main`.
- The repo is public: treat every commit, branch name and PR text as public. Never put secrets, credentials, email addresses or private notes in them.
- Before editing, `git fetch` and start a new `agent/` branch from `origin/main`, even when the checkout is on another branch.
- After your pull request merges, delete your own branch where you can. Where you can't (cloud sessions), list it for the user with the command to delete it.
- A change is "done" only once it's in the repo (merged) or on claude.ai. A change that lives only in this cloud container (user settings, a local plugin install) is "temporary": say so, and say how to make it permanent.
- A safety guard (hook or permission rule) isn't proven by the cases its author wrote. Before calling it done, have a reviewer who didn't write it probe new forms, and list the gaps you know of.
- Before you work in a cloud session, on plugin evals, scheduled tasks, Hostinger, the Premier website or a brand check, read the matching section of `SYSTEM-NOTES.md`. Add system-specific lessons there, not here.

## Before you finish, ask yourself

1. Did I check each claim in my answer myself, or am I repeating what I assume? Facts about GitHub, settings or plugins need a read from that system in this run (e.g. `gh api repos/{owner}/{repo}`).
2. Did I do what was asked: all of it, and nothing more?
3. What would the user ask next, and have I already answered it?
4. Did I hit an error, retry loop or surprise that the next agent should know about? If so, add one dated line under `## Lessons` (or in `SYSTEM-NOTES.md` if it is about one system).
5. If I added or changed a permission or safety rule, did I test a command it must block in a disguised form (for git: `src:dst` refspecs, `refs/heads/...`, a second refspec, quotes, bundled flags, a chained second command), not only the obvious cases? For the force-push guard, add the form to `.claude/hooks/guard-force-push.cases` and run `bash .claude/hooks/test-guard-force-push.sh`.

## Lessons

- 2026-10-30, 2026-11-21 (main): Config savings are smaller than they look, because connector tools load on demand. Turning off 10 plugins saved 4k tokens (46.4k to 42.4k), and turning off 10 more saved 2.4k (49.5k to 47.1k) → measure a fresh `claude -p --output-format json` run before and after, and report the measured number.
- 2026-10-30 (main): Explore subagents don't load `CLAUDE.md` → when a task needs these rules, delegate it to a general-purpose agent, or paste the rule into the prompt.
- 2026-10-30 (chief-of-staff): A launch prompt said "no other subagents have run yet", but the session already had 3 finished subagents → describe session state only from what you listed yourself (e.g. `ls <session>/subagents`), not from memory.
- 2026-10-30 (chief-of-staff): The GitHub merge tool rejects a short `expectedHeadSha` → pass the full 40-char `git rev-parse HEAD`.
- 2026-11-19 (main + chief-of-staff): Permission patterns fail to guard `src:dst` refspecs. Both `Bash(git push --force-with-lease* origin agent/*)` and deny rules with a `:` let `agent/probe:refs/heads/main` through → force pushes are guarded by a PreToolUse hook (`.claude/hooks/guard-force-push.sh`) that blocks any destination that isn't an `agent/` branch. If the permission check blocks a force push, push to a new branch instead of retrying.
- 2026-11-21 (main): The force-push hook reads the whole Bash command, so a heredoc that only quotes a force push to main (in a test fixture or doc) is blocked too → write that file with the Write tool.
- 2026-11-21 (main + chief-of-staff): Each force-push guard so far passed its author's tests, then failed review. A code review got 10 forms past the Nov 19 hook, and 8 forms in which the shell supplies the force got past the 53-case rewrite (an escaped `\+` or `\-f`, a variable, ANSI-C quoting, a backslash-continued line, a `git config` push refspec). `--dry-run` showed "(forced update)" → add each new form to `guard-force-push.cases`. GitHub's ruleset protects only `main`, so other branches rely on the hook.
- 2026-11-21 (chief-of-staff): Edits to `PLAYBOOK.md` don't reach agents launched later in the same session. This review was handed the 10.3 KB copy from session start while the file on disk was 6 KB → a playbook change applies from the next session. Measure it in a fresh `claude -p` run, as main did.
<!-- - YYYY-MM-DD (agent): what happened → what to do instead -->

## Open questions for the user

- 2026-11-21 (chief-of-staff): GitHub blocks force pushes to `main`, but no other branch has a rule, and the hook can't see a force the shell supplies. Should agents get a stricter hook (block any push that uses `$`, `\` or a backtick), a GitHub ruleset for every branch except `agent/*`, or both?
- 2026-11-21 (chief-of-staff): Today's evals cost about $52 in CLI estimates, and the report you got said about $30 for the first 9 runs. At what amount per task should agents stop and ask before spending more?
- 2026-11-21 (chief-of-staff): Cloud sessions push to an assigned `claude/<name>` branch, but the standing rule says `agent/<topic>`. Should the rule allow the assigned branch in cloud sessions?

## Answers from the user

- 2026-10-30: Merging when asked: "my request is enough." → standing rule.
- 2026-10-30: Keep the `ponytail` plugin on for reviewer agents: "Yes it is enough."
- 2026-10-30, 2026-11-09: Force-push: allowed "to their own branches", narrowed to `agent/` branches as best practice → standing rule.
- 2026-11-09: Public repo: best practice → treat all pushed text as public → standing rule. Whether it should stay public is the user's call.
- 2026-11-09: "Done": best practice → only once it's in the repo or on claude.ai. Container-only changes are reported as temporary → standing rule.
- 2026-11-19: Close the force-push gap: best practice → a PreToolUse hook that checks each push's destination → in `.claude/settings.json`.
- 2026-11-19: Branch cleanup: best practice → agents delete their own merged branches where possible, else list them for the user. GitHub's "Automatically delete head branches" setting is for the user to turn on. Always branch off `origin/main` → standing rules.
- 2026-11-19: Verdict: best practice → ⚠️ is right when an agent states a safety guarantee it only partly tested, even if the rest of its work is correct.
- 2026-11-21: Plugins: the user mostly works in chat and doesn't know which plugins they use → turned off data, engineering, finance, legal, operations, superme, zapier, remotion, desktop-commander and mcp-tunnels for this repo. Turn one back on in `.claude/settings.json` if a task needs it.
