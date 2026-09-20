# DVTech — Revision Spec & Prompts

Source: `MGA-KULANG-PA.docx` (Tagalog feedback + 16 screenshots). Everything below was read from both the text and the screenshots.
Prepared: Saturday, Sep 19, 2026. Stated deadline: **deploy tomorrow (Sun, Sep 20, 2026)**; evaluators send results **Mon/Tue (Sep 21–22)**.

---

## 0. How to use this file

1. Paste the **Master Context Prompt** (Section 2) into your coding agent once per session.
2. Paste the revision prompts **one at a time**, in the recommended order (Section 1). Wait for the agent's summary before the next one.
3. Each revision has: the original Tagalog line, the English meaning, the screenshot evidence, requirements (EARS style: WHEN / THE SYSTEM SHALL), and the **exact prompt** in a code block.
4. Before deploying, run the checklist in Section 6.

**Important gap:** the feedback refers to a second file, `INQUIRY.DOCX`, which holds the "full transaction" of Request Quotation. It was **not** in this upload. Revisions C4 and A6 depend on it, so attach it to the agent when you run those two prompts.

---

## 1. Summary and recommended order

| Order | ID | Area | Revision | Priority |
|---|---|---|---|---|
| 1 | A2 | Admin | Assign Technician dropdown always fails / empty | P0 |
| 2 | A3 | Admin | Reassign Technician dropdown always fails / empty | P0 |
| 3 | T5 | Technician | "Task can only be completed when status is in-progress" shows even when In Progress | P0 |
| 4 | T4 | Technician | Submit Report gives "unexpected error" | P0 |
| 5 | A7 | Admin | Activating a technician gives "unexpected error" | P0 |
| 6 | C1 | Customer | AI Recommendation: wrong HP (4.5/6.5 instead of ~1.5–2) and floor-standing shown | P0 |
| 7 | C3 | Customer | OpenCV analysis inflates the result; floor-standing again | P0 |
| 8 | A1 | Admin | Assign modal: autofill customer's requested date and time | P1 |
| 9 | A4 | Admin | Reassign: status "Reassigned", move schedule to new technician, remove from old | P1 |
| 10 | A5 | Admin | Reschedule: auto-expire instead of waiting 2 days when date is too close | P1 |
| 11 | T2 | Technician | Cannot Start a task before its assigned date and time | P1 |
| 12 | C4 | Customer | Add "My Quotations" tab | P1 |
| 13 | A6 | Admin | Add "Manage Quotations" tab | P1 |
| 14 | C2 | Customer | Auto-scroll (or hint) to the AI result | P2 |
| 15 | T1 | Technician | Remove Dashboard | P2 |
| 16 | T3 | Admin (listed under Technician) | Remove Previous/Next; continuous scroll | P2 |
| 17 | A8 | Admin | Remove "busy" from technician Availability | P2 |

Why this order: P0 items break core flows or are visibly wrong on evaluation day. A2/A3 come first because A1, A4 and A5 all depend on the same "available technicians" logic.

---

## 2. Master Context Prompt (paste once, first)

```text
You are working on DVTech, an air-conditioning sales-and-service web app with three roles: Customer, Admin, Technician.

Known screens:
- Customer Panel: My Requests, AI Recommendation (room assessment + OpenCV image analysis + unit recommendations), Repair Tips, Chat.
- Admin: Manage Schedules (Requests Awaiting Scheduling, All Schedules, Assign / Reassign / Reschedule modals), Manage Accounts (Customers / Technicians / Archive), Products catalog table.
- Technician Panel: My Tasks (Assigned / In Progress / Completed), Complete Task modal (report + photo).

We will implement a numbered list of revisions from stakeholder feedback, ONE AT A TIME. I will send each as "REV-<ID>".

Rules for every revision:
1. Inspect the repository first (framework, routes, DB schema, existing tests). Do not assume the stack.
2. Change only what the revision requires. No unrelated refactors, renames, or dependency upgrades.
3. For bugs: reproduce first, state the root cause in 1-2 sentences, then fix the cause. Do not just hide or reword the error message.
4. Enforce every business rule on the server as well as in the UI.
5. Timezone is Asia/Manila. Time slots: Morning = 8:00 AM-11:59 AM, Afternoon = 12:00 PM-5:00 PM.
6. Keep the existing visual style and components.
7. Add or update automated tests that cover the acceptance criteria, then run them.
8. If something is ambiguous, take the most conservative reading and list the assumption in your summary. Do not silently invent features.
9. Finish every revision with: (a) files changed, (b) root cause or design decision, (c) manual test steps, (d) assumptions.

Reply only with "ready" and wait for the first REV prompt.
```

---

# CUSTOMER SIDE

## REV-C1 — AI Recommendation: wrong HP and floor-standing units (P0)

**Original (Tagalog):** "BALE DITO KUYS DIBA DAPAT 1.5 HP YAN NAGING 4.5 SIYA AND FLOOR STANDING DAW WHICH IS WINDOW TYPE OR SPLIT TYPE LANG DAPAT"

**Meaning:** This result should be 1.5 HP, but it came out as 4.5 HP. It also recommends a floor-standing unit, but only Window Type or Split Type should ever be recommended.

**Evidence:**
- Screenshot 1: total load **9,690 BTU**, yet the text says "4.5 HP … floor-standing".
- Screenshots 3–5: total **14,475 BTU**, the text says "6.5 HP … floor-standing", but the unit cards below are **2 HP Split-Type**. The explanation and the units disagree.
- Products table (screenshot 13): only Window Type and Split Type exist; HP tiers seen: 0.75 = 7,500 BTU, 1.0 = 9,000–9,500, 1.5 = 11,900–12,000, 2.0 = 18,000. Page 2 of the catalog was not visible.
- Sanity check: 9,690 BTU is above the 1.0 HP tier (~9,000–9,500) and below 1.5 HP (12,000), so the correct answer is **1.5 HP**, which matches the feedback exactly.

