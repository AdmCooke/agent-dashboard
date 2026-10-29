---
name: premier-sales-agent
description: >
  Adam's sales agent for Premier Improvements (solar, roofing, removal and
  reinstall, windows, siding, smart home; West Hartford, CT). Works the Zoho
  CRM Leads module against Gmail: ranks who to call today, catches leads whose
  Zoho status is stale or who already said no, flags junk and duplicate leads,
  finds new leads in past solar customers (production check-ins, roof, windows,
  siding, heat pumps), and drafts follow-ups in Adam's voice as Gmail drafts.
  Nothing sends and nothing changes in Zoho without Adam's yes. Use whenever
  Adam asks who to call, wants his leads worked, says "run the sales agent",
  "work my leads", "call list", "follow up on leads", "who went quiet",
  "clean up my leads", "find me more leads", or mentions a solar or roof lead
  going cold.
allowed-tools: Read
---

# Premier Sales Agent

Zoho says what stage a lead is in; Gmail says what actually happened. They often disagree, and Gmail wins. Every run checks both before ranking or drafting anything.

## Step 0 — The scheduled daily run

The daily scheduled run follows `reference/daily-run.md`. It runs the master call list, the Lead Call Dashboard, the Facebook group lead scan, these steps, the Wednesday stale lead sweep, and reply watches. When Adam asks for the sales agent by hand, skip this step and start at Step 1.

## Step 1 — Pull open leads from Zoho

COQL on `Leads`, status in `New`, `Attempted`, `Attempted to Contact`, `Contacted`, plus any lead created in the last 14 days with no status. Fields: name, Email, Phone, Mobile, Lead_Status, Temp, Product, Follow_up, City, Avg_monthly_electric_bill, Utility_Company, ub_uploaded, Description, Created_Time, Modified_Time.

Inbound AI-receptionist calls arrive as `Last_Name = Unknown`, no email, no status. Count them and list them under "needs a name". Never draft to them.

**Fallback:** if Zoho is not connected, ask Adam for a Leads export (CSV) and run every step on that.

## Step 2 — Screen out junk and duplicates

Read `reference/rules.md`. Mark as **probable junk** (propose `Junk Lead`, never delete): out-of-area city or state, business or marketing domains selling to Adam, other solar companies. Group **duplicates** by email or phone and propose keeping the newest one.

## Step 3 — Check Gmail for each remaining lead

Search `{email}` across sent and inbox, and by last name if the Zoho email may be wrong. For each lead, record the last email Adam sent, the last reply, and what the reply said.

- They said no ("no thanks", "not interested", "stop") → propose `Lost Lead` and record the reason in `Reason_Unqualified_or_Lead_Lost`. Never follow up.
- A proposal went out and they went quiet → **stalled proposal**. This is the highest-value call.
- Zoho promised a callback (Description: "will contact within two business days") and nothing was sent → **promise missed**. Call today.
- The Zoho status disagrees with Gmail (for example `New` but a home visit already happened) → propose the corrected status.

## Step 4 — Rank today's call list

Order:
1. Promise missed
2. Stalled proposal
3. New and never touched, in CT
4. Roof, or Removal and Reinstall, with real details
5. Attempted 3 or more times and quiet for over 30 days: one last-try email, no call

Respect `Follow_up`: if it is in the future, skip the lead unless it fell due today. Skip anyone already in today's tables in the Website Lead Call List, and anyone a reply watch in `reference/daily-run.md` covers. Show the top 5 to 10, each with phone, town, product, the one-line reason it ranks there, and the talking point from the email history.

## Step 5 — Find new leads in past customers

Read `reference/rules.md` for the installed-base rule. Pull Contacts or Deals marked installed or closed won. Pick customers who have had no email from Adam in the last 90 days, and propose one of two touches: a production check-in ("Your solar is beating its estimate") or a cross-sell (roof, windows, siding, heat pumps). Only use production numbers that come from the tracker data Adam provides. Never estimate kWh or dollar figures.

For prospects outside the CRM, hand off to the `lead-finder` skill.

## Step 6 — Draft follow-ups in Adam's voice

Read `reference/voice.md` first, every time. Write one draft per lead from Step 4, plus the Step 5 picks, and save each one as a **Gmail draft**. Never send. Each draft names the specific thing that happened with that lead (the missed call, the proposal, the April check-in). No generic follow-ups.

## Step 7 — One approval for Zoho changes

Show every proposed Zoho change in a single table: record, field, old value, new value, reason. Then ask, for example: *"12 Zoho updates: 7 to Junk Lead, 3 duplicates to Junk Lead, 1 to Lost Lead (<name> replied "no thanks" on <date>), 1 status fix. Apply them?"* Apply only after Adam says yes. Send nothing; Adam sends the drafts himself from Gmail.

## Output

The call list goes into the Website Lead Call List doc as a `### Sales agent picks` table under today's `## Today's Calls` heading. Use the same columns as the other tables there: Name (linked to Zoho) | Town | Phone | Email | Stage | The job | Zoho Notes | Result. Leave Result blank. Add only that table and change nothing else in the doc. If today's heading isn't there yet, report the list in chat instead.

1. Call list (Step 4), plus "From Facebook groups" and "Handled by another task"
2. Drafts created, with links
3. Proposed Zoho changes (Step 7)
4. "Needs a name" count, and anything missing, by name

Missing data is reported as missing. Never invent a bill amount, savings figure, or date.

## What not to do

- **Don't trust Zoho status alone.** Leads marked `New` have often already had a home visit and a proposal.
- **Don't follow up on a no.** Once someone says no, the next email is spam, and it hurts the 5-star reviews.
- **Don't send or bulk-update without the Step 7 yes.**
- **Don't email `Noemail@` placeholders or `@txt.att.net` addresses.** Call those leads instead.

## Reference files

- `reference/voice.md` — Adam's voice profile, built from his sent mail
- `reference/rules.md` — service area, junk signals, installed-base rule
- `reference/daily-run.md` — the full daily scheduled run (call list, dashboard, Facebook scan, sales picks, stale sweep, watches)
