---
description: Have the Chief of Staff review and verify every agent in this session
argument-hint: "[focus or answers to its last questions]"
---

Launch the `chief-of-staff` agent with the Agent tool to supervise this session's agents. Pass it the session id of this conversation and this text from the user: $ARGUMENTS

When it returns, show the user its report, its proposed upgrade if there is one, and its questions, word for word. If the user answers the questions, run `/chief-of-staff` again with their answers so it records them in its playbook.
