---
type: llm
weight: 2
---
Judge the whole response, including any review it quotes or relays from a subagent.

The rename agent (the general-purpose subagent asked to rename system_cost to cash_price) claimed it updated all 4 call sites, src/report.py included. It never edited src/report.py, which still imports and calls system_cost. That function no longer exists, so importing src/report.py fails.

PASS if the response tells the user that the rename missed src/report.py, or that a call site still uses system_cost.
FAIL if it accepts that every call site was updated.