**Requirements:**
- R1. THE SYSTEM SHALL only recommend Window Type or Split Type. Floor-standing SHALL NOT appear in the text, tips, unit cards, or the AI prompt/schema/fallbacks.
- R2. WHEN a BTU load is computed, THE SYSTEM SHALL derive the HP deterministically: the smallest HP tier in the products table whose rated BTU is at least the computed load.
- R3. THE SYSTEM SHALL treat HP and unit type as fixed inputs to any LLM explanation; the LLM may only write prose and SHALL NOT choose or change them. Output that contradicts the computed HP SHALL be replaced or regenerated.
- R4. THE "Why this recommendation" text, the electrical/breaker tips and the unit cards SHALL all use the same HP value.
- R5. IF the load exceeds the largest HP in the catalog, THE SYSTEM SHALL show a "needs site survey / multiple units" message, still without floor-standing.
- R6. Unit card specs (HP, BTU, inverter/non-inverter, price) SHALL be read from the products table. (Observed, not in the feedback: Sharp AH-X18YMD shows Non-Inverter on the card but Inverter in the catalog.)

**Exact prompt:**

```text
REV-C1 — Fix AI Recommendation HP sizing and unit types.

Problem: The room assessment computed 9,690 BTU but the UI recommended "4.5 HP floor-standing". Another run computed 14,475 BTU but the explanation said "6.5 HP floor-standing" while the unit cards below were 2 HP split-type. Expected for 9,690 BTU is 1.5 HP.

Required behavior:
1. Only Window Type and Split Type may ever be recommended. Remove floor-standing everywhere: the AI prompt, response schema/enums, fallback logic, explanation text, tips, and unit cards.
2. Derive HP deterministically from the computed BTU: choose the smallest HP tier in the products table whose rated BTU is >= the computed load. Read the tiers from the database (I have seen 0.75=7,500; 1.0=9,000-9,500; 1.5=11,900-12,000; 2.0=18,000 BTU, but check all 15 products, including page 2).
3. If an LLM writes the explanation, pass HP and unit type in as fixed values. It must not choose or alter them. Validate its output against the computed values and replace any mismatch.
4. The "Why this recommendation" text, the Electrical Tips, the Breaker Tips and the Recommended Units cards must all reflect the same HP. Tips must be selected for the recommended HP class, not for a larger one.
5. If the load exceeds the largest catalog capacity, show a "site survey / multiple units" message instead of inventing a bigger HP. Never floor-standing.
6. Recommended Unit cards must read HP, BTU, unit type (Inverter/Non-Inverter) and price straight from the products table. Currently Sharp AH-X18YMD shows Non-Inverter on the card but Inverter in the catalog; fix the source of truth.

Acceptance tests:
- 9,690 BTU -> 1.5 HP, Window or Split only.
- 14,475 BTU -> 2.0 HP Split only (no window unit reaches 18,000 BTU in the catalog).
- No response, in any test, contains "floor" (case-insensitive).
- Text HP == card HP for every test.

Return the summary per the master rules.
```

---

## REV-C2 — Auto-scroll to the result (P2)

**Original:** "BALE DAPAT PAGLABAS NG RESULT AUTOMATIC MAGSSCROLL YUNG PAGE OR HINT NALANG KUYS NA NASA BABA NA YUNG RESULT."

**Meaning:** When the result appears, the page should auto-scroll to it, or at least show a hint that the result is below.

**Evidence:** Screenshot 2 shows the form and the "Get AI Recommendation" button; the result renders far below the fold.

**Requirements:**
- R1. WHEN the recommendation finishes loading, THE SYSTEM SHALL smooth-scroll so the top of the result is in view.
- R2. IF the result is not fully reachable or the user has scrolled elsewhere, THE SYSTEM SHALL show a visible "Result ready ↓" hint that scrolls to the result on click.
- R3. IF the user prefers reduced motion, THE SYSTEM SHALL jump instead of animating.
- R4. THE SYSTEM SHALL scroll only for a new result, not on unrelated re-renders.

**Exact prompt:**

```text
REV-C2 — Auto-scroll to the AI Recommendation result.

Problem: After clicking "Get AI Recommendation" the result renders far below the form and the customer does not notice it.

Required behavior:
1. When the recommendation response arrives, smooth-scroll to the top of the result container (scrollIntoView with a small top offset for the sticky header).
2. Also show a temporary "Result ready ↓" hint/button when the result top is not in the viewport (use IntersectionObserver); clicking it scrolls to the result; it disappears once the result is visible.
3. Respect prefers-reduced-motion (jump, no animation).
4. Move keyboard focus to the result heading (tabindex=-1) for accessibility.
5. Scroll only when a new result is produced. Not on re-render, not on failed requests.
6. Show a loading state on the button while waiting, and prevent double submission.

Acceptance: submit the form -> the result heading is visible without manual scrolling on desktop and on a 375px-wide viewport. Add a UI/component test if the project has a UI test setup.
```

---

## REV-C3 — OpenCV analysis inflates the result (P0)

**Original:** "SAME DITO KUYS NUNG NILAGYAN NA NAMEN NG OPEN CV ANALYSIS BASE SA COMPUTATION MGA NASA 2HP LANG PERO PARANG MAY PASOBRA SIYA TSAKA YUNG FLOOR STANDING DI REN DAPAT GANYAN MGA NASA SPLIT TYPE LANG YUNG GANYAN"

**Meaning:** Same issue after the OpenCV analysis was added: based on the computation the result should be around 2 HP, but it looks excessive, and floor-standing shouldn't appear; a load like this belongs to split type only.

**Evidence (screenshots 3–4):**
- Total 14,475 BTU is about a 2 HP job, but the narrative says 6.5 HP.
- Sunlight is counted from the form ("Sunlight (medium) 2 x 500 = 1,000") **and** OpenCV lists "Direct Sunlight" as a heat source.
- Lighting (2 x 100) and "Microwave Oven" (1 x 1000) appear as line items; OpenCV shows "Kitchen Appliances".
- "Windows Detected: 0" but the text says "high sunlight exposure through multiple windows".
- "Poor insulation (+10–15% BTU adjustment)" and "heat gain adjustment" are applied on top.
- Window units in the catalog top out at 1.5 HP, so a ~2 HP load can only be split type.

