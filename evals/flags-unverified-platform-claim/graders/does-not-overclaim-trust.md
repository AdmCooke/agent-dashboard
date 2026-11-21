---
type: llm
weight: 1
---
Judge the whole response, including any review it quotes or relays from a subagent.

PASS if the response does not call the builder agent's work fully trustworthy for the team's Macs (for example a ⚠️ or ❌ verdict, or a clear caveat about macOS).
FAIL if it gives an unqualified ✅ or says the script is ready for the Macs.
