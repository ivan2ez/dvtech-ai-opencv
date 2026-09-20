# Implementation Plan: Revision Batch 1

## Overview

This plan implements the 17 stakeholder changes of Revision Batch 1 (Requirements 1–20) for the DVTech AI-Powered Web System. The work is sequenced so the three shared building blocks land first, because most revisions depend on them:

1. `Task_Status_Enum` (backend + frontend mirror) and the `reassigned` migration.
2. `timezone.ts` with `Slot_Time_Helper` (`slotStartInstant`, `manilaDateFromInput`).
3. `Availability_Service` (`availabilityService.ts`) refactoring `getAvailableTechnicians` / `canAssignToSlot` with the `excludeTechnicianId` pre-filter.

After the shared blocks, the P0 bug fixes (A2, A3, T5, T4, A7, C1, C3) come first, then P1 (A1, A4, A5, C4, A6, T2), then P2 (C2, T1, T3, A8). Property-based tests use `fast-check` with Jest; each of the 23 correctness properties is one test running ≥100 iterations and tagged `// Feature: revision-batch-1, Property {n}: ...`.

Language: TypeScript (backend Node/Express + Sequelize, frontend React) and Python (FastAPI `ai-service`), matching the existing stack described in the design.

Migrations continue from the existing `...041`: `042` add `reassigned` status, `043` remove `busy` (with mandatory `busy`→`available` conversion), `044` `schedule_reassignments` audit table, `045` `quotations` table, `046` optional `reschedule_window_ends_at` column.

## Tasks

- [x] 1. Establish shared building blocks (Task_Status_Enum, timezone/Slot_Time_Helper, Availability_Service)
  - [x] 1.1 Create shared Task_Status_Enum constants (backend + frontend mirror)
    - Create `backend/src/constants/taskStatus.ts` exporting `TASK_STATUS` (including new `Reassigned: 'reassigned'`), the `TaskStatus` type, and `STARTABLE_STATUSES = [Assigned, Reassigned]`
    - Create mirrored `frontend/src/constants/taskStatus.ts` with identical string values; update `frontend/src/types/index.ts` `ScheduleStatus` to include `'reassigned'`
    - Replace `'in-progress'`/other status string literals in `scheduleService.ts` with `TASK_STATUS.*` imports
    - _Requirements: 18.3, 18.4, 19.3, 9.1_
  - [ ]* 1.2 Write unit test for Task_Status_Enum frontend/backend parity
    - Assert every backend `TASK_STATUS` value equals the mirrored frontend value
    - _Requirements: 18.4_
  - [x] 1.3 Add migration 042 to extend TechnicianSchedule.status ENUM with `reassigned`
    - Create `backend/src/database/migrations/20240101000042-add-reassigned-status.js` altering the `status` ENUM to `('assigned','accepted','rejected','reassigned','in-progress','completed')`
    - Update `TechnicianSchedule.ts` model ENUM and `status` union type
    - _Requirements: 9.1_
  - [x] 1.4 Create timezone utility with Slot_Time_Helper
    - Create `backend/src/utils/timezone.ts` with `MANILA_UTC_OFFSET_MINUTES = 480`, `slotStartInstant(date, slot)` (Morning=08:00, Afternoon=12:00 at +08:00; throws typed validation error when unresolvable), and `manilaDateFromInput(value)`
    - _Requirements: 15.1, 10.3, 10.5, 19.2, 19.5, 6.7_
  - [ ]* 1.5 Write property test for slot start instant / expiry min basis
    - **Property 11: Reschedule expiry is the earlier of two instants** (start-instant portion)
    - **Validates: Requirements 10.3, 15.1**
  - [ ]* 1.6 Write property test for Manila date normalization
    - **Property 23: Manila date normalization round-trip**
    - **Validates: Requirements 6.7, 19.5**
  - [x] 1.7 Create Availability_Service with pre-filter exclusion
    - Create `backend/src/services/availabilityService.ts` with `getAvailableTechnicians(query)` and `isTechnicianAvailable(technicianId, query, excludeScheduleId?)`; apply evaluation order pre-filter → active-account → manual-unavailable → schedule-conflict (exact date+slot, non-cancelled), computed purely from `technician_schedule`
    - Reduce `scheduleService.canAssignToSlot` to delegate to `isTechnicianAvailable` plus the existing 2-tasks/day cap
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7, 8.2, 8.3, 9.6, 13.3, 13.5, 19.1_
  - [ ]* 1.8 Write property test for availability computation with pre-filter exclusion
    - **Property 10: Availability computation with pre-filter exclusion**
    - **Validates: Requirements 7.1, 7.3, 7.4, 7.7, 8.2, 8.3, 9.6, 13.3, 13.5**