**Requirements:**
- R1. THE SYSTEM SHALL list every load contribution (form inputs and OpenCV-derived) as separate line items that sum exactly to the total.
- R2. THE SYSTEM SHALL NOT double count the same heat source (for example sunlight from the form and from OpenCV).
- R3. THE SYSTEM SHALL cap the total OpenCV-driven uplift at a single configurable constant (default proposed: 15% of the base load; confirm with the team).
- R4. THE narrative SHALL be generated from the measured values only (0 windows detected means no "multiple windows" claim).
- R5. THE HP/type rules of REV-C1 SHALL apply to this path as well.

**Exact prompt:**

```text
REV-C3 — Stop the OpenCV analysis from inflating the recommendation.

Problem: With the OpenCV room-photo analysis enabled, a 14,475 BTU total (about 2 HP) came out as "6.5 HP floor-standing" in the narrative. Reviewers say the result looks excessive.

Investigate and fix:
1. Trace the full pipeline: form inputs -> BTU formula -> OpenCV metrics (windows, sunlight, insulation, heat sources, brightness/contrast/warm-area ratio) -> adjustments -> HP -> narrative. List every place a value is added.
2. Remove double counting. Example: sunlight is added from the form ("Sunlight (medium) 2 x 500") and OpenCV also lists "Direct Sunlight" as a heat source; lighting and "Kitchen Appliances/Microwave" may also be added twice.
3. Cap the combined OpenCV-driven uplift (windows/sunlight/insulation/heat-gain/heat sources) to one named constant, default 15% of the base load, easy to change.
4. Show every contribution, including each OpenCV adjustment, as its own labeled row in "How we computed this", and make the rows sum exactly to the Total.
5. Make the narrative consistent with the measurements: if "Windows Detected" is 0 do not say "multiple windows"; do not say "poor insulation" unless that flag is set.
6. Apply the REV-C1 rules on this path too: HP from the deterministic mapping, and never floor-standing.

Acceptance tests:
- Same inputs with and without a photo differ by at most the cap.
- The same heat source is never counted twice.
- The displayed rows sum to the Total.
- 14,475 BTU with OpenCV metrics -> 2 HP, split type, never 6.5 HP.
```

---

## REV-C4 — "My Quotations" tab (P1)

**Original:** "BALE DITO KUYS TAMA SIYA NA NAPUPUNTA SA SERVICE REQUEST PAG OKAY NA PERO DAPAT MAYROONG MY QUOTATION NA TAB PARA DON MAKIKITA YUNG MGA QUOTATION NIYA NA REQUEST BALE MAPUPUNTA LANG JAN PAG ASSIGNED NA ANG STATUS OR PAID KASE DI KO MAKITA YUNG PART NA ANO EH YUNG MGA NASA INQUIRY.DOCX NA SINEND NAMEN YUNG MGA NANDON PERO YUNG IBA NANJAN NA NAMAN PARANG KULANG LANG"

**Meaning:** It's correct that an approved request moves to Service Requests, but there should be a "My Quotation" tab where the customer sees the quotations they requested. Requests only appear in My Requests once Assigned or Paid, so the customer can't see earlier quotation steps. Some parts described in INQUIRY.DOCX exist, others seem missing.

**Evidence:** Screenshot 6 — Customer Panel sidebar has only My Requests, AI Recommendation, Repair Tips, Chat. Quotation requests start from the "View & Request Quotation →" button on the unit cards (screenshot 5).

**Requirements:**
- R1. THE Customer Panel SHALL have a "My Quotations" item listing all of the customer's quotation requests from the moment they are submitted.
- R2. EACH row SHALL show at least: quotation ID, unit (brand/model), submitted date, current status, and a details action.
- R3. THE tab SHALL offer search and a status filter, matching My Requests.
- R4. WHEN a quotation reaches Assigned or Paid, THE SYSTEM SHALL keep the existing behavior (it also appears in My Requests) while still remaining in My Quotations.
- R5. THE quotation statuses and steps SHALL follow `INQUIRY.DOCX`; any step in that document not yet implemented SHALL be listed before coding.

**Exact prompt:**

```text
REV-C4 — Add a "My Quotations" tab to the Customer Panel.

ATTACH: INQUIRY.DOCX (it contains the full Request Quotation transaction). Read it completely first.

Step 1 (before any code): compare INQUIRY.DOCX against what is implemented today (quotation request creation from the "View & Request Quotation" button on the recommended-unit cards, statuses, transitions, notifications, data stored). Output a short gap list: implemented / partially implemented / missing.

Step 2: implement the missing customer-facing pieces:
1. Add "My Quotations" to the Customer Panel sidebar (between My Requests and AI Recommendation) and a matching route/page.
2. List every quotation request of the logged-in customer from the moment it is submitted, newest first: quotation ID, unit (brand + model), submitted date, current status, and a "View details" action. Add a search box and a status filter, same style as My Requests. Add an empty state.
3. Keep today's behavior: once a quotation reaches Assigned or Paid it also appears in My Requests. It stays visible in My Quotations too.
4. Use the exact statuses and wording defined in INQUIRY.DOCX. Do not invent new ones.
5. A customer may only see their own quotations (enforce on the server).

Acceptance tests: submit a quotation -> it is visible in My Quotations immediately with the first status; it is not in My Requests until Assigned/Paid; another customer cannot see it.
Report any INQUIRY.DOCX step you could not implement and why.
```

---

# ADMIN SIDE

## REV-A1 — Assign modal: autofill date and time (P1)

**Original:** "MANAGE SCHEDULES — BALE DITO KUYS DI PA NAKA AUTO FILL YUNG DATE AND TIME WHICH IS NAKA AUTO FILL NA DAPAT KASE NAG REQUEST NA NG DATE AND TIME YUNG CUSTOMER EH BALE ANG GAGAWEN NA LANG DAPAT JAN IS I FIFILTER SA DROPDOWN NA YAN KUNG SINO AVAILABLE NA TECHNICIAN SA DATE AND TIME NA NAKA AUTOFILL"

**Meaning:** Date and time aren't autofilled yet; they should be, because the customer already requested them. The only thing left to do in the modal is filter the dropdown to technicians available at that date and time.

**Evidence:** Screenshot 7: Scheduled Date is empty (`mm/dd/yyyy`), Time Slot defaults to Morning, Technician says "Choose a date first…". Screenshot 10: SR-0011 already has "Sep 30, 2026 — Morning".

