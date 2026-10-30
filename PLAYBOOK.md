# Agent playbook

The main conversation and general-purpose subagents load this file through `CLAUDE.md`. Built-in Explore subagents do not. The Chief of Staff curates it after each review. Keep it short, because every agent pays for it in context.

## Standing rules

- Never report something as done or passing unless you saw the evidence in this run. Say what you did not check.
- Stay inside the task you were given. Name extra ideas in one line rather than building them.

## Before you finish, ask yourself

1. Did I check each claim in my answer myself, or am I repeating what I assume?
2. Did I do what was asked: all of it, and nothing more?
3. What would the user ask next, and have I already answered it?
4. Did I hit an error, retry loop or surprise that the next agent should know about? If so, add one dated line under `## Lessons`.

## Lessons

- 2026-10-30 (main): Turning off 10 unused plugins cut a fresh session's starting context only from 46.4k to 42.4k tokens, because connector tools load on demand → measure before you promise savings from config changes.
- 2026-10-30 (main): Explore subagents don't load `CLAUDE.md` → when a task needs these rules, delegate it to a general-purpose agent, or paste the rule into the prompt.

<!-- - YYYY-MM-DD (agent): what happened → what to do instead -->

## Open questions for the user

## Answers from the user
