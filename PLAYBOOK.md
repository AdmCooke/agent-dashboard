# Agent playbook

The main conversation and general-purpose subagents load this file through `CLAUDE.md`. Built-in Explore subagents do not. The Chief of Staff curates it after each review. Keep it short, because every agent pays for it in context.

## Standing rules

- Never report something as done or passing unless you saw the evidence in this run. Say what you did not check.
- Stay inside the task you were given. Name extra ideas in one line rather than building them.
- When the user asks you to merge a pull request, merge it. Their request is enough; don't wait for checks or a review first.
- Force-push only to branches you created yourself, never to anyone else's branch or to `main`.

## Before you finish, ask yourself

1. Did I check each claim in my answer myself, or am I repeating what I assume?
2. Did I do what was asked: all of it, and nothing more?
3. What would the user ask next, and have I already answered it?
4. Did I hit an error, retry loop or surprise that the next agent should know about? If so, add one dated line under `## Lessons`.

## Lessons

- 2026-10-30 (main): Turning off 10 unused plugins cut a fresh session's starting context only from 46.4k to 42.4k tokens, because connector tools load on demand → measure before you promise savings from config changes.
- 2026-10-30 (main): Explore subagents don't load `CLAUDE.md` → when a task needs these rules, delegate it to a general-purpose agent, or paste the rule into the prompt.
- 2026-10-30 (chief-of-staff): A launch prompt said "no other subagents have run yet", but the session already had 3 finished subagents and 2 merged PRs → describe session state only from what you listed yourself (e.g. `ls <session>/subagents`), not from memory.
- 2026-10-30 (chief-of-staff): The GitHub merge tool rejects a short `expectedHeadSha` → pass the full 40-char `git rev-parse HEAD`.
- 2026-10-30 (chief-of-staff): A force push to an already-pushed branch was blocked as "Git Destructive", even on the agent's own branch → if the permission check blocks it, push to a new branch instead of retrying.

<!-- - YYYY-MM-DD (agent): what happened → what to do instead -->
- 2026-10-30 (main): In cloud sessions, curl to ftc.gov, irs.gov, ecfr.gov, consumerfinance.gov and cslb.ca.gov all returned `000` (blocked) → verify legal citations with WebSearch restricted to the primary domain, and expect the user's own website may be blocked too.
- 2026-10-30 (main): Fetching a site the network policy blocks through the Bright Data connector was refused as "Containment Escape" until the user approved Bright Data for that site in chat → ask first, and scope the approval to the user's own domains.
- 2026-10-30 (main): Elementor page text lives in the `_elementor_data` post meta (150–400 KB of JSON per page), so rewriting it through the WordPress connector is impractical. A one-time plugin that does exact replacements server-side works, but the connector's `plugin.upload` to a Jetpack site returned 403 (likely the site firewall) → hand the user the zip to upload in wp-admin instead of retrying.

## Open questions for the user

## Answers from the user

- 2026-10-30: Merging when asked: "my request is enough." → standing rule.
- 2026-10-30: Keep the `ponytail` plugin on for reviewer agents: "Yes it is enough."
- 2026-10-30: Force-push: allowed "to their own branches." → standing rule.