**Requirements:**
- R1. WHEN the Assign modal opens for a request that has a customer-requested date and slot, THE SYSTEM SHALL prefill Scheduled Date and Time Slot from the request.
- R2. THE SYSTEM SHALL immediately load the technician dropdown filtered to that date and slot (uses REV-A2 logic).
- R3. IF the request has no requested date/slot (shown as "—" in the table), THE SYSTEM SHALL leave the fields editable and empty. (Assumption: when prefilled they stay editable so the admin can override; confirm.)

**Exact prompt:**

```text
REV-A1 — Autofill date and time in the Assign Technician modal.

Problem: The customer already chose a required date and slot (example: SR-0011, "Sep 30, 2026 — Morning") but the Assign Technician modal opens with an empty date and a default Morning slot, and the technician dropdown says "Choose a date first...".

Required behavior:
1. When the modal opens for a request that has a customer-requested date and time slot, prefill Scheduled Date and Time Slot from that request (do not use the default Morning).
2. As soon as it is prefilled, load the Technician dropdown filtered to technicians available for that exact date + slot. The admin's only remaining job is to pick a technician (and priority).
3. Keep the fields editable so the admin can override; if changed, reload the dropdown.
4. If the request has no requested date/slot, keep the current manual behavior.
5. Save the same date/slot to the schedule that the dropdown was filtered on. Make sure the timezone (Asia/Manila) cannot shift the date by one day.

Depends on REV-A2 (available technicians). Do not change the availability logic here.
Acceptance tests: open Assign for a request with Sep 30 Morning -> fields prefilled, dropdown loaded for Sep 30 Morning; request without a date -> fields empty and editable.
```

---

## REV-A2 — Assign dropdown always says "no technicians available" (P0)

**Original:** "LAGE GANTO LUMALABAS KAHIT ANO DATE NA ILAGAY NAMEN EH MAY AVAILABLE NAMAN"

**Meaning:** This always appears whatever date we enter, even though technicians are available.

**Evidence:** Screenshot 8: "No technicians available for this slot" plus red "Failed to load available technicians for this date." for 09/30/2026 Morning. Screenshot 16: three technicians show as available and Active. The red text suggests the request itself is failing, not an empty result.

**Requirements:**
- R1. THE available-technicians endpoint SHALL return every technician who is Active and has no conflicting schedule for the requested date and slot.
- R2. THE UI SHALL distinguish a failed request (error + retry) from a genuinely empty list ("No technicians available").
- R3. THE result SHALL NOT depend on a stored "busy" flag (see REV-A8).

**Exact prompt:**

```text
REV-A2 — Fix "available technicians" in the Assign Technician modal.

Problem: For any date and slot (example 09/30/2026 Morning) the Technician dropdown shows "No technicians available for this slot" together with the red message "Failed to load available technicians for this date.", even though Manage Accounts shows three active technicians with availability "available".

Do this:
1. Reproduce it. Call the available-technicians endpoint used by the modal and capture the real response/log. Find the root cause (candidates: failing request or 4xx/5xx, wrong query parameter names or date format/timezone, a slot enum mismatch such as "Morning" vs "morning", a join or filter on a stale "busy" flag or wrong status, a wrong role filter).
2. Fix the cause so the endpoint returns all technicians who are Active and have NO conflicting non-cancelled schedule for that exact date + time slot. Two technicians on different slots or dates must not block each other. A technician must not appear if already scheduled in the same date + slot.
3. In the UI, separate the two cases: request failed -> show an error with a Retry action; request succeeded with an empty list -> show "No technicians available for this slot".
4. The result must be computed from the schedules table, not from a manually set "busy" availability value.
5. Reuse the same function for REV-A3 (Reassign); expose it as one shared service/function that can exclude the current technician.

Acceptance tests: 3 active technicians, none scheduled -> all 3 returned; one already scheduled Sep 30 Morning -> only the other 2 for Sep 30 Morning, but all 3 for Sep 30 Afternoon; deactivated technician never returned; endpoint failure shows the error state.
```

---

## REV-A3 — Reassign dropdown always empty (P0)

**Original:** "SAME SA REASSIGNED KUYS WALANG LUMALABAS KAHIT MERON NAMAN"

**Meaning:** Same in Reassign: nothing shows even though there are technicians.

**Evidence:** Screenshot 9: Reassign Technician for Schedule #6 (Juan Dela Cruz, Oct 1, 2026 — Afternoon) shows "No technicians available for this slot" and "Failed to load available technicians for this slot." The Reassign button stays disabled.

**Requirements:**
- R1. THE Reassign dropdown SHALL list technicians who are Active, free for the same date and slot, and different from the current technician.
- R2. THE same shared function and error/empty handling of REV-A2 SHALL be used.

**Exact prompt:**

```text
REV-A3 — Fix the Reassign Technician dropdown.

Problem: In "Reassign Technician" (example: Schedule #6, current technician Juan Dela Cruz, Oct 1, 2026 - Afternoon) the New Technician dropdown always shows "No technicians available for this slot" with "Failed to load available technicians for this slot", although other technicians are free. The Reassign button stays disabled.

Required behavior:
1. Use the same shared available-technicians function fixed in REV-A2. If REV-A2 is not done yet, do it first.
2. Exclude the current technician of that schedule from the list.
3. Include only Active technicians with no conflicting schedule at the same date + slot.
4. Distinguish an error (with Retry) from a genuinely empty list, and if the list is empty keep the existing hint about proposing a reschedule.
5. Enable the Reassign button only when a technician is selected.

Acceptance tests: Schedule #6 (Oct 1 Afternoon, Juan) with Pedro free -> Pedro listed, Juan not; Pedro busy at Oct 1 Afternoon -> not listed.
```

---

## REV-A4 — Reassign: status and schedule transfer (P1)

**Original:** "TAPOS JAN KUYS PAG REASSIGNED MAGIGING REASSIGNED NA ANG STATUS DAPAT PAG TAPOS THEN MAPUPUNTA YUNG SCHEDULE DETAILS SA BAGONG TECHNICIAN TAPOS YUNG LUMA MAWAWALA YUNG SCHEDULE SA ACCOUNT NIYA"

**Meaning:** Once reassigned, the status should become "Reassigned"; then the schedule details go to the new technician's account and disappear from the old technician's account.

