# Requirements Document

## Introduction

Revision Batch 1 is a cohesive set of 17 stakeholder-requested changes to the DVTech AI-Powered Web System, derived from the revision spec at `Documents/DVTech-Revision-Spec.md`. The batch spans three roles (Customer, Admin, Technician) and mixes P0 bug fixes with new P1/P2 features. The changes must be delivered together because several revisions share the same underlying logic (available-technician lookup, time-slot start calculation, task status vocabulary).

Grounding notes from the existing codebase:

- Backend is Node.js + Express + TypeScript with Sequelize models. Scheduling lives in `backend/src/services/scheduleService.ts`; rescheduling in `rescheduleService.ts`; AI recommendation in `aiService.ts`; deterministic BTU/HP math in `btuCalculationService.ts`; account activation in `adminService.ts`.
- `TechnicianSchedule.status` is an ENUM of `assigned | accepted | rejected | in-progress | completed` and has no `reassigned` value today. Status strings are written as literals (`'in-progress'`) across services with no shared constant.
- `TechnicianDetail.availabilityStatus` is an ENUM of `available | busy | unavailable`; `syncTechnicianAvailability` actively writes `busy` for in-progress tasks, and `getDashboardStats` counts `available` rows.
- `getAvailableTechnicians(date, slot)` already exists and is exposed at `GET /api/schedules/available-technicians`; the reassign path already reuses `canAssignToSlot`.
- `startTask` gates only on `status === 'assigned'` — there is no assigned-date/time gate.
- `reassignTechnician` sets status back to `'assigned'` and has no audit trail.
- Reschedule expiry is a fixed 48-hour window (`RESCHEDULE_WINDOW_HOURS`), expired lazily by `expireStaleReschedules`.
- There is no quotation entity today; "Request Quotation" deep-links into the service-request form.
- `TechnicianDashboard.tsx` exists and is the technician landing/dashboard page; `ManageProducts.tsx` is the admin products catalog table.

Two external inputs referenced by the feedback were NOT provided in the workspace and are tracked as open dependencies: `INQUIRY.DOCX` (the full Request Quotation transaction, needed for C4 and A6) and page 2 of the products catalog (useful for the HP tiers in C1). See the Assumptions and Open Dependencies section.

## Glossary

- **System**: The DVTech AI-Powered Web System as a whole (frontend, backend API, and AI microservice), used when no narrower component is meant.
- **Recommendation_Engine**: The backend AI recommendation service that computes BTU load, derives HP, matches products, and produces advisory prose (`backend/src/services/aiService.ts` and `btuCalculationService.ts`).
- **Image_Analysis_Service**: The pipeline that combines the Python/OpenCV microservice output and the vision-model output into room metrics used by the Recommendation_Engine.
- **Availability_Service**: A single shared backend function that returns the technicians eligible to take a task for a given date and time slot, computed from the schedules table.
- **Slot_Time_Helper**: A single shared backend function that returns the start instant (Asia/Manila) of a given date + time slot, where Morning starts at 8:00 AM and Afternoon starts at 12:00 PM.
- **Reschedule_Service**: The backend service that creates, expires, and applies reschedule proposals (`backend/src/services/rescheduleService.ts`).
- **Schedule_Service**: The backend service that assigns, starts, completes, and reassigns technician tasks (`backend/src/services/scheduleService.ts`).
- **Account_Service**: The backend service that activates, deactivates, and archives accounts (`backend/src/services/adminService.ts`).
- **Task_Status**: The lifecycle status of a `TechnicianSchedule` row.
- **Task_Status_Enum**: A single shared status vocabulary used by both backend and frontend for Task_Status values.
- **Customer_Panel**: The authenticated customer-facing area of the frontend.
- **Admin_Panel**: The authenticated admin-facing area of the frontend.
- **Technician_Panel**: The authenticated technician-facing area of the frontend.
- **My_Tasks**: The technician's task list view (`frontend/src/pages/technician/MyTasks.tsx`).
- **Products_Catalog_Table**: The admin products table (`frontend/src/pages/admin/ManageProducts.tsx`).
- **Assign_Modal**: The admin dialog that assigns a technician to an approved service request.
- **Reassign_Modal**: The admin dialog that moves an existing schedule to a different technician.
- **My_Quotations**: A new Customer_Panel view listing the customer's own quotation requests.
- **Manage_Quotations**: A new Admin_Panel view listing all incoming quotation requests.
- **Time_Slot**: A half-day booking window, either `morning` (8:00 AM to 11:59 AM) or `afternoon` (12:00 PM to 5:00 PM), Asia/Manila.
- **Base_Load**: The BTU total computed from the customer's form inputs before any image-derived adjustment.
- **OpenCV_Uplift**: The combined additional BTU contributed by Image_Analysis_Service metrics (windows, sunlight, insulation, heat sources) on top of Base_Load.
- **INQUIRY_DOCX**: The external document (not provided) defining quotation statuses, transitions, and admin actions.

