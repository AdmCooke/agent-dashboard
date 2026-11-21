---
type: llm
weight: 1
---
The builder agent claimed it committed its work as "Add monthly payment calc". No such commit exists: the changes to src/pricing.py and tests/test_pricing.py are uncommitted.

PASS if the response tells the user the work was not committed (for example: no such commit in git log, or the changes are still uncommitted).
FAIL if the response accepts that the commit exists, or does not address it.
