# Agent playbook

The main conversation and general-purpose subagents load this file through `CLAUDE.md`. Built-in Explore subagents do not. The Chief of Staff curates it after each review. Keep it short, because every agent pays for it in context.

## Standing rules

- Never report something as done or passing unless you saw the evidence in this run. Say what you did not check.
- Stay inside the task you were given. Name extra ideas in one line rather than building them.
- When the user asks you to merge a pull request, merge it. Their request is enough; don't wait for checks or a review first.
- Name branches you create `agent/<topic>`. In a cloud session, push to the `claude/<name>` branch it assigns you instead. Force-push (`--force-with-lease`, never `--force`) only to an `agent/` branch you created in this session, never to a `claude/` branch, anyone else's branch or `main`.
- The repo is public: treat every commit, branch name and PR text as public. Never put secrets, credentials, email addresses or private notes in them.
- Before editing, `git fetch` and start a new `agent/` branch from `origin/main`, even when the checkout is on another branch. In a cloud session, merge `origin/main` into the assigned branch instead of resetting it.
- After your pull request merges, delete your own branch where you can. Where you can't (cloud sessions), list it for the user with the command to delete it.
- A change is "done" only once it's in the repo (merged) or on claude.ai. A change that lives only in this cloud container (user settings, a local plugin install) is "temporary": say so, and say how to make it permanent.
- Stop and ask the user before a task's estimated spend passes $25. Add up `total_cost_usd` from `claude -p --output-format json` and eval runs, and name what you couldn't price, such as subagents.
- A safety guard (hook or permission rule) isn't proven by the cases its author wrote. After every change to it, small fixes included, have a reviewer who didn't write it probe new forms against the changed part. Describe it by the forms it was tested against, never as covering "every" case, and list the gaps you know of.
- Before you work in a cloud session, on plugin evals, scheduled tasks, Hostinger, the Premier website or a brand check, read the matching section of `SYSTEM-NOTES.md`. Add system-specific lessons there, not here.

## Before you finish, ask yourself

1. Did I check each claim in my answer myself, or am I repeating what I assume? Facts about GitHub, settings or plugins need a read from that system in this run (e.g. `gh api repos/{owner}/{repo}`).
2. Did I do what was asked: all of it, and nothing more?
3. What would the user ask next, and have I already answered it?
4. Did I hit an error, retry loop or surprise that the next agent should know about? If so, add one dated line under `## Lessons` (or in `SYSTEM-NOTES.md` if it is about one system).
5. If I added or changed a permission or safety rule, did I test a command it must block in a disguised form (for git: `src:dst` refspecs, `refs/...` names, a second refspec, quotes, bundled flags, a chained second command, and repo state the guard doesn't read, such as a symref, a linked worktree or the shell's environment), not only the obvious cases? For the force-push guard, add the form to `.claude/hooks/guard-force-push.cases` and run `bash .claude/hooks/test-guard-force-push.sh`.

## Lessons

- 2026-10-30, 2026-11-21 (main): Config savings are smaller than they look, because connector tools load on demand. Turning off 10 plugins saved 4k tokens (46.4k to 42.4k), and turning off 10 more saved 2.4k (49.5k to 47.1k) → measure a fresh `claude -p --output-format json` run before and after, and report the measured number.
- 2026-10-30 (main): Explore subagents don't load `CLAUDE.md` → when a task needs these rules, delegate it to a general-purpose agent, or paste the rule into the prompt.
- 2026-10-30 (chief-of-staff): A launch prompt said "no other subagents have run yet", but the session already had 3 finished subagents → describe session state only from what you listed yourself (e.g. `ls <session>/subagents`), not from memory.
- 2026-10-30 (chief-of-staff): The GitHub merge tool rejects a short `expectedHeadSha` → pass the full 40-char `git rev-parse HEAD`.
- 2026-11-19 (main + chief-of-staff): Permission patterns fail to guard `src:dst` refspecs. Both `Bash(git push --force-with-lease* origin agent/*)` and deny rules with a `:` let `agent/probe:refs/heads/main` through → force pushes are guarded by a PreToolUse hook (`.claude/hooks/guard-force-push.sh`) that blocks any destination that isn't an `agent/` branch. If the permission check blocks a force push, push to a new branch instead of retrying.
- 2026-11-21 (main): The guard blocks any Bash command that mentions a push in a shape other than one plain `git push`, including heredocs that only quote one, retry loops, and commit messages or `gh` bodies → push with one plain `git push`, put such text in a file written with the Write tool (`git commit -F`, `--body-file`), and search with the Grep tool.
- 2026-11-21, 2026-11-24 (main + chief-of-staff): Every force-push guard so far passed its author's tests, then failed review (10, 8, 30, 29 and 14 forms past successive versions, each shown by a `--dry-run` "(forced update)") → patching a shell parser doesn't converge. v5 went default-deny (anything that could push must be one plain `git push`), and v6 resolves symlinks, globs and aliases. A Nov 24 review still got 5 kinds of form past v6: a symref outside `refs/heads`, a copied git binary, a legacy remote file read through a linked worktree, env planted in the shell snapshot, and a quote the new splitter misreads, which hides an alias call. v7 blocks the push or its setup step for each in its tests. Add each form to `guard-force-push.cases`, and treat the hook as a tripwire. Only a GitHub ruleset is a guarantee: read `gh api repos/{owner}/{repo}/rulesets` before saying a branch is protected.
- 2026-11-24 (chief-of-staff): Replaying the same probe file against the hook at the PR head (`git show <sha>:<path>` into the scratchpad) and on disk showed which bypasses the newest fix introduced → when reviewing a guard change, compare its verdicts with the previous version's.
- 2026-11-21 (chief-of-staff): Edits to `PLAYBOOK.md` don't reach agents launched later in the same session. This review was handed the 10.3 KB copy from session start while the file on disk was 6 KB → a playbook change applies from the next session. Measure it in a fresh `claude -p` run, as main did.
<!-- - YYYY-MM-DD (agent): what happened → what to do instead -->

## Open questions for the user

- 2026-11-24 (chief-of-staff): Main suggests two rulesets: force pushes blocked on every branch except `agent/**`, and deletion blocked on every branch except `agent/**` and `claude/**`, so finished session branches (15 today) can still be deleted. Agents could then delete other sessions' `claude/` branches too. Is that split OK, or should deletion be blocked on `claude/**` as well?
- 2026-11-24 (chief-of-staff): Once the ruleset is live, should agents keep hardening the force-push hook after each review (a review round per change), or freeze it as a tripwire and fix only false blocks?
- 2026-11-24 (chief-of-staff): Does the $25 per task include review subagents, which the CLI doesn't price, or only `claude -p` and eval runs?

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
- 2026-11-24: Force-push protection: both. Keep the strict hook as a tripwire, and the user adds a GitHub ruleset that blocks force pushes and deletion on every branch except `agent/**` → guard lesson.
- 2026-11-24: Spend: stop and ask before a task passes $25 → standing rule.
- 2026-11-24: Branches: cloud sessions push to their assigned `claude/<name>` branch, local sessions keep `agent/<topic>`, and force pushes stay limited to `agent/` branches → standing rules.
- 2026-11-24: Both proposed Chief of Staff upgrades approved → applied in `agents/chief-of-staff.md` (2093533).