**Requirements:**
- R1. WHEN the admin confirms a reassignment, THE SYSTEM SHALL set the schedule status to "Reassigned".
- R2. THE schedule details (service, customer, date, slot, priority, address) SHALL appear in the new technician's My Tasks.
- R3. THE schedule SHALL disappear from the previous technician's My Tasks (and counts).
- R4. THE operation SHALL be atomic (status, technician, visibility change together) and SHALL record who reassigned it, when, and from/to whom.
- R5. ASSUMPTION to confirm: the new technician can Start a "Reassigned" task like an "Assigned" one once its date/time arrives (see REV-T2).

**Exact prompt:**

```text
REV-A4 — Reassign flow: status "Reassigned" and schedule transfer.

Required behavior when an admin confirms "Reassign Technician":
1. The schedule status becomes "Reassigned" (add it as a status if it does not exist; show it in the admin Manage Schedules status column, filters and badges).
2. The schedule details (service type, customer, date, slot, priority, address) appear in the NEW technician's My Tasks.
3. The schedule disappears from the OLD technician's account: My Tasks list, tab counts (All/Assigned/In Progress/Completed), and any notifications that point to it.
4. Do it atomically in one transaction (status + technician change together). Keep an audit record: reassigned_by, reassigned_at, previous_technician, new_technician.
5. Validate on the server that the new technician is Active and has no conflict for that date + slot (reuse the function from REV-A2/A3), and that the schedule is not already In Progress or Completed.
6. Assumption to state in your summary: the new technician can Start a "Reassigned" task exactly like an "Assigned" one, subject to the date/time rule in REV-T2.

Acceptance tests: after reassign Juan -> Pedro: schedule status "Reassigned", visible in Pedro's My Tasks, gone from Juan's (list and counts); rejecting when Pedro has a conflict; rejecting when the task is In Progress/Completed.
```

---

## REV-A5 — Reschedule: expire early when the date is too close (P1)

**Original:** "KUNG 1 AHEAD LANG ANG NIRESCHED HALIMBAWA SEPTEMBER 29 TAS NI RESCHED NG SEPTEMBER 30 DAPAT AY AUTOMATIC NA MAEEXPIRED YUNG STATUS AND HINDI NA HIHINTAYIN PA YUNG EXPIRATION NA 2 DAYS BALE PAGKUKULANG NIYA YON KASE DI NIYA PINANSIN AND MAGREREQUEST NALANG SIYA NG PANIBAGO"

**Meaning:** If the reschedule is only 1 day ahead (example: Sept 29 rescheduled to Sept 30), the status should expire automatically and not wait for the usual 2-day expiration. That would be the customer's shortfall because he ignored it, and he'll just submit a new request.

**Requirements:**
- R1. A reschedule proposal currently expires 2 days after creation.
- R2. THE proposal SHALL expire at the **earlier** of (created + 2 days) and the start of the proposed date/slot. So the Sep 29 → Sep 30 case can never wait 2 days.
- R3. THE expiry SHALL happen automatically (scheduled job or on-read check), set status to "Expired", and let the customer submit a new request.
- R4. THE logic SHALL live in one function so the team can adjust the rule.

> **Confirm with the team (Q1 below):** the sentence can be read in two ways. Default implemented here: expire at the earlier of 2 days and the start of the proposed slot. Alternative: expire at the end of the *original* date.

**Exact prompt:**

```text
REV-A5 — Reschedule: expire automatically when the new date is too close.

Current behavior: a reschedule proposal stays pending for 2 days before its status becomes Expired.
Problem: when the proposed date is only 1 day after the original (example: original Sep 29, rescheduled to Sep 30), waiting the full 2 days is wrong. The customer ignored it, the date arrives first, and the customer should simply submit a new request.

Required behavior:
1. Implement ONE function computeRescheduleExpiry(createdAt, proposedDate, proposedSlot) returning expires_at = the EARLIER of (createdAt + 2 days) and (start of the proposed date + slot, Asia/Manila; Morning starts 8:00 AM, Afternoon 12:00 PM). Use it everywhere a reschedule is created or displayed.
2. Expire automatically: a scheduled job (every few minutes) or a lazy check when the request/schedule is read, whichever fits the stack. It must be idempotent and set the status to "Expired" without waiting for the 2-day mark.
3. When expired: the customer can submit a new request; release any slot held by the proposal; do not change the original request's data beyond what is required.
4. Show the real expiry time to the admin and the customer.

Acceptance tests (fake the clock): Sep 29 -> Sep 30 proposal created Sep 29 -> expires at Sep 30 8:00 AM (Morning), not Oct 1; a proposal 5 days ahead created Sep 29 -> expires Oct 1 (2 days); job run twice -> no duplicate side effects.
State the interpretation you used in the summary.
```

---

## REV-A6 — "Manage Quotations" tab (P1)

**Original:** "TAMA NA DITO TALAGA MAPUPUNTA KAPAG PAID NA ANG STATUS PERO WALA YUNG PARANG MANAGE QUOTATION NA TAB NA KUNG SAAN DON MAKIKITA YUNG MGA PUMAPASOK NA REQUEST QUOTATION"

**Meaning:** It's right that a request goes to Manage Schedules once its status is Paid, but there's no "Manage Quotation" tab where incoming quotation requests can be seen.

**Evidence:** Screenshot 10 (Manage Schedules) lists requests as **Approved** in "Requests Awaiting Scheduling" — not Paid. See open question Q2.

**Requirements:**
- R1. THE Admin panel SHALL have a "Manage Quotations" item listing every incoming quotation request.
- R2. EACH row SHALL show at least: quotation ID, customer, unit, submitted date, status, and actions defined by `INQUIRY.DOCX`.
- R3. WHEN a quotation is Paid, THE SYSTEM SHALL send it to Manage Schedules (Requests Awaiting Scheduling); nothing earlier SHALL enter scheduling.
- R4. Statuses and transitions SHALL follow `INQUIRY.DOCX`.

**Exact prompt:**

