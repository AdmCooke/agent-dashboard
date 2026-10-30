# agent-dashboard

A Claude Code mod that adds a live **Agents** pane beside the chat. It shows what the main conversation and every subagent is doing right now: each agent's status (running, completed, failed), its latest tool call with a short hint such as the command or file, how many tool calls it has made, how many tokens its model requests have used (input including cache, and output), an estimated cost in dollars at Anthropic's list prices (as of 2026-10-06; cards say "+ unpriced" for models it doesn't know), and how long ago it last acted. Click an agent to open its transcript. The pane opens when a session starts; reopen it with `/agent-dashboard`.

## Chief of Staff

Run `/chief-of-staff` (optionally with a focus, or your answers to its last questions) to launch the `chief-of-staff` subagent. It reads every agent's transcript in the session, checks each claim against the repo itself (diffs, files, test runs), and marks each claim VERIFIED, UNVERIFIED or WRONG. It flags waste and risk, and gives each agent a verdict. It never changes other agents' work.

It improves with use. It keeps a playbook at `~/.claude/chief-of-staff/playbook.md`, which it reads first on each run. After each review it adds lessons, promotes a lesson that recurs into a standing rule, proposes changes to its own instructions for you to approve, and ends with questions for you. Your answers become rules for later runs. The playbook is local to the machine, so in a cloud session it lasts only as long as the container.

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

This repository is private: it installs only for people who can read it on GitHub and whose machine already holds a git credential for github.com (an SSH key, or `gh auth login` then `gh auth setup-git`). The install never prompts for one.
