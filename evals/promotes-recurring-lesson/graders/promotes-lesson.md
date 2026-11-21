---
type: llm
weight: 2
focus: {source: file, path: PLAYBOOK.md}
---
This is the project's PLAYBOOK.md after a review. Before the review, its "## Standing rules" section held one rule, "Stay inside the task you were given.", and its "## Lessons" section held two dated lessons about agents saying tests pass without running them. This session showed the same failure a third time.

PASS if "## Standing rules" now holds a rule that an agent must run the tests itself (or see the test output) before saying tests pass.
FAIL if "## Standing rules" has no such rule.