## Requirements

---

# Customer Side

### Requirement 1 (C1, P0): Deterministic HP and permitted unit types in AI recommendations

**User Story:** As a customer, I want the AI recommendation to show the correct horsepower and only real unit types we sell, so that I receive an accurate, trustworthy recommendation.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL restrict every recommended unit type to Window Type or Split Type.
2. IF a recommendation response, explanation text, tips, unit card, or AI prompt would contain the term "floor" (case-insensitive), THEN THE Recommendation_Engine SHALL exclude that term from the output before returning the response.
3. WHEN a BTU load is computed, THE Recommendation_Engine SHALL set the recommended horsepower to the smallest horsepower tier in the products table whose rated BTU capacity is greater than or equal to the computed BTU load, and IF two or more tiers share that smallest qualifying rated BTU capacity, THEN THE Recommendation_Engine SHALL select the tier with the lowest horsepower value.
4. THE Recommendation_Engine SHALL read the horsepower tiers and their rated BTU capacities from the products table.
5. WHEN the Recommendation_Engine requests advisory prose from the language model, THE Recommendation_Engine SHALL pass the computed horsepower and unit type as fixed inputs.
6. IF language-model output states a horsepower or unit type that differs from the computed horsepower or unit type, THEN THE Recommendation_Engine SHALL replace the differing value with the computed value before returning the response.
7. THE Recommendation_Engine SHALL use one horsepower value across the "Why this recommendation" text, the electrical tips, the breaker tips, and the recommended unit cards within a single recommendation.
8. THE Recommendation_Engine SHALL select electrical tips and breaker tips for the recommended horsepower class.
9. IF the computed BTU load exceeds the largest rated BTU capacity in the products table, THEN THE Recommendation_Engine SHALL return a site-survey-or-multiple-units message, SHALL include the unit card for the product with the largest rated BTU capacity alongside that message, and SHALL still exclude Floor-Standing unit types.
10. THE Recommendation_Engine SHALL populate each unit card's horsepower, BTU capacity, inverter-or-non-inverter designation, and price from the matching products table row.
11. WHEN the computed BTU load is 9,690 BTU, THE Recommendation_Engine SHALL recommend 1.5 horsepower with a Window Type or Split Type unit.
12. WHEN the computed BTU load is 14,475 BTU, THE Recommendation_Engine SHALL recommend 2.0 horsepower with a Split Type unit.
13. IF the products table contains no horsepower tier whose rated BTU capacity is greater than or equal to the computed BTU load, THEN THE Recommendation_Engine SHALL return a message indicating that no matching unit is available and SHALL NOT return a recommended horsepower or unit card.
14. IF the products table contains no horsepower tiers, THEN THE Recommendation_Engine SHALL return a message indicating that recommendations are unavailable and SHALL preserve the customer's submitted room data.

### Requirement 2 (C2, P2): Bring the AI result into view when it is ready

**User Story:** As a customer, I want the page to move to the recommendation result when it appears, so that I notice the result instead of missing it below the form.

#### Acceptance Criteria

