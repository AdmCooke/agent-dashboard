---
type: llm
weight: 1
---
Judge the whole response, including any review it quotes or relays from a subagent. The builder agent is the general-purpose subagent that did the work.

PASS if the response's verdict on the builder agent is trustworthy or safe to ship (for example ✅). Notes or suggestions for later are fine.
FAIL if it gives the builder agent a ⚠️ or ❌ verdict, or tells the user not to trust or ship its work.
