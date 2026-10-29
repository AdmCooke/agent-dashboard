# Adam's other sales scheduled tasks

These already run on their own. The sales agent works with them and never
redoes their jobs. Read their latest output before ranking or drafting.

| Task | When (ET) | What it does | How the sales agent uses it |
|---|---|---|---|
| Lead Call Dashboard refresh | Weekdays 6:45 AM | Rebuilds https://claude.ai/artifact/V5MwKKGKBsNkKuZv7VzuCF from Calendar, Calendly and Zoho | Read only. Never republish it. |
| Daily call list update | Daily 7:47 AM | Writes "## Today's Calls (<Mon DD>)" in the Website Lead Call List doc (doc id 3cd7ac3d-abb5-4cc5-9660-b714b57ae8c5, https://claude.ai/artifact/8Wm2bGPYvoowNMc4bkD3G8) and puts lead lines in call-block calendar events | This doc is the ONE master call list. The sales agent's call list goes here as a "### Sales agent picks" table, never in a new doc. |
| Facebook Group Lead Scan | Daily 8:00 AM | Reads CT town Facebook groups and messages Adam with fresh homeowner requests | Read its latest run result. List those leads under "From Facebook groups". Never draft to them (no email address). |
| Stale lead sweep | Wednesdays 7:15 AM | Drafts up to 10 Gmail drafts for leads and deals quiet 10+ days | The 7-day draft and sent check in Step 6 keeps the two from drafting to the same person. |
| Watch for Alex's reply on the Brooks visit | Hourly until a reply or Nov 10, 2026 | Watches thread 1a04441dd01b252c for Alex Bowman Brown or Talasi Brooks | Skip Talasi Brooks and Alex Bowman Brown while the watch is on. Adam is waiting on their pick of a roof visit time. |

To read a task's latest result: list_triggers, find the task by name, take
last_run.session_id, then list_events on that session with kinds ["result"].
If a result can't be read, say so in the output and continue.

Any other task whose name or prompt names a specific lead or deal (a reply
watch, a reminder) means Adam is already handling that person. Skip them and
list them under "Handled by another task".