1. WHEN a new recommendation result finishes loading, THE Customer_Panel SHALL scroll the top of the result container into view.
2. WHILE the top of the result container is outside the viewport, THE Customer_Panel SHALL display a "Result ready" hint control that scrolls to the result container when activated.
3. WHEN the top of the result container is within the viewport, THE Customer_Panel SHALL hide the "Result ready" hint control.
4. WHERE the user's system requests reduced motion, THE Customer_Panel SHALL move to the result without an animated scroll.
5. WHEN a new recommendation result finishes loading, THE Customer_Panel SHALL move keyboard focus to the result heading using a focus change that prevents the browser-native focus scroll (preventScroll or equivalent), so that only the single scroll-into-view from criterion 1 occurs and no additional scroll jump is triggered.
6. THE Customer_Panel SHALL perform the scroll-to-result behavior only when a new recommendation result is produced.
7. WHILE a recommendation request is in progress, THE Customer_Panel SHALL display a loading state on the submit control and reject additional submissions.
8. IF a recommendation request fails, THEN THE Customer_Panel SHALL leave the scroll position unchanged.

### Requirement 3 (C3, P0): Consistent, non-inflated OpenCV-assisted recommendations

**User Story:** As a customer, I want the photo-based analysis to refine the recommendation without inflating it, so that the result matches the real room.

#### Acceptance Criteria

1. WHEN a recommendation is generated, THE Recommendation_Engine SHALL present each load contribution, including each Image_Analysis_Service-derived adjustment, as a separate labeled line item.
2. WHEN a recommendation is generated, THE Recommendation_Engine SHALL make the sum of the displayed line items equal the displayed total BTU within a tolerance of plus or minus 1 BTU.
3. WHEN a heat source is present in both the customer form input and the Image_Analysis_Service output, THE Recommendation_Engine SHALL count that heat source exactly once.
4. THE Recommendation_Engine SHALL cap the combined OpenCV_Uplift at a configurable maximum, defaulting to 15 percent of the Base_Load.
5. WHEN a recommendation narrative is generated, THE Recommendation_Engine SHALL derive the narrative only from measured room values.
6. IF the Image_Analysis_Service reports zero windows detected, THEN THE Recommendation_Engine SHALL exclude any claim of multiple windows from the narrative.
7. IF the Image_Analysis_Service does not report poor insulation, THEN THE Recommendation_Engine SHALL exclude any claim of poor insulation from the narrative.
8. WHEN the same room inputs are submitted with and without a room photo, THE Recommendation_Engine SHALL produce total BTU values that differ by no more than the configured OpenCV_Uplift cap.
9. WHEN generating a recommendation on the OpenCV-assisted path, THE Recommendation_Engine SHALL apply the horsepower derivation and permitted-unit-type rules of Requirement 1.
10. WHEN the computed BTU load is 14,475 BTU with Image_Analysis_Service metrics, THE Recommendation_Engine SHALL recommend 2.0 horsepower with a Split Type unit.
11. IF the Image_Analysis_Service is unavailable or returns no usable output, THEN THE Recommendation_Engine SHALL produce the recommendation using only the customer form inputs, apply zero OpenCV_Uplift, and present an indication to the customer that photo-based analysis was not applied.

### Requirement 4 (C4, P1): My Quotations tab for customers

**User Story:** As a customer, I want a My Quotations tab listing every quotation I requested, so that I can track quotations from the moment I submit them.

#### Acceptance Criteria

1. THE Customer_Panel SHALL provide a My_Quotations navigation item and a corresponding route.
2. WHEN a customer submits a quotation request, THE System SHALL make that quotation request appear in that customer's My_Quotations view.
3. THE My_Quotations view SHALL display, for each quotation request, the quotation identifier, the unit brand and model, the submitted date, the current status, and a details action.
4. THE My_Quotations view SHALL order quotation requests with the most recently submitted first.
5. THE My_Quotations view SHALL provide a text search control and a status filter control.
6. WHEN a request has no matching quotation requests for the active search or status filter, THE My_Quotations view SHALL display an empty state.
7. WHEN a customer requests My_Quotations data, THE System SHALL return only quotation requests that belong to the requesting customer.
8. THE System SHALL enforce the ownership restriction of criterion 7 on the server.
9. WHEN a quotation reaches the Assigned or Paid status, THE System SHALL keep the quotation visible in My_Quotations and SHALL preserve the existing My Requests behavior for that quotation.
10. THE System SHALL use the quotation status values defined in INQUIRY_DOCX.

