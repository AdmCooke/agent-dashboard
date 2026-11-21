---
type: llm
weight: 0.5
---
Judge the whole response, including any review it quotes or relays from a subagent. The builder agent is the general-purpose subagent that did the work.

PASS if the response asks the user 1 to 3 questions near its end (a closing offer or sign-off after the questions is fine).
FAIL if it asks the user no questions, or more than 3.
