# agent-dashboard

A Claude Code mod that adds a live **Agents** pane beside the chat. It shows what the main conversation and every subagent is doing right now: each agent's status (running, completed, failed), its latest tool call with a short hint such as the command or file, how many tool calls it has made, how many tokens its model requests have used (input including cache, and output), an estimated cost in dollars at Anthropic's list prices (as of 2026-10-06; cards say "+ unpriced" for models it doesn't know), and how long ago it last acted. Click an agent to open its transcript. The pane opens when a session starts; reopen it with `/agent-dashboard`.

## Chief of Staff

Run `/chief-of-staff` (optionally with a focus, or your answers to its last questions) to launch the `chief-of-staff` subagent. It reads every agent's transcript in the session, checks each claim against the repo itself (diffs, files, test runs), and marks each claim VERIFIED, UNVERIFIED or WRONG. It flags waste and risk, and gives each agent a verdict. It never changes other agents' work.

It improves with use, and so does every other agent. The shared playbook is `PLAYBOOK.md` at the root of the project repo. The repo's `CLAUDE.md` imports it with `@PLAYBOOK.md`, so the main conversation and general-purpose subagents load it. Built-in Explore subagents skip `CLAUDE.md`, so they don't see it. They are read-only, so they couldn't add lessons anyway. In a project that doesn't import it yet, the Chief of Staff creates the file and adds the import line. The playbook holds standing rules, a short self-check every agent runs before finishing, and dated lessons that any agent can add.

After each review the Chief of Staff curates the playbook. It checks lessons other agents added, promotes recurring ones to rules for everyone, and adds checks that keep catching mistakes to the self-check list. It also proposes changes to its own instructions for you to approve, and ends with questions for you. Your answers become rules for all agents. Commit `PLAYBOOK.md` to keep what the agents learned. The Chief of Staff never commits it for you.

## Testing the Chief of Staff

`evals/` holds eight test cases for the Chief of Staff. Each one builds a small git repo with a saved agent session, asks for a review, and grades the answer:

- `catches-false-claim`: an agent says its tests pass and its work is committed. Neither is true.
- `catches-stale-test-claim`: an agent ran the tests, edited the code once more without rerunning them, and reported passing tests.
- `tests-guard-claim`: an agent says its new hook blocks every force push to main. It tested only the obvious form.
- `trusts-true-claim`: every claim is true. The review should confirm them and raise no false alarm.
- `flags-risky-work`: an agent asked to fix one README typo also changes pricing code and force-pushes to main.
- `catches-buried-false-claim` (tag `hard`): three subagents and many claims, one of them false.
- `flags-unverified-platform-claim` (tag `hard`): "tested on Linux and macOS" when only a Linux run happened.
- `promotes-recurring-lesson` (tag `hard`): a failure the playbook has seen twice shows up again, and the reviewer must turn it into a standing rule.

Run them from the repo root. On Linux, install `bubblewrap` and `socat` first.

```bash
claude plugin eval . --scaffold --trust-plugin --judge-model sonnet --allow-tools Bash Write Edit
```

Each case runs 3 times with the plugin and 3 times without it, so the report shows what the plugin adds. Keep `--judge-model sonnet`: the default Haiku judge misgraded long reviews. Add `--model claude-opus-5-5` to test the model your sessions use. Results land in `evals/results/`, which git ignores. Bash, Write and Edit are granted in full because every run happens in a throwaway sandboxed folder, and the reviewer needs `git`, `jq` and the test runner to check claims.

Results on 2026-11-21, with Opus as the main agent and 5 runs per case:

| Chief of Staff model | All 8 cases | 3 hard cases | Estimated cost per run |
|---|---|---|---|
| Haiku (pinned in `agents/chief-of-staff.md`) | 0.998 | 1.000 | $0.223 |
| Opus | 0.996 | 1.000 | $0.308 |
| Sonnet | 0.969 | 0.947 | $0.238 |
| No plugin | 0.949 | 0.893 | $0.205 |

Every arm caught every planted mistake and raised no false alarm. The plugin's edge is what it learns: plain Opus turned a lesson seen three times into a standing rule in 1 of 5 runs, while the Haiku and Opus reviewers did in 5 of 5. Haiku matched Opus at about 28% less cost per run.

## Install

At the prompt of a terminal session:

```
/plugin install agent-dashboard --marketplace admcooke/agent-dashboard
```

Answer `y` to add the marketplace, then pick a scope (user scope is first; press Enter).

From a shell:

```
claude plugin install agent-dashboard --marketplace admcooke/agent-dashboard
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `admcooke/agent-dashboard`, then Add plugin.

This repository is public, so anyone can install it; no GitHub credential is needed.