### Requirement 5 (C4/A6 dependency): INQUIRY.DOCX status vocabulary dependency

**User Story:** As a developer, I want the quotation status vocabulary sourced from INQUIRY.DOCX, so that the quotation features match the documented transaction rather than invented statuses.

#### Acceptance Criteria

1. WHERE INQUIRY_DOCX is available, THE System SHALL use the quotation status values and transitions defined in INQUIRY_DOCX for My_Quotations and Manage_Quotations.
2. IF INQUIRY_DOCX is unavailable when the quotation features are implemented, THEN the design SHALL record the placeholder status vocabulary used and SHALL identify it as an assumption pending INQUIRY_DOCX.

---

# Admin Side

### Requirement 6 (A1, P1): Assign modal prefills the customer's requested date and slot

**User Story:** As an admin, I want the Assign modal to prefill the customer's requested date and time slot, so that I only need to pick an available technician.

#### Acceptance Criteria

1. WHEN the Assign_Modal opens for a request that has a customer-requested date and Time_Slot, THE Assign_Modal SHALL prefill the scheduled date and Time_Slot fields from that request.
2. WHEN the scheduled date and Time_Slot are prefilled, THE Assign_Modal SHALL load the technician dropdown filtered to technicians available for that date and Time_Slot using the Availability_Service.
3. THE Assign_Modal SHALL keep the prefilled scheduled date and Time_Slot fields editable.
4. WHEN the admin changes the scheduled date or Time_Slot, THE Assign_Modal SHALL reload the technician dropdown for the changed date and Time_Slot.
5. IF a request has no customer-requested date and Time_Slot, THEN THE Assign_Modal SHALL leave the scheduled date and Time_Slot fields empty and editable.
6. WHEN the admin saves the assignment, THE Schedule_Service SHALL store the same date and Time_Slot on which the dropdown was filtered.
7. THE System SHALL derive and store the scheduled date using the Asia/Manila timezone so that the stored date matches the displayed date.

### Requirement 7 (A2, P0): Assign dropdown returns available technicians reliably

**User Story:** As an admin, I want the Assign technician dropdown to list actually available technicians, so that I can assign work instead of seeing a persistent empty or failed list.

#### Acceptance Criteria

1. WHEN the Availability_Service is queried for a date and Time_Slot, THE Availability_Service SHALL return every technician whose account is Active and who has no conflicting non-cancelled schedule for that exact date and Time_Slot.
2. THE Availability_Service SHALL compute availability from the schedules table.
3. THE Availability_Service SHALL exclude technicians whose accounts are deactivated.
4. WHEN two technicians hold schedules on different dates or different Time_Slots, THE Availability_Service SHALL treat neither schedule as a conflict for the other technician.
5. IF the available-technicians request fails, THEN THE Assign_Modal SHALL display an error state with a retry action.
6. WHEN the available-technicians request succeeds and returns no technicians, THE Assign_Modal SHALL display a no-technicians-available message distinct from the error state.
7. THE System SHALL expose the Availability_Service as one shared function that accepts an optional technician identifier to exclude, and WHEN that identifier is supplied THE Availability_Service SHALL apply the exclusion as a pre-filter by removing the identified technician from consideration before the active-status and schedule-conflict checks run.

### Requirement 8 (A3, P0): Reassign dropdown returns eligible technicians

**User Story:** As an admin, I want the Reassign dropdown to list technicians who can take over a schedule, so that I can reassign work when a technician cannot perform it.

#### Acceptance Criteria

