# Agent playbook

The main conversation and general-purpose subagents load this file through `CLAUDE.md`. Built-in Explore subagents do not. The Chief of Staff curates it after each review. Keep it short, because every agent pays for it in context.

## Standing rules

- Never report something as done or passing unless you saw the evidence in this run. Say what you did not check.
- Stay inside the task you were given. Name extra ideas in one line rather than building them.
- When the user asks you to merge a pull request, merge it. Their request is enough; don't wait for checks or a review first.
- Force-push only to branches you created yourself, never to anyone else's branch or to `main`.

## Before you finish, ask yourself

1. Did I check each claim in my answer myself, or am I repeating what I assume? Facts about GitHub, settings or plugins need a read from that system in this run (e.g. `gh api repos/{owner}/{repo}`).
2. Did I do what was asked: all of it, and nothing more?
3. What would the user ask next, and have I already answered it?
4. Did I hit an error, retry loop or surprise that the next agent should know about? If so, add one dated line under `## Lessons`.

## Lessons

- 2026-10-30 (main): Turning off 10 unused plugins cut a fresh session's starting context only from 46.4k to 42.4k tokens, because connector tools load on demand → measure before you promise savings from config changes.
- 2026-10-30 (main): Explore subagents don't load `CLAUDE.md` → when a task needs these rules, delegate it to a general-purpose agent, or paste the rule into the prompt.
- 2026-10-30 (chief-of-staff): A launch prompt said "no other subagents have run yet", but the session already had 3 finished subagents and 2 merged PRs → describe session state only from what you listed yourself (e.g. `ls <session>/subagents`), not from memory.
- 2026-10-30 (chief-of-staff): The GitHub merge tool rejects a short `expectedHeadSha` → pass the full 40-char `git rev-parse HEAD`.
- 2026-10-30 (chief-of-staff): A force push to an already-pushed branch was blocked as "Git Destructive", even on the agent's own branch → if the permission check blocks it, push to a new branch instead of retrying. (The user-level allow rule for `--force-with-lease` exists only in one cloud container.)
- 2026-11-09 (chief-of-staff): The allow rule `Bash(git push --force-with-lease *)` doesn't check whose branch it is, and `origin` has branches from other sessions (`claude/*`, `premier-sales-agent`) → before force-pushing, confirm you created that branch in this session.
- 2026-11-09 (chief-of-staff): Main told the user "the repo is private" without checking. `gh api repos/AdmCooke/agent-dashboard` says public → `gh` REST reads work here (GraphQL returns 403), so check before advising.
- 2026-11-09 (chief-of-staff): A nested `claude -p` run writes into the parent session's transcript as `user:` turns ("Run exactly…", "Reply with exactly: OK") → reviewers: don't mistake those for the user's requests.

<!-- - YYYY-MM-DD (agent): what happened → what to do instead -->

## Open questions for the user

- 2026-11-09: The force-with-lease allow rule lets agents force-push, without a prompt, to any branch except `main`, including branches from other sessions. Keep it, or narrow it to a prefix agents must use (e.g. `agent/*`)?
- 2026-11-09: The repo is public. Was that on purpose, and should agents treat commits and PR text as public (no secrets, no private notes)?
- 2026-11-09: Does a change that lives only in this cloud container (a user settings rule, a plugin install) count as "done", or only once it's in the repo or on claude.ai?

## Answers from the user

- 2026-10-30: Merging when asked: "my request is enough." → standing rule.
- 2026-10-30: Keep the `ponytail` plugin on for reviewer agents: "Yes it is enough."
- 2026-10-30: Force-push: allowed "to their own branches." → standing rule.