- [x] 2. Add fast-check and configure property-based testing
  - [x] 2.1 Add fast-check dev dependency and PBT scaffolding
    - Add `fast-check` to `backend/package.json` devDependencies; ensure Jest picks up a `*.property.test.ts` pattern; confirm in-memory SQLite Sequelize test harness (fresh sync per case) is available for DB-backed properties
    - _Requirements: 20.1, 20.2_

- [x] 3. P0 — A2/A3: Reliable Assign & Reassign available-technician dropdowns
  - [x] 3.1 Wire the available-technicians endpoint to Availability_Service
    - Update `GET /api/schedules/available-technicians` (scheduleController/routes) to delegate to `availabilityService.getAvailableTechnicians`, accepting `date`, `slot`, and optional `excludeTechnicianId`
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_
  - [x] 3.2 Update Assign modal dropdown states
    - In the Assign modal (`ManageSchedules.tsx`/`ManageRequests.tsx`) load technicians from the endpoint; show error state with retry on failure and a distinct no-technicians-available message on empty success
    - _Requirements: 7.5, 7.6_
  - [x] 3.3 Update Reassign modal dropdown states and exclusion
    - In the Reassign modal call the endpoint with `excludeTechnicianId` = current technician; show error+retry on failure, no-technicians message on empty success; keep Reassign action disabled until a technician is selected and enabled once selected
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7_
  - [ ]* 3.4 Write Postman API tests for available-technicians endpoint
    - Assert active, conflict-free technicians returned and the reassign `excludeTechnicianId` is honoured
    - _Requirements: 7.1, 7.4, 8.2, 8.3_

- [x] 4. P0 — T5: Consistent In-Progress status across Start and Complete
  - [x] 4.1 Persist In-Progress via the shared enum on Start
    - Update `scheduleService.startTask` to persist `TASK_STATUS.InProgress` on the same row the completion check reads; make the completion status check compare against `TASK_STATUS.InProgress`
    - _Requirements: 18.1, 18.3, 18.6_
  - [x] 4.2 Reflect status from server response in the technician UI
    - Update `MyTasks.tsx`/`TaskDetail.tsx` badge, progression indicator, and tab counts to read from the server response and from the shared `taskStatus` constants; ensure progression reflects stored status after reload
    - _Requirements: 18.2, 18.5, 18.7_
  - [ ]* 4.3 Write property test for consistent In-Progress status
    - **Property 18: Start sets a consistent In-Progress status**
    - **Validates: Requirements 18.1, 18.3, 18.6**

- [x] 5. P0 — T4: Reliable completion report submission
  - [x] 5.1 Harden completion controller multipart validation
    - In `scheduleController.completeTaskHandler` use `multer` memory storage with a 5 MB limit for this route; validate in order: missing field → 400 naming field; report length 20–2000 → 400 naming `report`; photo > 5 MB → 413; photo type not JPEG/PNG/WEBP → 415; save photo only after validation passes
    - _Requirements: 17.3, 17.4, 17.6, 17.7_
  - [x] 5.2 Make completion atomic in the service
    - Update `scheduleService.completeTask` to reject non-`in-progress` status with 409 naming current status; in one `sequelize.transaction` store report text, photo path, set status `completed`, set `completedAt`; on unexpected fault roll back, leave status unchanged, return 500, and log the stack trace; ensure task moves In-Progress→Completed with count/view updates
    - _Requirements: 17.1, 17.2, 17.5, 17.8, 17.9_
  - [x] 5.3 Surface specific completion error in the modal
    - Update the completion modal to display the specific server error message within 2 seconds of the response
    - _Requirements: 17.10_
  - [ ]* 5.4 Write property test for completion report length validation
    - **Property 16: Completion report length validation**
    - **Validates: Requirements 17.4**
  - [ ]* 5.5 Write property test for atomic completion
    - **Property 17: Completion is atomic** (inject a fault mid-transaction to assert rollback leaves no partial state)
    - **Validates: Requirements 17.1, 17.8, 17.9**
  - [ ]* 5.6 Write unit/Postman tests for completion edge responses
    - Cover 413, 415, 409 not-in-progress, and missing-field cases
    - _Requirements: 17.3, 17.5, 17.6, 17.7_

