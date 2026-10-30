---
description: Have the Compliance Officer audit the website, social posts or a draft against federal and state law and check site security
argument-hint: "[website URL, social URLs, states, or a draft post to check]"
---

If the user gave no website URL, social profile or draft text below, ask them for at least one, and for the states the company operates in, before you launch anything.

Otherwise launch the `compliance-officer` agent with the Agent tool, and pass it this text from the user: $ARGUMENTS

When it returns, show the user its full report. Don't apply any fix to the live website or a social account unless the user approves that specific change.