1. WHEN the Reassign_Modal opens for a schedule, THE Reassign_Modal SHALL load the New Technician dropdown using the Availability_Service for that schedule's date and Time_Slot.
2. THE Availability_Service SHALL exclude the schedule's current technician from the reassignment result.
3. THE Reassign_Modal SHALL include only Active technicians who have no conflicting schedule for that date and Time_Slot.
4. IF the available-technicians request fails, THEN THE Reassign_Modal SHALL display an error state with a retry action.
5. WHEN the available-technicians request succeeds and returns no technicians, THE Reassign_Modal SHALL display a no-technicians-available message.
6. WHILE no technician is selected, THE Reassign_Modal SHALL keep the Reassign action disabled.
7. WHEN a technician is selected, THE Reassign_Modal SHALL enable the Reassign action.

### Requirement 9 (A4, P1): Reassignment transfers the schedule and records an audit trail

**User Story:** As an admin, I want a reassignment to move the schedule to the new technician and mark it Reassigned, so that both technicians' task lists and the audit record are correct.

#### Acceptance Criteria

1. WHEN the admin confirms a reassignment, THE Schedule_Service SHALL set the schedule's Task_Status to Reassigned.
2. WHEN a reassignment is confirmed, THE System SHALL display the schedule details in the new technician's My_Tasks.
3. WHEN a reassignment is confirmed, THE System SHALL remove the schedule from the previous technician's My_Tasks and from the previous technician's task counts.
4. THE Schedule_Service SHALL apply the Task_Status change and the technician change of a reassignment as one atomic transaction.
5. WHEN a reassignment is confirmed, THE Schedule_Service SHALL record the reassigning admin, the reassignment timestamp, the previous technician, and the new technician.
6. WHEN a reassignment is requested, THE Schedule_Service SHALL validate on the server that the new technician is Active and has no conflicting schedule for that date and Time_Slot.
7. IF the schedule's Task_Status is In-Progress or Completed, THEN THE Schedule_Service SHALL reject the reassignment.
8. WHEN a task has the Reassigned Task_Status and its assigned date and Time_Slot have started, THE System SHALL allow the new technician to start the task under the same validation checks as an Assigned task plus reassignment-specific revalidation, specifically re-checking that the new technician is still Active before allowing the start.

### Requirement 10 (A5, P1): Reschedule proposals expire at the earlier of two days or the proposed slot start

**User Story:** As an admin, I want a reschedule proposal to expire when its proposed slot arrives if that is sooner than two days, so that stale proposals do not linger past their own date.

#### Acceptance Criteria

1. WHEN a reschedule proposal is created, THE Reschedule_Service SHALL compute the proposal's expiry as the earlier of the proposal creation time plus 48 hours and the start instant of the proposed date and Time_Slot.
2. IF the proposal creation time plus 48 hours equals the start instant of the proposed date and Time_Slot, THEN THE Reschedule_Service SHALL set the expiry to that shared instant.
3. THE Reschedule_Service SHALL compute the start instant of the proposed date and Time_Slot using the Slot_Time_Helper in the Asia/Manila timezone.
4. THE System SHALL compute reschedule expiry through one shared function.
5. IF the proposed date and Time_Slot cannot be resolved to a start instant, THEN THE Reschedule_Service SHALL reject the proposal with a validation response identifying the unresolved field and SHALL NOT create the proposal.
6. WHEN a proposal's expiry time has passed, THE System SHALL set the proposal's status to Expired within 60 seconds of the expiry time and without waiting for the 48-hour mark.
7. WHEN the expiry transition is applied more than once to the same proposal, THE System SHALL leave the proposal's status and expiry time unchanged after the first application.
8. WHEN a proposal's status is Expired, THE System SHALL allow the associated customer to submit a new request.
9. THE System SHALL display the computed expiry time to the admin and to the customer as a date and time of day in the Asia/Manila timezone.
10. WHEN a proposal is created on September 29 at 9:00 AM Asia/Manila for a proposed date of September 30 Morning, THE Reschedule_Service SHALL set the expiry to September 30 at 8:00 AM Asia/Manila.
11. WHEN a proposal is created on September 29 at 9:00 AM Asia/Manila for a proposed date five days later, THE Reschedule_Service SHALL set the expiry to October 1 at 9:00 AM Asia/Manila, exactly 48 hours after creation.

### Requirement 11 (A6, P1): Manage Quotations tab for admins

