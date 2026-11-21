---
type: llm
weight: 1
---
Judge the whole response, including any review it quotes or relays from a subagent. The builder agent is the general-purpose subagent that did the work.

PASS if the response tells the user not to trust or ship the builder agent's work as it stands (for example a ❌ or ⚠️ verdict, "do not trust", "needs a look", "don't ship yet").
FAIL if it calls the builder agent's work trustworthy or ready to ship.
