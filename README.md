# agent-dashboard

A Claude Code mod that adds a live **Agents** pane beside the chat. It shows what the main conversation and every subagent is doing right now: each agent's status (running, completed, failed), its latest tool call with a short hint such as the command or file, how many tool calls it has made, how many tokens its model requests have used (input including cache, and output), an estimated cost in dollars at Anthropic's list prices (as of 2026-10-06; cards say "+ unpriced" for models it doesn't know), and how long ago it last acted. Click an agent to open its transcript. The pane opens when a session starts; reopen it with `/agent-dashboard`.

## Chief of Staff

Run `/chief-of-staff` (optionally with a focus, or your answers to its last questions) to launch the `chief-of-staff` subagent. It reads every agent's transcript in the session, checks each claim against the repo itself (diffs, files, test runs), and marks each claim VERIFIED, UNVERIFIED or WRONG. It flags waste and risk, and gives each agent a verdict. It never changes other agents' work.

It improves with use, and so does every other agent. The shared playbook is `PLAYBOOK.md` at the root of the project repo. The repo's `CLAUDE.md` imports it with `@PLAYBOOK.md`, so the main conversation and general-purpose subagents load it. Built-in Explore subagents skip `CLAUDE.md`, so they don't see it. They are read-only, so they couldn't add lessons anyway. In a project that doesn't import it yet, the Chief of Staff creates the file and adds the import line. The playbook holds standing rules, a short self-check every agent runs before finishing, and dated lessons that any agent can add.

After each review the Chief of Staff curates the playbook. It checks lessons other agents added, promotes recurring ones to rules for everyone, and adds checks that keep catching mistakes to the self-check list. It also proposes changes to its own instructions for you to approve, and ends with questions for you. Your answers become rules for all agents. Commit `PLAYBOOK.md` to keep what the agents learned. The Chief of Staff never commits it for you.

## Compliance Officer

Run `/compliance` with your website URL, social profile URLs, the states you operate in, or the text of a draft post or ad. The `compliance-officer` subagent checks the content against US federal law (FTC advertising, endorsement and review rules, the Green Guides, financing-ad disclosures, TCPA, CAN-SPAM, ADA accessibility), the laws of each state you operate in (privacy, telemarketing, contractor licensing, industry and door-to-door sales rules), and each platform's ad and promotion rules. It confirms every citation against a primary source during the run. It also runs a passive security check of the website: HTTPS, security headers, cookies, exposed files, outdated software, and the email records that stop spoofing.

It returns findings ranked High, Medium or Low, each with the exact text it flagged, the law it breaks, and a fix you can paste. For a single draft post it returns a corrected version. It is read-only: it never edits your site or posts, and it never claims something is fully compliant. It isn't legal advice, and it lists questions to take to an attorney. Social networks usually block scripts, so you may need to paste post text in.

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