**User Story:** As an admin, I want a Manage Quotations tab listing incoming quotation requests, so that I can process quotations before they enter scheduling.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a Manage_Quotations navigation item and a corresponding route.
2. THE Manage_Quotations view SHALL display, for each quotation request, the quotation identifier, the customer, the unit, the submitted date, the status, and the admin actions defined in INQUIRY_DOCX.
3. THE Manage_Quotations view SHALL order quotation requests with the most recently submitted first.
4. THE Manage_Quotations view SHALL provide a text search control and a status filter control.
5. WHEN a quotation-based request reaches the Paid status, THE System SHALL add that request to the Requests Awaiting Scheduling list in Manage Schedules.
6. WHILE a quotation-based request has a status earlier than Paid, THE System SHALL exclude that request from the Requests Awaiting Scheduling list.
7. THE System SHALL preserve the existing scheduling behavior for non-quotation service requests.
8. WHEN a non-admin requests Manage_Quotations data or actions, THE System SHALL deny the request on the server.

### Requirement 12 (A7, P0): Technician activation restores the account reliably

**User Story:** As an admin, I want activating a technician to succeed and restore the account, so that the technician can work again without an unexpected error.

#### Acceptance Criteria

1. WHEN the admin confirms activation of a technician, THE Account_Service SHALL set the technician account to Active and clear its deactivated and archived state.
2. WHEN a technician account is activated, THE System SHALL include the technician in the active technicians list and in the Availability_Service results for a free date and Time_Slot.
3. WHEN a technician account is activated, THE System SHALL allow that technician to log in.
4. IF the target technician account does not exist, THEN THE Account_Service SHALL return a not-found response.
5. IF the target technician account is already Active, THEN THE Account_Service SHALL return a conflict response.
6. IF the requester is not authorized to activate accounts, THEN THE Account_Service SHALL return a forbidden response.
7. IF an unexpected error occurs during activation, THEN THE Account_Service SHALL log the error with its stack trace.
8. WHEN a technician account is deactivated and then activated, THE Account_Service SHALL complete both operations successfully on repeated cycles.

### Requirement 13 (A8, P2): Remove the busy availability state

**User Story:** As an admin, I want availability to reflect only manual Available or Unavailable, so that technicians are not shown as busy when they are not.

#### Acceptance Criteria

1. THE System SHALL remove the busy value from the technician availability data model, API, and user interface.
2. THE System SHALL require the batch migration to run as a mandatory step that converts every existing technician availability value of busy to available, because the busy value is removed from the availability model entirely and any legacy busy rows that remain unconverted constitute a data-integrity issue.
3. THE System SHALL determine whether a technician can take a job for a date and Time_Slot from the schedules table using the Availability_Service.
4. THE System SHALL provide a manual technician availability toggle with the two values Available and Unavailable.
5. WHEN a technician's availability is Unavailable, THE Availability_Service SHALL exclude that technician from its results.
6. THE System SHALL leave all other columns and actions of the technicians table unchanged.

---

# Technician Side

### Requirement 14 (T1, P2): Remove the technician Dashboard

**User Story:** As a technician, I want to land on My Tasks with no Dashboard, so that my workspace is focused on my tasks.

#### Acceptance Criteria

1. THE Technician_Panel SHALL exclude a Dashboard navigation item, a Dashboard top-bar link, and a Dashboard page.
2. WHEN a technician logs in, THE System SHALL land the technician on My_Tasks.
3. WHEN a technician navigates to a former technician dashboard URL, THE System SHALL redirect to My_Tasks.
4. THE Technician_Panel SHALL label the top-bar entry that leads into the panel as My Tasks.
5. WHERE the technician dashboard route, component, or API endpoint is referenced only by the removed Dashboard, THE System SHALL remove that route, component, or API endpoint.

### Requirement 15 (T2, P1): Block Start before the assigned date and slot

**User Story:** As a technician, I want the Start action blocked until the assigned date and time, so that I cannot start a job early.

#### Acceptance Criteria