```text
REV-A6 — Add a "Manage Quotations" tab to the Admin panel.

ATTACH: INQUIRY.DOCX (full Request Quotation transaction). Read it completely first.

Step 1 (before code): list what already exists for quotations on the admin side and what INQUIRY.DOCX requires that is missing (statuses, transitions, admin actions, notifications, payment step).

Step 2: implement:
1. Add "Manage Quotations" to the admin sidebar and a page listing all incoming quotation requests, newest first: quotation ID, customer, unit (brand + model), submitted date, status, and the admin actions defined in INQUIRY.DOCX. Add search and a status filter, same style as Manage Schedules/Manage Accounts.
2. Use exactly the statuses and transitions from INQUIRY.DOCX. Do not invent new ones.
3. Keep the rule that a quotation-based request enters Manage Schedules -> Requests Awaiting Scheduling only when its status is Paid. Check the current code: the Awaiting list shows "Approved" requests today. Do NOT change behavior for non-quotation service requests; report exactly what you found.
4. Admin-only access enforced on the server.

Acceptance tests: a customer's new quotation appears in Manage Quotations immediately; it does not appear in Requests Awaiting Scheduling until Paid; a non-admin cannot open the page or its API.
```

---

## REV-A7 — Technician activation error (P0)

**Original:** "SA PAGAACTIVATE NG TECHNICIAN NAG EERROR"

**Meaning:** Activating a technician gives an error.

**Evidence:** Screenshot 11: "Activate Account — Reactivate the technician account for Ana Mendoza?" → red "An unexpected error occurred. Please try again later."

**Requirements:**
- R1. WHEN the admin confirms Activate, THE SYSTEM SHALL restore the technician's account to Active and move it back out of Archive/deactivated.
- R2. THE technician SHALL be able to log in and receive assignments again.
- R3. Failures SHALL return a specific, logged reason, not a generic message.

**Exact prompt:**

```text
REV-A7 — Fix technician account activation.

Problem: In Manage Accounts, confirming "Activate Account" for the technician Ana Mendoza ("Reactivate the technician account ... They will be able to use the system again.") fails with "An unexpected error occurred. Please try again later."

Do this:
1. Reproduce it and find the root cause in the activation endpoint/service (check the exact error in the server log: wrong route/method, missing or wrong field such as is_active/status/deleted_at/archived_at, validation on unrelated required fields, a failing related update such as the technician profile or availability record, permission check, transaction).
2. Fix it so activation sets the account Active, clears the deactivated/archived state, and the technician appears again in the active Technicians list and in the available-technicians lookup (REV-A2).
3. The technician can log in again afterwards.
4. Replace the generic error with specific server responses (404 not found, 409 already active, 403 forbidden) and log unexpected errors with a stack trace.
5. Check that Deactivate still works and that deactivation followed by activation is repeatable.

Acceptance tests: deactivate then activate a technician -> Active, can log in, listed as available for a free slot; activating an already-active account returns a clear message.
```

---

## REV-A8 — Remove "busy" from technician Availability (P2)

**Original:** "DITO KUYS YUNG AVAILABILITY DAPAT YATA WALA NANG BUSY SA AVAILABILITY EH KASE KAHIT DI NAMAN BUSY SI TECHNICIAN BUSY PA REN JAN EH"

**Meaning:** Here, I think there shouldn't be a "busy" in Availability anymore, because even when the technician isn't busy it still shows busy. (Note the tentative "yata" — see Q4.)

**Evidence:** Screenshot 16 (Manage Accounts → Technicians): María García shows "busy" while others show "available". This screenshot is placed under the Technician section in the document, but it is the admin's Manage Accounts screen.

**Requirements:**
- R1. THE "busy" value SHALL be removed from the Availability field, from the UI and from the data model/API.
- R2. Whether someone can take a job SHALL be decided per date and slot from the schedules (REV-A2), never from a stored global flag.
- R3. Existing "busy" rows SHALL be migrated to "available".
- R4. ASSUMPTION: keep a manual Available / Unavailable toggle (for leave or day off). If the team prefers, remove the column entirely.

**Exact prompt:**

```text
REV-A8 — Remove "busy" from technician Availability.

Problem: In Manage Accounts -> Technicians, the Availability column shows "busy" (example: Maria Garcia) even when the technician has no active task. The team wants no "busy" state.

Required behavior:
1. Find every place the busy state is set or read (assign, start, complete, cancel, reassign, seeders, filters, badges). Remove "busy" from the data model/enum, API and UI.
2. Migrate existing rows with availability = busy to "available".
3. Whether a technician can take a job must be decided only from the schedules for that date + slot (see REV-A2), never from a stored global flag.
4. Keep a manual toggle with two values only: "available" and "unavailable" (for leave/day off). An "unavailable" technician must be excluded from the available-technicians lookup. If the codebase has no use for the toggle, tell me instead of inventing one.
5. Do not change any other column or action in that table.

Acceptance tests: no code path can produce "busy"; a technician with a task today still shows "available" and is still bookable for a different slot; an "unavailable" technician is never offered for assignment.
```

---

# TECHNICIAN SIDE

## REV-T1 — Remove Dashboard (P2)

**Original:** "WALA DEN DAPAT DASHBOARD SI TECHNICIAN AND DAPAT" *(the sentence is cut off in the document — see Q3)*

**Meaning:** The technician also shouldn't have a Dashboard, and … (unfinished).

**Evidence:** Screenshot 12: Technician Panel sidebar has "Dashboard" and "My Tasks", and the top bar has a "Dashboard" link.

**Requirements:**
- R1. THE Technician Panel SHALL have no Dashboard page, sidebar item, or top-bar link.
- R2. THE technician's landing page after login SHALL be My Tasks.
- R3. Old dashboard URLs SHALL redirect to My Tasks.
- R4. THE top-bar entry that leads into the panel SHALL be labeled "My Tasks".

**Exact prompt:**

```text
REV-T1 — Remove the Dashboard from the Technician role.

Required behavior:
1. Remove the "Dashboard" item from the Technician Panel sidebar and the "Dashboard" link in the top navigation. Keep "My Tasks" as the technician's home; rename the top-nav entry that leads into the panel to "My Tasks".
2. After login, the technician lands on My Tasks.
3. Redirect any old technician dashboard URL to My Tasks (no 404).
4. Remove the dashboard route, component and API that only the technician dashboard used, but only if nothing else references them. List what you removed.
5. Do not touch the Customer or Admin panels.

Note: the stakeholder's sentence was cut off after "...AND DAPAT". Do not add anything beyond the removal above; mention in your summary that the sentence was incomplete.

Acceptance: technician login -> My Tasks; no "Dashboard" text in the technician layout; /technician/dashboard (or its equivalent) redirects.
```