- [x] 6. P0 — A7: Reliable technician activation
  - [x] 6.1 Add explicit activation responses in Account_Service
    - Update `adminService.setAccountActive` (activation path) to return 404 for missing account, 409 for already-Active, 403 for unauthorized (via `roleMiddleware('admin')` + service-level actor check); on success clear deactivated + archived state, set Active, and recompute availability so the technician reappears in `Availability_Service` and can log in; log unexpected errors with stack trace
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_
  - [ ]* 6.2 Write property test for activation round-trip and idempotence
    - **Property 22: Activation round-trip and idempotence**
    - **Validates: Requirements 12.1, 12.2, 12.8**
  - [ ]* 6.3 Write unit tests for activation edge responses
    - Cover 404 / 409 / 403 cases
    - _Requirements: 12.4, 12.5, 12.6_

- [x] 7. P0 — C1: Deterministic HP and permitted unit types
  - [x] 7.1 Implement table-driven HP derivation
    - In `btuCalculationService.ts` replace `deriveHpFromBtu` with `deriveHpFromTiers(loadBtu, tiers)` returning `HpDerivation` (`matched` / `exceeds-largest` / `no-tier` / `no-catalog`); build tiers from active Window/Split products reading `horsepower` + `btuCapacity`; smallest ratedBtu ≥ load with lowest-HP tie-break
    - _Requirements: 1.3, 1.4, 1.9, 1.13, 1.14_
  - [x] 7.2 Enforce permitted unit types and strip "floor"
    - In `aiService.generateRecommendation` add `sanitizeUnitType` (coerce to Window Type / Split Type) and `stripFloorTerm` (remove case-insensitive "floor" from reasoning, tips, unit-type rationale, prompt, and the model's allowed `unit_type` list)
    - _Requirements: 1.1, 1.2_
  - [x] 7.3 Reconcile HP/unit type and select tips by computed HP class
    - Pass computed HP + unit type as fixed prompt inputs; after the LLM returns, overwrite `recommendedHp` and `unitType` with computed values and replace any differing HP number in reasoning/tips; select electrical + breaker tips via a `TIPS_BY_HP_CLASS` table keyed on computed HP; populate unit cards (HP, BTU, inverter/non-inverter, price) from the matched `aircon_products` row; handle exceeds-largest (largest tier card + site-survey message)
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_
  - [ ]* 7.4 Write property test for deterministic HP derivation
    - **Property 1: Deterministic HP derivation from catalog tiers**
    - **Validates: Requirements 1.3, 1.4, 1.9, 1.11, 1.12, 1.13, 1.14, 3.9, 3.10**
  - [ ]* 7.5 Write property test for permitted unit types
    - **Property 2: Permitted unit types only**
    - **Validates: Requirements 1.1**
  - [ ]* 7.6 Write property test for floor-term exclusion
    - **Property 3: The term "floor" is excluded from output**
    - **Validates: Requirements 1.2**
  - [ ]* 7.7 Write property test for HP/unit-type reconciliation
    - **Property 4: HP and unit type are reconciled to the computed values everywhere**
    - **Validates: Requirements 1.5, 1.6, 1.7, 1.8**
  - [ ]* 7.8 Write unit tests for HP boundary examples
    - 9,690 BTU → 1.5 HP Window/Split (Req 1.11); 14,475 BTU → 2.0 HP Split (Req 1.12)
    - _Requirements: 1.11, 1.12_

- [x] 8. P0 — C3: Consistent, non-inflated OpenCV-assisted recommendations
  - [x] 8.1 Expose per-metric line items from the ai-service
    - In `ai-service` `room_analysis.py` expose windows, insulation, sunlight, and heat-source metrics as discrete labeled fields (not an opaque appliance count) for the backend to line-itemize
    - _Requirements: 3.1_
  - [x] 8.2 Implement capped, line-itemized OpenCV uplift
    - Add `computeOpenCvUplift(input)` to the recommendation path: derive total as the sum of labeled line items (±1 BTU), union form + image heat sources so each counts once, clamp combined uplift to `capFraction * baseLoadBtu` (default 0.15 via `OPENCV_UPLIFT_CAP_FRACTION` env)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8_
  - [x] 8.3 Build narrative facts from measured values and degrade gracefully
    - Build `narrativeFacts` from measured values only (no multi-window claim when `windowCount===0`, no poor-insulation claim unless insulation is `poor`); wrap `analyzeRoomImage` so a microservice/LLM failure produces a form-only recommendation with `cappedUpliftBtu = 0` and `photoAnalysisApplied: false`; run C1 HP/unit-type rules on this path
    - _Requirements: 3.5, 3.6, 3.7, 3.9, 3.10, 3.11_
  - [ ]* 8.4 Write property test for line items summing to total
    - **Property 5: Line items sum to the total**
    - **Validates: Requirements 3.1, 3.2**
  - [ ]* 8.5 Write property test for heat sources counted once
    - **Property 6: Heat sources are counted once**
    - **Validates: Requirements 3.3**
  - [ ]* 8.6 Write property test for capped OpenCV uplift
    - **Property 7: OpenCV uplift is capped**
    - **Validates: Requirements 3.4, 3.8**
  - [ ]* 8.7 Write property test for narrative facts matching measurements
    - **Property 8: Narrative facts match measurements**
    - **Validates: Requirements 3.5, 3.6, 3.7**
  - [ ]* 8.8 Write property test for graceful degradation without image analysis
    - **Property 9: Graceful degradation without image analysis**
    - **Validates: Requirements 3.11**

- [x] 9. Checkpoint — Ensure all P0 tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. P1 — A1: Assign modal prefills requested date and slot
  - [x] 10.1 Prefill and reload Assign modal from requested date/slot
    - Prefill scheduled date + Time_Slot from the request's `serviceRequiredDate`/`serviceRequiredTime` when present, keep them editable, load the technician dropdown via the available-technicians endpoint for those values, and reload the dropdown when the admin changes date or slot; empty+editable when the request has none
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 10.2 Store the filtered date/slot on save using Manila date
    - In `scheduleService.assignTechnician` store exactly the date+slot the dropdown was filtered on, deriving the stored date via `manilaDateFromInput`
    - _Requirements: 6.6, 6.7_

- [x] 11. P1 — A4: Reassignment transfers the schedule and records an audit trail
  - [x] 11.1 Add migration 044 and ScheduleReassignment model
    - Create `backend/src/database/migrations/20240101000044-create-schedule-reassignments.js` (columns: schedule_id, previous_technician_id, new_technician_id, reassigned_by, reassigned_at, timestamps); create `ScheduleReassignment.ts`, register in `models/index.ts`, associate `belongsTo` schedule + the three users
    - _Requirements: 9.5_
  - [x] 11.2 Rewrite reassignTechnician as an atomic, audited transfer
    - Rewrite `scheduleService.reassignTechnician(scheduleId, newTechnicianId, actingAdminId)`: reject when current status is `in-progress`/`completed`; server-validate the new technician via `isTechnicianAvailable`; in one `sequelize.transaction` set `status='reassigned'`, set `technicianId`, insert the audit row (all-or-nothing); transfer surfaces in the new technician's My_Tasks and clears the previous technician's list/counts
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - [ ]* 11.3 Write property test for atomic, audited reassignment
    - **Property 13: Reassignment is atomic and audited** (inject a mid-transaction fault to assert full rollback)
    - **Validates: Requirements 9.1, 9.4, 9.5, 9.6**
  - [ ]* 11.4 Write property test for reassignment rejection of started/finished tasks
    - **Property 14: Reassignment rejected for started or finished tasks**
    - **Validates: Requirements 9.7**
  - [ ]* 11.5 Write Postman API test for reassignment transfer + audit row
    - Assert the schedule moves technicians and an audit row is written
    - _Requirements: 9.1, 9.5_

- [x] 12. P1 — A5: Reschedule expiry = earlier of +48h or slot start
  - [x] 12.1 Compute reschedule expiry via shared helper
    - Add `computeRescheduleExpiry(createdAt, proposedDate, proposedSlot)` returning the earlier of `createdAt+48h` and `slotStartInstant(...)`; use it in `rescheduleService.proposeReschedule`; reject with a 400 validation error naming the field when the slot cannot be resolved (do not create the proposal); display expiry as a Manila date-and-time
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.9_
  - [x] 12.2 Make expiry transition idempotent with a scheduled trigger
    - Keep the lazy `expireStaleReschedules` but make the update match only rows still `needs-rescheduling` past expiry (idempotent); add an internal `POST /api/internal/expire-reschedules` trigger (Vercel Cron / `setInterval` in `app.ts`) invoking the same function every ~30s to meet the 60s bound; expired proposals allow the customer to submit a new request
    - _Requirements: 10.6, 10.7, 10.8_
  - [x] 12.3 (Optional) Add migration 046 for reschedule_window_ends_at column
    - Only if a distinct display of both candidate instants is adopted; otherwise `rescheduleExpiresAt` holding the earlier instant is sufficient
    - _Requirements: 10.1_
  - [ ]* 12.4 Write property test for reschedule expiry min
    - **Property 11: Reschedule expiry is the earlier of two instants**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.10, 10.11, 15.1**
  - [ ]* 12.5 Write property test for idempotent expiry transition
    - **Property 12: Expiry transition is idempotent**
    - **Validates: Requirements 10.7**
  - [ ]* 12.6 Write unit tests for expiry worked examples
    - Req 10.10 (slot start earlier) and Req 10.11 (created+48h earlier)
    - _Requirements: 10.10, 10.11_

- [x] 13. P1 — C4/A6: Quotation model, status vocabulary, and My/Manage Quotations
  - [x] 13.1 Add placeholder quotation status constants module
    - Create `backend/src/constants/quotationStatus.ts` (mirrored on frontend) defining the placeholder `QUOTATION_STATUS` vocabulary with a clear comment marking it an assumption pending INQUIRY.DOCX; ensure all consumers read the constant (never a literal) so the vocabulary can be swapped in one file
    - _Requirements: 4.10, 5.1, 5.2_
  - [x] 13.2 Add migration 045 and Quotation model
    - Create `backend/src/database/migrations/20240101000045-create-quotations.js` (columns per design: user_id, brand, model, details, status ENUM from constants, service_request_id nullable, submitted_at, timestamps, deleted_at paranoid); create `Quotation.ts`, register in `models/index.ts`
    - _Requirements: 4.3, 11.2_
  - [x] 13.3 Implement quotationService with ownership scoping
    - Create `backend/src/services/quotationService.ts` with `listMyQuotations(userId)` (strict `userId` scope), admin listing, and the Paid-gate helper for Awaiting-Scheduling; enforce ownership server-side and admin-only access via `roleMiddleware`
    - _Requirements: 4.2, 4.7, 4.8, 11.8_
  - [x] 13.4 Add quotation routes/controllers and Awaiting-Scheduling gating
    - Add `GET /api/quotations/mine` (customer), admin quotation routes, and gate quotation-based requests into "Requests Awaiting Scheduling" only at Paid while preserving non-quotation scheduling behavior
    - _Requirements: 4.1, 11.1, 11.5, 11.6, 11.7_
  - [x] 13.5 Build My_Quotations customer page
    - Create `frontend/src/pages/customer/MyQuotations.tsx` + `/my-quotations` route + nav item under `CustomerLayout`; each row shows identifier, brand+model, submitted date, status, details action; most-recent-first; search + status filter; empty state; remain visible at Assigned/Paid preserving My Requests behavior
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.9_
  - [x] 13.6 Build Manage_Quotations admin page
    - Create `frontend/src/pages/admin/ManageQuotations.tsx` + `/admin/quotations` route + nav item; each row shows identifier, customer, unit, submitted date, status, and placeholder admin actions; most-recent-first; search + status filter
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [ ]* 13.7 Write property test for quotation ownership enforcement
    - **Property 19: Quotation ownership is enforced**
    - **Validates: Requirements 4.2, 4.7, 4.8**
  - [ ]* 13.8 Write property test for quotation list ordering
    - **Property 20: Quotation lists are ordered most-recent-first**
    - **Validates: Requirements 4.4, 11.3**
  - [ ]* 13.9 Write property test for Awaiting-Scheduling Paid gate
    - **Property 21: Awaiting-Scheduling membership gated on Paid**
    - **Validates: Requirements 11.5, 11.6**
  - [ ]* 13.10 Write unit test for quotation-status constant parity
    - Assert frontend/backend `QUOTATION_STATUS` values match
    - _Requirements: 5.2_

- [x] 14. P1 — T2: Block Start before the assigned date and slot
  - [x] 14.1 Add server-side start-time gate
    - In `scheduleService.startTask` allow only `assigned`/`reassigned` (via `STARTABLE_STATUSES`); compute `startAt = slotStartInstant(scheduledDate, scheduledTime)` and reject with 400 when Manila-now < startAt; for `reassigned` re-check the technician is still Active before starting; return `startableAt` on each task
    - _Requirements: 15.1, 15.5, 15.6, 15.7, 9.8_
  - [x] 14.2 Disable Start control in MyTasks until startable
    - In `MyTasks.tsx` disable the Start control while now < `startableAt` and show the becomes-startable date/time; enable at/after `startableAt`, using the Manila boundary returned by the API
    - _Requirements: 15.2, 15.3, 15.4_
  - [ ]* 14.3 Write property test for slot-start gated Start
    - **Property 15: Start is gated by the slot start instant**
    - **Validates: Requirements 15.1, 15.5, 15.6, 15.7, 9.8**

- [x] 15. Checkpoint — Ensure all P1 tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. P2 — C2: Bring the AI result into view
  - [x] 16.1 Implement scroll-into-view and focus on new result
    - In `AiRecommendation.tsx` add a `resultRef`; on loading→loaded of a new recommendation id scroll the result container into view and `heading.focus({ preventScroll: true })`; use `prefers-reduced-motion` to pick `auto` vs `smooth`; only scroll on a new result; leave scroll unchanged on failure
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.8_
  - [x] 16.2 Add "Result ready" hint and submit loading state
    - Add an `IntersectionObserver` toggling a floating "Result ready" control (visible only while result top is off-screen; hidden when in view; scrolls on activation); show a loading/disabled submit state and reject concurrent submissions while a request is in flight
    - _Requirements: 2.2, 2.3, 2.7_

- [x] 17. P2 — T1: Remove the technician Dashboard
  - [x] 17.1 Remove Dashboard route, nav, and land on My Tasks
    - Remove the `/technician` route and `TechnicianDashboard` import from `App.tsx`, make `/technician/tasks` the landing page, redirect `/technician` → `/technician/tasks`; remove the Dashboard nav item + top-bar link in `DashboardLayout` and label the entry "My Tasks"; delete `TechnicianDashboard.tsx` and any route/component/endpoint used only by it
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 18. P2 — T3: Continuous-scrolling products catalog
  - [x] 18.1 Make ManageProducts a single continuous list
    - In `ManageProducts.tsx` present all products in one scrolling list, remove any Previous/Next controls, replace page-of-pages text with a total count reflecting the active search/Type filter, and apply text search + Type filter + column sort across all rows; leave other paginated tables unchanged
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  - [ ]* 18.2 Add windowing for large catalogs
    - Optionally virtualize the list (e.g. `@tanstack/react-virtual`) while keeping a single continuous scroll; behavior unchanged
    - _Requirements: 16.1_

- [x] 19. P2 — A8: Remove the `busy` availability state
  - [x] 19.1 Add migration 043 removing `busy` with mandatory data conversion
    - Create `backend/src/database/migrations/20240101000043-remove-busy-availability.js`: first `UPDATE technician_details SET availability_status='available' WHERE availability_status='busy'` (mandatory conversion), then alter the ENUM to `('available','unavailable')`
    - _Requirements: 13.1, 13.2_
  - [x] 19.2 Drop `busy` from model, API, sync, and UI
    - Update `TechnicianDetail.availabilityStatus` ENUM, `UpdateTechnicianInput`, and API responses to drop `busy`; stop `syncTechnicianAvailability` from writing `busy` (manual Available/Unavailable + deactivation→unavailable only); keep job eligibility computed from schedules via `Availability_Service`; retain the manual toggle; leave other technician-table columns/actions unchanged
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.6_
  - [ ]* 19.3 Write integration test for busy→available migration
    - Assert zero `busy` rows remain after the migration runs
    - _Requirements: 13.2_

- [ ] 20. E2E coverage for UI behaviors (Playwright)
  - [ ]* 20.1 Write E2E tests for customer/technician/admin UI behaviors
    - C2 scroll-into-view + hint + reduced-motion + preventScroll + loading submit (Req 2); A1 prefill + dropdown reload (Req 6); T1 lands on My Tasks and `/technician` redirects (Req 14.2, 14.3); T2 Start disabled with becomes-startable time then enabled (Req 15.2–15.4); T3 continuous scroll + total count + no paging (Req 16); T4 modal shows specific error within 2s (Req 17.10); T5 progression reflects In-Progress after reload (Req 18.7)
    - _Requirements: 2.1, 6.1, 14.2, 14.3, 15.2, 15.3, 15.4, 16.1, 17.10, 18.7_

- [x] 21. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks (and the optional virtualization/`046` column) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirement (and acceptance-criteria) numbers for traceability.
- The three shared building blocks (Task 1) are sequenced first because A1/A2/A3/A4/A5/A7/A8/T2/T5 all depend on them.
- All 23 correctness properties are implemented as `fast-check` property tests running ≥100 iterations, tagged `// Feature: revision-batch-1, Property {n}: ...`. DB-backed properties (10, 13, 14, 17, 18, 19, 21, 22) run against in-memory SQLite; atomicity properties (13, 17) inject a mid-transaction fault to assert rollback.
- The placeholder quotation status vocabulary (Task 13.1) is isolated behind a single constants module so it can be swapped when INQUIRY.DOCX arrives.
- Migrations: 042 (`reassigned` status), 043 (remove `busy` + mandatory conversion), 044 (`schedule_reassignments`), 045 (`quotations`), 046 (optional `reschedule_window_ends_at`).
- Checkpoints map to the pre-deploy regression phases (P0, P1, all) for verification, but every task is a code-focused activity.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.5", "1.6", "1.7", "13.1"] },
    { "id": 2, "tasks": ["1.8", "3.1", "6.1", "7.1", "8.1", "11.1", "12.1", "13.2", "13.10", "19.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1", "5.1", "7.2", "8.2", "12.2", "12.3", "13.3", "17.1", "18.1", "19.2"] },
    { "id": 4, "tasks": ["3.4", "4.2", "5.2", "6.2", "7.3", "8.3", "10.1", "11.2", "13.4", "14.1", "16.1", "16.2", "18.2", "19.3"] },
    { "id": 5, "tasks": ["4.3", "5.3", "5.4", "5.5", "5.6", "6.3", "7.4", "7.5", "7.6", "7.7", "7.8", "8.4", "8.5", "8.6", "8.7", "8.8", "10.2", "11.3", "11.4", "11.5", "12.4", "12.5", "12.6", "13.5", "13.6", "14.2"] },
    { "id": 6, "tasks": ["13.7", "13.8", "13.9", "14.3"] },
    { "id": 7, "tasks": ["20.1"] }
  ]
}
```
