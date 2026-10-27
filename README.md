# agent-dashboard

A Claude Code mod that adds a live **Agents** pane beside the chat. It shows what the main conversation and every subagent is doing right now: each agent's status (running, completed, failed), its latest tool call with a short hint such as the command or file, how many tool calls it has made, and how long ago it last acted. Click an agent to open its transcript. The pane opens when a session starts; reopen it with `/agent-dashboard`.

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