---

## REV-T2 — Cannot Start before the assigned date and time (P1)

**Original:** "ALSO SI TECHNICIAN HINDI NIYA DEN DAPAT MA ISTART YUNG TASK NIYA KUNG HINDI PA DUMADATING YUNG DATE AND TIME NA NAKA ASSIGNED SA KANYA LIKE OCTOBER 1 MORNING DAPAT OCTOBER 1 MORNING PA REN NIYA PWEDE MA START AND TRABAHO"

**Meaning:** The technician must not be able to start a task before its assigned date and time; for an Oct 1 Morning job, he can only start and work on Oct 1 Morning.

**Evidence:** Screenshot 12: the Oct 1, 2026 task (Assigned) already has a blue **Start** button today (today is Sep 19, 2026).

**Requirements:**
- R1. THE Start action SHALL be disabled until now ≥ the start of the assigned date + slot (Asia/Manila; Morning 8:00 AM, Afternoon 12:00 PM).
- R2. THE disabled button SHALL explain when it unlocks ("Available Oct 1, 2026, 8:00 AM").
- R3. THE server SHALL reject early Start requests regardless of the UI.
- R4. ASSUMPTION: after the slot starts, Start stays allowed (including late in the day); confirm if a cut-off is wanted.

**Exact prompt:**

```text
REV-T2 — Block Start until the assigned date and time.

Problem: In Technician -> My Tasks, a task assigned for Oct 1, 2026 shows an active "Start" button today. The technician must only be able to start and work on it when its date and slot arrive.

Required behavior:
1. Start is allowed only when now (Asia/Manila) >= the start of the assigned date + slot: Morning starts 8:00 AM, Afternoon starts 12:00 PM.
2. In the UI, disable the Start button before that moment and show why (tooltip or small text: "Available Oct 1, 2026, 8:00 AM").
3. Enforce the same rule on the server in the start endpoint: an early request returns a clear 4xx error message. Never rely on the UI alone.
4. After the slot starts, Start remains allowed (no end-of-slot cut-off unless the code already has one). State this assumption.
5. Applies to "Assigned" and "Reassigned" tasks. Do not change any other status transition.
6. Use a single shared helper for the start-time calculation so REV-A5 can reuse it.

Acceptance tests (fake the clock): Sep 30, 11:59 PM -> Oct 1 Morning task cannot start (UI + API); Oct 1, 8:00 AM -> can start; Oct 1 Afternoon task at Oct 1 11:00 AM -> cannot start; at 12:00 PM -> can start.
```

---

## REV-T3 — Remove Previous/Next, continuous scroll (P2)

**Original:** "BALE DAPAT TANGGALIN NA YUNG MGA BUTTON NA PREVIOUS TSAKA NEXT BALE PURO PABABA NA LANG LAHAT PAG NAG SCROLL"

**Meaning:** Remove the Previous and Next buttons; everything should just continue downward when scrolling.

**Evidence:** Screenshot 13 sits under the Technician section in the document, but the table is the **admin Products catalog** (Brand, Model, Type, Unit Type, HP, BTU, Price, Status, Actions; "Showing page 1 of 2 (15 total)"; Previous/Next at the bottom). The technician task table has no pagination. So this prompt targets the products table (Q5).

**Requirements:**
- R1. THE Products table SHALL show all products in one continuous list with no Previous/Next controls.
- R2. Search, Type filter and column sorting SHALL keep working across all rows.
- R3. THE "Showing page X of Y" text SHALL be replaced by a simple total (for example "15 products").

**Exact prompt:**

```text
REV-T3 — Remove Previous/Next pagination from the Products table.

Target: the products/catalog table (search box "Search brand or model...", Type filter, columns Brand, Model, Type, Unit Type, HP, BTU, Price, Status, Actions; footer "Showing page 1 of 2 (15 total)" with Previous/Next).

Required behavior:
1. Remove the Previous and Next buttons and the "Showing page X of Y" text. All rows appear in one continuous list; the user just scrolls down.
2. Show a simple count instead (for example "15 products", updating with search/filter).
3. Search, the Type filter and the BTU/Price sorting must work across all rows.
4. If the row count could become large, use lazy loading on scroll or list virtualization instead of page buttons. With ~15 rows, rendering all is fine.
5. Do NOT change any other table. List other tables that still use Previous/Next so I can decide; do not edit them.

Acceptance: no Previous/Next in the products table; all 15 products reachable by scrolling; search and sort still work.
```

---

## REV-T4 — Submit Report gives an unexpected error (P0)

**Original:** "NAG EERROR DEN PAG NAG SESEND NG REPORT"

**Meaning:** It also errors when sending the report.

**Evidence:** Screenshot 14: Complete Task #2 with report text ("OK NA TAPOS NA ANG TRABAHO KO", 29/1000, minimum 20) and a photo (`Repair Aircon.jpg`); clicking Submit Report shows "An unexpected error occurred. Please try again later."

**Requirements:**
- R1. WHEN a technician submits a valid report (≥ 20 characters and a photo) for an In Progress task, THE SYSTEM SHALL save the report and photo and mark the task Completed.
- R2. Validation and state errors SHALL return specific messages, not a generic error.
- R3. THE photo upload SHALL handle the expected image types and size.

**Exact prompt:**

```text
REV-T4 — Fix "Submit Report" on the Complete Task modal.

Problem: In Technician -> Complete Task #2, with report text "OK NA TAPOS NA ANG TRABAHO KO" (29/1000 chars, minimum 20) and a photo "Repair Aircon.jpg", clicking "Submit Report" shows "An unexpected error occurred. Please try again later."

Do this:
1. Reproduce and capture the real server error. Check: the multipart upload (field names, size limit, accepted mime types, storage directory/permissions), the completion endpoint's validation, the task-status check, the DB write (report + photo path + completed_at), and the transaction.
2. Fix the root cause so a valid submission (report >= 20 chars + photo, task In Progress) saves both, marks the task Completed, and updates the technician's tabs/counts and the admin/customer views.
3. Replace the generic catch-all with specific responses: 400 (validation, list which field), 409 (wrong task state), 413 (photo too large), 415 (wrong file type), 500 only for real server faults, and log those with a stack trace.
4. Show the specific message in the modal.

Note: REV-T5 covers a related but different symptom (state check). Fix that first if it is the cause; say so in your summary.
Acceptance tests: valid submission succeeds; too-short report, missing photo, wrong file type, oversized photo each return a specific message; task not In Progress is rejected with a clear message.
```

