# Agent playbook

The main conversation and general-purpose subagents load this file through `CLAUDE.md`. Built-in Explore subagents do not. The Chief of Staff curates it after each review. Keep it short, because every agent pays for it in context.

## Standing rules

- Never report something as done or passing unless you saw the evidence in this run. Say what you did not check.
- Stay inside the task you were given. Name extra ideas in one line rather than building them.
- When the user asks you to merge a pull request, merge it. Their request is enough; don't wait for checks or a review first.
- Name branches you create `agent/<topic>`. In a cloud session, push to the `claude/<name>` branch it assigns you instead. Force-push (`--force-with-lease`, never `--force`) only to an `agent/` branch you created in this session, never to a `claude/` branch, anyone else's branch or `main`.
- The repo is public: treat every commit, branch name and PR text as public. Never put secrets, credentials, email addresses or private notes in them.
- End PR descriptions with the Claude Code attribution line without its robot emoji: `Generated with [Claude Code](https://claude.com/claude-code)`, then the session link. The user's rule outranks the default footer.
- Before editing, `git fetch` and start a new `agent/` branch from `origin/main`, even when the checkout is on another branch. In a cloud session, merge `origin/main` into the assigned branch instead of resetting it.
- After your pull request merges, delete your own branch where you can. Where you can't (cloud sessions), list it for the user with the command to delete it.
- A change is "done" only once it's in the repo (merged) or on claude.ai. A change that lives only in this cloud container (user settings, a local plugin install) is "temporary": say so, and say how to make it permanent.
- Stop and ask the user before a task's estimated spend passes $25. Count everything: the main conversation's own tokens and each subagent's, estimated from their transcripts at current prices, plus `total_cost_usd` from `claude -p --output-format json` and eval runs. Label estimates as estimates, and name anything you could not price.
- A safety guard (hook or permission rule) isn't proven by the cases its author wrote. After every change, small fixes included, have a reviewer who didn't write it probe it. Test at least one disguised form that isn't in the agent's own test cases (for a shell guard: an escaped character, a variable, a line continuation; for git: repo state the guard doesn't read, such as a symref or a linked worktree), using a dry run with no side effects. When the guard changed since the last review, also replay earlier probe files against the previous version and report any probe the change newly lets through. Describe it by the forms it was tested against, never as covering "every" case, and list the known gaps.
- The force-push hook is frozen as a tripwire: fix only false blocks, and log each new bypass as a known limit (in the hook header and under Lessons) instead of another fix round. GitHub rulesets are the guarantee: read `gh api repos/{owner}/{repo}/rulesets` before calling a branch protected.
- Keep the guard editable: no Write/Edit block on `.claude/hooks/` or `.claude/settings*.json`.
- Keep `git` and `push` out of read-only Bash commands. The guard blocks any Bash command that has both, even a grep for the text. Put commit messages, PR bodies and search patterns in a file written with the Write tool (`git commit -F`, `--body-file`), and search with the Grep tool. Push with one plain `git push`.
- Before you work in a cloud session, on plugin evals, scheduled tasks, Hostinger, the Premier website or a brand check, read the matching section of `SYSTEM-NOTES.md`. Add system-specific lessons there, not here.

## Before you finish, ask yourself

1. Did I check each claim in my answer myself, or am I repeating what I assume? Facts about GitHub, settings or plugins need a read from that system in this run (e.g. `gh api repos/{owner}/{repo}`).
2. Did I do what was asked: all of it, and nothing more?
3. What would the user ask next, and have I already answered it?
4. Did I hit an error, retry loop or surprise that the next agent should know about? If so, add one dated line under `## Lessons` (or in `SYSTEM-NOTES.md` if it is about one system).
5. If I added or changed a permission or safety rule, did I test a command it must block in a disguised form, not only the obvious cases? For git: `src:dst` refspecs, `refs/...` names, a second refspec, quotes, bundled flags, a chained second command, a symref, a linked worktree, the shell's environment. For a shell guard: an escaped character, a variable, a line continuation. Send the hook the JSON Claude Code would send and read its exit code, so nothing runs. For the force-push guard, add the form to `.claude/hooks/guard-force-push.cases` and run `bash .claude/hooks/test-guard-force-push.sh`.

## Lessons

- 2026-10-30, 2026-11-21 (main): Config savings are smaller than they look, because connector tools load on demand. Turning off 10 plugins saved 4k tokens (46.4k to 42.4k), and turning off 10 more saved 2.4k (49.5k to 47.1k). Measure a fresh `claude -p --output-format json` run before and after, and report the measured number.
- 2026-10-30 (main): Explore subagents don't load `CLAUDE.md`. When a task needs these rules, delegate it to a general-purpose agent, or paste the rule into the prompt.
- 2026-10-30 (chief-of-staff): A launch prompt said "no other subagents have run yet", but the session already had 3 finished subagents. Describe session state only from what you listed yourself (e.g. `ls <session>/subagents`).
- 2026-10-30 (chief-of-staff): The GitHub merge tool rejects a short `expectedHeadSha`. Pass the full 40-char `git rev-parse HEAD`.
- 2026-11-19 (main + chief-of-staff): Permission patterns fail to guard `src:dst` refspecs. Force pushes are guarded by the PreToolUse hook `.claude/hooks/guard-force-push.sh`, which blocks any destination that isn't an `agent/` branch. If the check blocks a force push, push to a new branch instead of retrying.
- 2026-11-21, 2026-11-24 (main + chief-of-staff): Each force-push guard so far passed its author's tests, then failed review (10, 8, 30, 29, 14 and 5 forms past successive versions, each shown by a `--dry-run` "(forced update)"). Patching a shell parser doesn't converge. v7 blocks the five forms from the Nov 24 review. Add each new form to `guard-force-push.cases`. Only a GitHub ruleset is a guarantee.
- 2026-11-24 (chief-of-staff + main): v7 gaps, logged as known limits: a shell write whose path comes from a variable (`D=.claude/shell-snapshots; ... > $D/x.sh`) or a glob (`.claude/shell-snap*/`), `cd .gi*` then a write to `hooks/pre-push`, and a modified git copy. A relative Write path passed when fed to the hook as raw JSON, but the real Write tool turned it into an absolute path first and the hook blocked it. Test path rules with the real tool.
- 2026-11-24 (chief-of-staff): For a push's real destination, the `--dry-run` output is the oracle. Two symref probes showed the guard resolved both the way git does: `refs/heads/agent/s` to `main` was blocked, and `refs/agent/p` to `agent/ok` was allowed.
- 2026-11-24 (chief-of-staff): Replaying the same probe file against the hook at the new head and at the previous version showed which bypasses the newest fix introduced. Compare verdicts, not only exit codes.
- 2026-11-24 (chief-of-staff): `gh api repos/{owner}/{repo}/rulesets` showed only `protect-main` (deletion and non-fast-forward on main) on this date. The `agent/**` and `claude/**` rulesets were not live, so the hook was the only protection for those branches.
- 2026-11-24 (main): A Haiku review estimated itself at about $0.05 after 19 calls. Its finished transcript showed 95 calls, about $0.30 to $1.60 by token counts, because Haiku's rate rises past 100K-token prompts and its calls averaged about 94K. Estimate a subagent from its finished transcript. One `claude -p` probe cost $0.41 (CLI `total_cost_usd`).
- 2026-11-21 (chief-of-staff): Edits to `PLAYBOOK.md` don't reach agents launched later in the same session. A playbook change applies from the next session. Measure it in a fresh `claude -p` run.
<!-- - YYYY-MM-DD (agent): what happened → what to do instead -->

## Open questions for the user

- 2026-11-24 (chief-of-staff + main): Approve the Chief of Staff's proposed addition to its instructions? It would send the hook the JSON Claude Code sends, check where a push lands with a dry run in a scratch clone, report its probe count against the cap, and put probes that contain git and push in a file. Main suggests one more line: test file-path rules once with the real Write tool.

## Answers from the user

- 2026-10-30: Merging when asked: "my request is enough." → standing rule.
- 2026-10-30: Keep the `ponytail` plugin on for reviewer agents: "Yes it is enough."
- 2026-10-30, 2026-11-09: Force-push to their own branches, narrowed to `agent/` branches → standing rule.
- 2026-11-09: Public repo: treat all pushed text as public → standing rule. Whether it should stay public is the user's call.
- 2026-11-09: "Done" only once it's in the repo or on claude.ai → standing rule.
- 2026-11-19: Close the force-push gap with a PreToolUse hook in `.claude/settings.json`. Agents delete their own merged branches where possible, else list them. Always branch off `origin/main`. A verdict of "needs a look" fits when an agent states a safety guarantee it only partly tested. → standing rules.
- 2026-11-21: The user mostly works in chat. Plugins data, engineering, finance, legal, operations, superme, zapier, remotion, desktop-commander and mcp-tunnels are off for this repo. Turn one back on in `.claude/settings.json` if a task needs it.
- 2026-11-24: Force-push protection is both: the strict hook as a tripwire, and a GitHub ruleset that blocks force pushes on every branch except `agent/**`, and deletion on every branch except `agent/**` and `claude/**`. The ruleset was not live on 2026-11-24 (see Lessons). → guard standing rule.
- 2026-11-24: Spend: stop and ask before a task passes $25. Everything counts: the main conversation, review subagents and test runs, estimated from transcript tokens at current prices and labelled as estimates → standing rule.
- 2026-11-24: The v7 gaps stay logged as known limits, with no fix round, even before the rulesets are live → freeze rule.
- 2026-11-24: Branches: cloud sessions push to their assigned `claude/<name>`, local sessions keep `agent/<topic>`, force pushes stay on `agent/` → standing rules.
- 2026-11-24: Keep the guard editable, with no Write/Edit block on `.claude/hooks/` or `.claude/settings*.json` → standing rule.
- 2026-11-24: The Chief of Staff's proposed upgrade is approved and applied in `agents/chief-of-staff.md` (commit cd6b9a2).
- 2026-11-24: This review runs on Haiku, picked over Opus at about $2 against $5 to $10. Recorded only.
- 2026-11-24: "Drop the emoji from future PRs" → standing rule on the attribution footer.