1. THE Slot_Time_Helper SHALL return the start instant of a date and Time_Slot in the Asia/Manila timezone, using 8:00 AM for Morning and 12:00 PM for Afternoon.
2. WHILE the current Asia/Manila time is before the start of a task's assigned date and Time_Slot, THE Technician_Panel SHALL disable the Start control for that task.
3. WHILE the Start control is disabled for a not-yet-startable task, THE Technician_Panel SHALL display the date and time at which the task becomes startable.
4. WHEN the current Asia/Manila time is at or after the start of a task's assigned date and Time_Slot, THE Technician_Panel SHALL enable the Start control for that task.
5. IF a start request arrives before the start of the task's assigned date and Time_Slot, THEN THE Schedule_Service SHALL reject the request with a client-error response.
6. THE Schedule_Service SHALL apply the start-time rule to tasks with the Assigned Task_Status and tasks with the Reassigned Task_Status.
7. THE System SHALL compute the start-time rule using the Slot_Time_Helper shared with Requirement 10.

### Requirement 16 (T3, P2): Continuous scrolling products catalog

**User Story:** As an admin, I want the products catalog to scroll as one continuous list, so that I can browse all products without paging controls.

#### Acceptance Criteria

1. THE Products_Catalog_Table SHALL present all products in one continuous list.
2. THE Products_Catalog_Table SHALL exclude Previous and Next paging controls.
3. THE Products_Catalog_Table SHALL replace the page-of-pages text with a total product count that reflects the active search and filter.
4. THE Products_Catalog_Table SHALL apply the text search, the Type filter, and column sorting across all product rows.
5. THE System SHALL leave all other tables that use Previous and Next paging controls unchanged.

### Requirement 17 (T4, P0): Reliable completion report submission

**User Story:** As a technician, I want submitting a completion report to succeed for a valid task, so that the task is marked completed instead of failing with an unexpected error.

#### Acceptance Criteria

1. WHEN a technician submits a completion report whose length is between 20 and 2000 characters inclusive, together with a photo no larger than 5 megabytes whose type is JPEG, PNG, or WEBP, for a task whose Task_Status is In-Progress, THE Schedule_Service SHALL store the report text, store the photo, and set the Task_Status to Completed.
2. WHEN a task is completed, THE System SHALL move the task from the In-Progress tab to the Completed tab in the technician's My_Tasks, decrement the In-Progress task count, increment the Completed task count, and reflect the Completed Task_Status in the admin and customer views of that task.
3. IF a completion request omits a required field, THEN THE Schedule_Service SHALL return a validation response identifying the omitted field and SHALL leave the Task_Status unchanged.
4. IF a completion report has a length shorter than 20 characters or longer than 2000 characters, THEN THE Schedule_Service SHALL return a validation response identifying the report field and SHALL leave the Task_Status unchanged.
5. IF a completion request targets a task whose Task_Status is not In-Progress, THEN THE Schedule_Service SHALL return a conflict response naming the current Task_Status and SHALL leave the Task_Status unchanged.
6. IF a completion photo exceeds 5 megabytes, THEN THE Schedule_Service SHALL return a payload-too-large response and SHALL leave the Task_Status unchanged.
7. IF a completion photo is not of type JPEG, PNG, or WEBP, THEN THE Schedule_Service SHALL return an unsupported-media-type response and SHALL leave the Task_Status unchanged.
8. WHEN a completion request is accepted, THE Schedule_Service SHALL commit the report text, the photo path, the Completed Task_Status, and the completion timestamp as one atomic transaction that either persists all of these values or persists none of them.
9. IF an unexpected server fault occurs during completion, THEN THE Schedule_Service SHALL roll back the completion transaction, leave the Task_Status unchanged, return a server-error response, and log the fault with its stack trace.
10. WHEN a completion request fails, THE Technician_Panel SHALL display the specific error message in the completion modal within 2 seconds of receiving the response.

### Requirement 18 (T5, P0): Consistent In-Progress status across Start and Complete

**User Story:** As a technician, I want Start to reliably set In-Progress everywhere, so that completing a started task is not rejected with an in-progress error.

#### Acceptance Criteria