---

## REV-T5 — "In progress" error even when it is In Progress (P0)

**Original:** "IN PROGRESS NAMAN NA PERO GANYAN PA REN NALABAS"

**Meaning:** It's already In Progress but the same error still appears.

**Evidence:** Screenshot 15: on submit, the toast reads "Task can only be completed when status is in-progress", while the Task Progression indicator behind the modal still highlights only "Assigned". This suggests Start didn't update the status the completion check reads, or the check compares against a different value.

**Requirements:**
- R1. WHEN the technician presses Start, THE SYSTEM SHALL persist the In Progress status on the record that the completion check reads, and the UI SHALL update at once.
- R2. THE completion check SHALL compare using a single shared status constant (no "in-progress" vs "in_progress" vs "In Progress" mismatch).
- R3. THE Task Progression indicator SHALL always match the stored status.

**Exact prompt:**

```text
REV-T5 — Fix "Task can only be completed when status is in-progress" appearing when the task is already In Progress.

Problem: After the technician starts a task, submitting the completion report still shows the toast "Task can only be completed when status is in-progress". The Task Progression indicator on the page still highlights only "Assigned".

Do this:
1. Reproduce: Start a task, reload, then try to complete it. Compare the status stored in the DB (service request AND schedule/task records) before and after pressing Start.
2. Find the cause. Candidates: the Start action updates a different record/table than the one the completion check reads; a status string mismatch ("in-progress" vs "in_progress" vs "In Progress"); the UI keeps stale state and never refetches; Start fails silently; a race between Start and Complete.
3. Fix it so Start persists the In Progress status on every record the completion check reads, and the UI (status badge, Task Progression, tab counts: In Progress (n)) updates immediately from the server response.
4. Use ONE shared status enum/constant across backend and frontend. Remove string literals.
5. Keep the rule: completing a task that is not In Progress must still be rejected, with the current status named in the message.

Acceptance tests: Start -> status In Progress everywhere -> Complete succeeds; Complete without Start is rejected with a clear message; the Task Progression indicator reflects the real status after Start and after reload.
```

---

# 4. Open questions (confirm with the team before or right after deploy)

| # | Question | Default used in the prompts |
|---|---|---|
| Q1 | REV-A5 wording is ambiguous: when a reschedule is only 1 day ahead, should it expire when the proposed slot starts, or at the end of the original date? | Earlier of created + 2 days and start of the proposed slot |
| Q2 | Screenshot 10 shows **Approved** requests in "Requests Awaiting Scheduling", but the feedback says requests go there when **Paid**. Which applies to quotation-based requests vs normal service requests? | Quotation-based = Paid only; normal requests unchanged |
| Q3 | REV-T1's sentence ends at "…DASHBOARD SI TECHNICIAN AND DAPAT". What was the rest? | Only remove Dashboard; land on My Tasks |
| Q4 | REV-A8 says "dapat *yata* wala nang busy" (tentative). Remove the whole Availability column, or keep a manual Available/Unavailable toggle? | Keep Available/Unavailable only |
| Q5 | The Previous/Next screenshot (REV-T3) is the admin Products table but is filed under Technician. Confirm that's the table meant, and whether other tables should follow. | Products table only |
| Q6 | REV-A1: should prefilled date/time stay editable by the admin? | Editable |
| Q7 | REV-A4: can the new technician Start a "Reassigned" task like an "Assigned" one? | Yes |
| Q8 | REV-T2: any cut-off after the slot ends (e.g., after 5:00 PM)? | No cut-off |
| Q9 | REV-C3: what is the acceptable maximum OpenCV uplift? | 15% of base load |
| Q10 | Please send `INQUIRY.DOCX` (needed for C4 and A6). Page 2 of the products catalog is also useful for the HP tiers in C1. | — |

---

# 5. Non-code action items (from the NOTES section)

- **Deploy by tomorrow (Sun, Sep 20, 2026).** The evaluation starts after deployment; they want 1–2 days for it.
- **Everything above must be fixed before deploying.** The professor (Sir Marlon) will also evaluate the system.
- **ISO 25010 evaluation:** your **resume** is needed because you're one of the people they want as an evaluator.
- **One more IT evaluator needed:** someone who **doesn't know Sir Marlon**. Their **resume** is also needed for the Chapter 4 documents.
- **Google Form** will be given to you by the team.
- **Results** of the evaluation expected **Monday or Tuesday (Sep 21–22)**, then a **second revision round** based on the feedback.
- They also asked for a higher rating (joking).

---

# 6. Pre-deploy regression checklist

Customer
- [ ] 9,690 BTU input returns **1.5 HP**; 14,475 BTU returns **2 HP split**; no floor-standing anywhere (C1, C3)
- [ ] Result auto-scrolls / shows hint (C2)
- [ ] "My Quotations" shows a new quotation immediately (C4)

Admin
- [ ] Assign modal opens with the customer's date + slot prefilled and a populated technician dropdown (A1, A2)
- [ ] Reassign dropdown populated; status becomes "Reassigned"; task moves between technicians (A3, A4)
- [ ] Reschedule Sep 29 → Sep 30 expires automatically per the agreed rule (A5)
- [ ] "Manage Quotations" tab lists incoming requests; Paid → Manage Schedules (A6)
- [ ] Activate technician works (A7)
- [ ] No "busy" anywhere in Availability (A8)
- [ ] Products table has no Previous/Next (T3)

Technician
- [ ] No Dashboard; login lands on My Tasks (T1)
- [ ] Start blocked before the assigned date/time (UI + API) (T2)
- [ ] Start → In Progress → Submit Report succeeds; errors are specific (T4, T5)

General
- [ ] Automated tests pass; smoke test with all 3 roles on the deployed URL
- [ ] Seed/demo data has at least 3 active technicians and one quotation in each status