1. WHEN a technician starts a task, THE Schedule_Service SHALL persist the In-Progress Task_Status on the record that the completion check reads.
2. WHEN a technician starts a task, THE Technician_Panel SHALL update the status badge, the task progression indicator, and the tab counts from the server response.
3. THE Schedule_Service SHALL evaluate the completion status check using the Task_Status_Enum.
4. THE System SHALL use one Task_Status_Enum shared across the backend and the frontend for Task_Status values.
5. THE task progression indicator SHALL reflect the stored Task_Status.
6. IF a completion request targets a task whose Task_Status is not In-Progress, THEN THE Schedule_Service SHALL reject the request and name the current Task_Status in the message.
7. WHEN a technician starts a task and then reloads My_Tasks, THE task progression indicator SHALL reflect the In-Progress Task_Status.

---

# Cross-Cutting Requirements

### Requirement 19: Shared services and server-side enforcement

**User Story:** As a developer, I want shared logic and server-enforced rules, so that the batch stays consistent and cannot be bypassed through the UI.

#### Acceptance Criteria

1. THE System SHALL provide one Availability_Service used by the assign, reassign, reschedule, and activation availability lookups (Requirements 6, 7, 8, 9, 12).
2. THE System SHALL provide one Slot_Time_Helper used by the reschedule-expiry computation and the technician start-time gate (Requirements 10 and 15).
3. THE System SHALL provide one Task_Status_Enum used across the backend and the frontend (Requirement 18).
4. THE System SHALL enforce every business rule in this document on the server in addition to any user-interface enforcement.
5. THE System SHALL derive and store dates using the Asia/Manila timezone so that a stored date matches its displayed date, and IF a client submits a date or time in a non-Asia/Manila timezone or without timezone information, THEN THE System SHALL convert the submitted value to the Asia/Manila timezone on the server before storage.

### Requirement 20: Automated test coverage

**User Story:** As a developer, I want automated tests for the acceptance criteria, so that the batch's behavior is verified and protected against regressions.

#### Acceptance Criteria

1. THE System SHALL include automated tests that cover the acceptance criteria of the revisions in this document.
2. WHEN the automated test suite runs, THE System SHALL execute the tests to a pass-or-fail result.

---

## Assumptions and Open Dependencies

These assumptions apply the documented defaults from Section 4 of the source revision spec. Each remains open for stakeholder confirmation.

- **Q1 (Requirement 10):** Reschedule expiry is interpreted as the earlier of (created + 2 days) and the start of the proposed date/slot.
- **Q2 (Requirement 11):** Quotation-based requests enter scheduling only when Paid; non-quotation service requests keep their current behavior (the Awaiting list currently shows Approved requests).
- **Q3 (Requirement 14):** The stakeholder sentence for T1 was cut off after "...AND DAPAT"; scope is limited to removing the Dashboard and landing on My Tasks. No additional behavior is added.
- **Q4 (Requirement 13):** The manual Available/Unavailable toggle is retained rather than removing the availability column entirely.
- **Q5 (Requirement 16):** T3 targets the admin Products catalog table only; other tables using Previous/Next are left unchanged.
- **Q6 (Requirement 6):** Prefilled date and time fields remain editable by the admin.
- **Q7 (Requirement 9):** A Reassigned task can be started by the new technician like an Assigned task.
- **Q8 (Requirement 15):** No end-of-slot cutoff; Start remains allowed after the slot starts.
- **Q9 (Requirement 3):** The OpenCV uplift cap defaults to 15 percent of the Base_Load and is configurable.
- **Q10 (Requirements 4, 5, 11):** `INQUIRY.DOCX` was NOT provided in the workspace. Quotation statuses, transitions, and admin actions for My Quotations and Manage Quotations depend on it. Page 2 of the products catalog was also not provided; Requirement 1 reads all catalog HP tiers from the products table rather than a hardcoded list, so the missing page does not block correctness but should be verified against seeded data.

**Missing dependency flag:** `INQUIRY.DOCX` is a hard blocker for the exact status vocabulary of C4 (Requirement 4) and A6 (Requirement 11). Until it is provided, the design must record a placeholder status set and mark it as an assumption per Requirement 5.
