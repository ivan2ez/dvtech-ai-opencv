# Requirements Document

## Introduction

This document defines the requirements for the DVTech AI-Powered Web-Based System — a unified platform that provides AI-driven air conditioning recommendations, streamlines service request management, and enables technician scheduling for DVTech, a local AC service provider with approximately 30 technicians handling installation, maintenance, and repair services. The system serves four user roles (Customer, Admin, Technician, Guest) through a three-tier architecture with a React.js frontend, Node.js/Express.js backend, Python/OpenCV AI microservice, and MySQL database.

## Glossary

- **System**: The DVTech AI-Powered Web-Based System as a whole
- **Auth_Module**: The authentication and authorization subsystem handling registration, login, and role-based access control
- **AI_Engine**: The AI processing subsystem that performs image analysis, BTU calculation, and product recommendation using OpenAI API and OpenCV
- **Chatbot**: The conversational interface subsystem powered by gpt-4o-mini that guides users through room data collection and service inquiries
- **Service_Request_Module**: The subsystem managing service request creation, approval workflow, and status tracking
- **Scheduling_Module**: The subsystem handling technician task assignment, acceptance, and status progression
- **Product_Module**: The subsystem managing air conditioning product records, service types, pricing, and BTU factors
- **Report_Module**: The subsystem that generates and displays administrative reports
- **Customer**: An authenticated end-user who browses services, submits service requests, receives AI recommendations, and interacts with the Chatbot
- **Admin**: DVTech management personnel who approves reservations, assigns technicians, manages products and pricing, oversees accounts, and generates reports
- **Technician**: Field personnel who views assigned tasks, accepts or rejects assignments, updates service status, and submits completion reports
- **Guest**: An unauthenticated visitor who can browse the website and view services but cannot submit requests or use AI features
- **BTU**: British Thermal Unit — the unit of measurement for cooling capacity of air conditioning units
- **BTU_Factors**: Configurable parameters managed by Admin that influence the BTU calculation (e.g., area factor, occupancy factor, sunlight factor)
- **Service_Request**: A booking or reservation submitted by a Customer for an AC service (installation, maintenance, or repair)
- **Room_Assessment**: A data record containing room parameters (area, ceiling height, occupancy, sunlight level, optional image) used for AI recommendation
- **Task**: A scheduled assignment linking a Technician to an approved Service_Request

---

## Requirements

### Requirement 1: Customer Registration

**User Story:** As a visitor, I want to register as a Customer, so that I can access AI features and submit service requests.

#### Acceptance Criteria

1. WHEN a visitor submits registration data with a name between 2 and 100 characters, a valid email address, and a password between 8 and 128 characters containing at least one uppercase letter, one lowercase letter, and one digit, THE Auth_Module SHALL create a new Customer account with the role set to "Customer", store the password hashed using bcrypt, and return a success confirmation to the visitor
2. IF the submitted email already exists in the system, THEN THE Auth_Module SHALL reject the registration and display an error message indicating the email is already in use
3. IF any required field (name, email, password) is missing or fails validation rules, THEN THE Auth_Module SHALL reject the registration without creating an account and display field-specific validation error messages identifying each invalid field and the reason for rejection
4. WHEN a new Customer account is successfully created, THE Auth_Module SHALL store the account with the visitor-provided name and email as the unique identifier in the USERS table

---

### Requirement 2: User Authentication

**User Story:** As a registered user, I want to log in securely, so that I can access my role-specific features.

#### Acceptance Criteria

1. WHEN a user submits valid credentials (email and password), THE Auth_Module SHALL authenticate the user and issue a JWT session token containing the user's id and role, with a token expiration time of 24 hours
2. WHEN a user submits invalid credentials, THE Auth_Module SHALL reject the login attempt and display a generic error message without revealing which field is incorrect
3. WHEN an authenticated user makes a request with an expired or invalid token, THE Auth_Module SHALL deny access and return an unauthorized response requiring the user to re-authenticate
4. THE Auth_Module SHALL hash all passwords using bcrypt with a minimum cost factor of 10 before storage
5. IF a user fails login 5 consecutive times for the same email address, THEN THE Auth_Module SHALL lock the account for 15 minutes and reject further login attempts for that account until the lockout period expires
6. WHEN a user is successfully authenticated, THE Auth_Module SHALL redirect the user to their role-specific dashboard (Admin dashboard, Technician dashboard, or Customer dashboard) based on the role stored in the JWT token

---

### Requirement 3: Role-Based Access Control

**User Story:** As the system owner, I want to enforce role-based access control, so that each user can only access features permitted for their role.

#### Acceptance Criteria

1. THE Auth_Module SHALL restrict access to endpoints based on the authenticated user role, where Customer role is permitted access to service requests, AI recommendations, chatbot, and profile management; Admin role is permitted access to service request approval, technician scheduling, product management, account management, BTU factor management, and reports; and Technician role is permitted access to assigned task viewing, task acceptance or rejection, status updates, and completion report submission
2. WHEN an authenticated user attempts to access a resource outside their role permissions, THE Auth_Module SHALL deny the request, return a forbidden error response indicating insufficient permissions, and keep the user on their current page or redirect them to their role-specific dashboard
3. WHEN a user successfully authenticates, THE Auth_Module SHALL redirect the user to their role-specific dashboard (Customer dashboard, Admin dashboard, or Technician dashboard)
4. WHILE a user is unauthenticated (Guest), THE System SHALL permit access only to public pages (service browsing, pricing, website information, login, and registration)
5. IF an unauthenticated user attempts to access a protected resource, THEN THE Auth_Module SHALL redirect the user to the login page

---

### Requirement 4: Profile Management

**User Story:** As an authenticated user, I want to update my profile information, so that my account details remain current.

#### Acceptance Criteria

1. WHEN an authenticated user submits updated profile information, THE Auth_Module SHALL validate that the name is between 1 and 100 characters and the email is a valid email format not exceeding 254 characters, and save the changes to the user record
2. IF an authenticated user submits profile data where the name is empty or exceeds 100 characters, or the email is missing or not in valid email format, THEN THE Auth_Module SHALL reject the update and display field-specific validation errors indicating which fields failed and why
3. IF an authenticated user submits an email that is already associated with another user account, THEN THE Auth_Module SHALL reject the update and display an error indicating the email is already in use
4. IF a profile update request includes a role change, THEN THE Auth_Module SHALL ignore the role field and preserve the user's existing role

---

### Requirement 5: AI Room Assessment Input

**User Story:** As a Customer, I want to provide my room information, so that the system can calculate the appropriate AC unit for my space.

#### Acceptance Criteria

1. WHEN a Customer submits room data containing area (1.0 to 1000.0 sq meters, float), ceiling height (1.0 to 10.0 meters, float), occupancy (1 to 500, integer), and sunlight level (one of: low, moderate, high), THE AI_Engine SHALL accept the input, create a Room_Assessment record, and associate it with the Customer's service request
2. IF a Customer submits room data missing any required field (area, ceiling height, occupancy, or sunlight level), THEN THE AI_Engine SHALL reject the submission and indicate which fields are missing
3. IF a Customer submits room data with values outside the allowed ranges or an invalid sunlight level, THEN THE AI_Engine SHALL reject the submission and indicate which fields have invalid values
4. WHEN a Customer uploads a room image (JPEG or PNG, maximum 10 MB) along with room data, THE AI_Engine SHALL accept the image and associate it with the Room_Assessment record
5. IF a Customer uploads a room image that exceeds 10 MB or is not in JPEG or PNG format, THEN THE AI_Engine SHALL reject the image and indicate that the file must be a JPEG or PNG image not exceeding 10 MB
6. WHILE a user is unauthenticated (Guest), THE AI_Engine SHALL deny access to the room assessment input feature

---

### Requirement 6: AI Image Analysis

**User Story:** As a Customer, I want the system to analyze my room image, so that it can assess environmental factors that affect AC sizing.

#### Acceptance Criteria

1. WHEN a room image is submitted in a supported format (JPEG, PNG, or WebP) and within 10 MB, THE AI_Engine SHALL preprocess the image using OpenCV by resizing to a maximum of 1024x1024 pixels and compressing to under 1 MB before sending it to the OpenAI Vision API
2. WHEN the OpenAI Vision API returns analysis results, THE AI_Engine SHALL extract structured room characteristics including estimated window count (integer), sunlight exposure level (low, medium, or high), detected heat source types (e.g., kitchen appliances, electronics, lighting), and insulation quality rating (poor, fair, or good)
3. IF the image analysis API call fails, THEN THE AI_Engine SHALL retry up to 3 times with exponential backoff starting at 1 second, and after exhausting retries, return an error message indicating that image analysis could not be completed and suggesting the user retry or upload a different image
4. IF the submitted image is not in a supported format (JPEG, PNG, or WebP) or exceeds 10 MB, THEN THE AI_Engine SHALL reject the submission and return an error message indicating the accepted formats and maximum file size
5. IF the submitted image cannot be processed by OpenCV preprocessing (corrupt file or unreadable content), THEN THE AI_Engine SHALL return an error message indicating the image could not be read and prompting the user to upload a valid room photograph

---

### Requirement 7: BTU Calculation and AC Recommendation

**User Story:** As a Customer, I want to receive a personalized AC recommendation, so that I can choose the right unit for my room.

#### Acceptance Criteria

1. WHEN a Room_Assessment record is complete (area, ceiling_height, occupancy, and sunlight_level are present), THE AI_Engine SHALL calculate the total BTU requirement using the Room_Assessment parameters and all configurable BTU_Factors from the BTU_FACTORS table
2. IF the BTU_FACTORS table contains no active factors or the AIRCON_PRODUCTS catalog contains no products matching the recommended unit type, THEN THE AI_Engine SHALL return an error response indicating the missing configuration and SHALL NOT produce a partial recommendation
3. WHEN the total BTU is calculated, THE AI_Engine SHALL determine the recommended horsepower (ranging from 0.5 to 5.0 HP) and unit type (split-type, window-type, or floor-standing) based on the computed BTU value
4. WHEN the recommended specifications are determined, THE AI_Engine SHALL match the recommendation to the product from the AIRCON_PRODUCTS catalog whose btu_capacity is equal to or is the nearest value above the calculated total BTU and whose type matches the recommended unit type
5. THE AI_Engine SHALL return the recommendation as structured JSON containing total_btu, recommended_hp, unit_type, matched product details (brand, model, horsepower, btu_capacity, price), and a reasoning field explaining how the BTU was derived
6. WHEN the recommendation is successfully generated, THE AI_Engine SHALL save the result to the AI_RECOMMENDATIONS table linked to the corresponding Room_Assessment record
7. WHEN an image was provided, THE AI_Engine SHALL include troubleshooting suggestions for any common AC issues identified in the image analysis

---

### Requirement 8: Chatbot Conversational Interface

**User Story:** As a Customer, I want to interact with a chatbot, so that I can get guided assistance for room data collection and service inquiries.

#### Acceptance Criteria

1. THE Chatbot SHALL provide a conversational interface accessible to authenticated Customers
2. WHEN a Customer sends a message, THE Chatbot SHALL return a response generated by gpt-4o-mini within 10 seconds, limited to a maximum of 500 tokens per response
3. THE Chatbot SHALL guide users through collecting room details (area, ceiling height, occupancy, sunlight level) via conversational prompts, asking for one detail at a time until all four values are provided
4. THE Chatbot SHALL provide answers to frequently asked questions about DVTech services (e.g., available service types, pricing inquiries, booking process)
5. THE Chatbot SHALL maintain conversation context by storing chat history per session and sending the last 10 messages to the API for context continuity
6. WHILE a user is unauthenticated (Guest), THE Chatbot SHALL deny access to the conversational interface and display a message indicating that login is required
7. IF the OpenAI API request fails or times out, THEN THE Chatbot SHALL display an error message indicating the service is temporarily unavailable and allow the Customer to retry their last message
8. WHEN the Chatbot has collected all four room detail values (area, ceiling height, occupancy, sunlight level), THE Chatbot SHALL present a summary of the collected data and offer the Customer the option to proceed to the AI recommendation

---

### Requirement 9: Service Browsing

**User Story:** As a visitor or customer, I want to browse available services and pricing, so that I can understand what DVTech offers.

#### Acceptance Criteria

1. THE System SHALL display all active service types (installation, maintenance, repair/consultation) with their descriptions and pricing to all users without requiring authentication
2. THE System SHALL display the air conditioning product catalog with specifications (brand, model, type, horsepower, BTU capacity, price, description, and image) to all users without requiring authentication
3. THE System SHALL support paginated browsing of the product catalog, displaying a maximum of 20 products per page, with the ability to filter by type (split-type, window-type, floor-standing) and sort by price
4. IF no services or products are available in the system, THEN THE System SHALL display an informative empty-state message indicating that no items are currently listed

---

### Requirement 10: Service Request Submission

**User Story:** As a Customer, I want to submit a service request, so that I can book an AC service from DVTech.

#### Acceptance Criteria

1. WHEN a Customer selects a service type (installation, maintenance, or repair), enters AC details (maximum 1000 characters), and submits the request, THE Service_Request_Module SHALL save the request with a "pending" status linked to the authenticated Customer's user_id
2. IF a Customer submits a service request with a missing service type or empty AC details, THEN THE Service_Request_Module SHALL reject the submission and display a validation error message indicating which required fields are missing
3. IF a Customer submits a service request with a service type value that is not one of "installation", "maintenance", or "repair", THEN THE Service_Request_Module SHALL reject the submission and display a validation error message indicating the invalid service type
4. WHILE a user is unauthenticated (Guest), THE Service_Request_Module SHALL deny access to the service request submission feature and redirect the user to the login page

---

### Requirement 11: Service Request Approval Workflow

**User Story:** As an Admin, I want to review and approve or reject service requests, so that only valid requests proceed to technician assignment.

#### Acceptance Criteria

1. THE Service_Request_Module SHALL display all submitted service requests to the Admin in a list view with filtering by status (pending, approved, rejected), service type, and submission date, and sorting by submission date (newest first by default) and status
2. WHEN an Admin approves a service request that has a status of "pending", THE Service_Request_Module SHALL update the request status from "pending" to "approved" and make the request eligible for technician assignment
3. WHEN an Admin rejects a service request that has a status of "pending", THE Service_Request_Module SHALL require the Admin to provide a rejection reason (minimum 10 characters, maximum 500 characters) and update the request status to "rejected"
4. IF an Admin attempts to approve or reject a service request that does not have a status of "pending", THEN THE Service_Request_Module SHALL prevent the action and display an error message indicating that only pending requests can be approved or rejected
5. THE Service_Request_Module SHALL allow only users with the Admin role to access the approve and reject actions, and SHALL hide or disable these actions for all other user roles

---

### Requirement 12: Customer Service Request Tracking

**User Story:** As a Customer, I want to view the status of my service requests, so that I can track their progress.

#### Acceptance Criteria

1. WHEN a Customer accesses their service request list, THE Service_Request_Module SHALL display only the requests submitted by that Customer (filtered by user_id), showing for each request: service type, AC details, submission date, and current status, sorted by submission date descending (most recent first)
2. WHEN a Customer views a service request, THE Service_Request_Module SHALL display the current status as one of the following values: pending, approved, rejected, assigned, in-progress, or completed
3. WHEN a Customer accesses their service request list and no requests exist for that Customer, THE Service_Request_Module SHALL display an empty state message indicating that no service requests have been submitted
4. IF the service request list fails to load due to a retrieval error, THEN THE Service_Request_Module SHALL display an error message indicating that requests could not be loaded and allow the Customer to retry

---

### Requirement 13: Technician Assignment

**User Story:** As an Admin, I want to assign technicians to approved service requests, so that field work can be scheduled.

#### Acceptance Criteria

1. WHEN an Admin selects an approved service request and assigns a technician with a scheduled date, THE Scheduling_Module SHALL create a Task record in TECHNICIAN_SCHEDULE with "assigned" status, the selected priority (default: medium), and the specified scheduled date, and SHALL update the service request status to "assigned"
2. THE Scheduling_Module SHALL only allow assignment to service requests with "approved" status and to technicians with availability_status of "available"
3. WHEN an Admin initiates a technician assignment, THE Scheduling_Module SHALL display each technician's availability_status and the count of active tasks (status not "completed" or "rejected") scheduled on the selected date
4. IF the selected technician already has an active task (status not "completed" or "rejected") on the same scheduled date, THEN THE Scheduling_Module SHALL reject the assignment and display an error message indicating a scheduling conflict
5. WHEN an Admin assigns a task, THE Scheduling_Module SHALL allow the Admin to select a priority value of low, medium, or high, defaulting to medium if not specified
6. IF the Admin selects a scheduled date in the past, THEN THE Scheduling_Module SHALL reject the assignment and display an error message indicating the date must be today or a future date

---

### Requirement 14: Technician Task Management

**User Story:** As a Technician, I want to view and manage my assigned tasks, so that I can plan my work and update progress.

#### Acceptance Criteria

1. WHEN a Technician accesses their dashboard, THE Scheduling_Module SHALL display all tasks assigned to that Technician, showing for each task: service type, customer name, scheduled date, current status, and address, sorted by scheduled date in ascending order
2. WHEN a Technician accepts an assigned task, THE Scheduling_Module SHALL update the task status from "assigned" to "accepted" and display a confirmation message indicating the task was accepted
3. WHEN a Technician rejects an assigned task, THE Scheduling_Module SHALL require the Technician to provide a rejection reason of at least 10 characters, update the task status to "rejected", and set the associated service request status back to "approved" so the Admin can reassign it
4. WHEN a Technician marks an accepted task as in-progress, THE Scheduling_Module SHALL update the task status to "in-progress"
5. WHEN a Technician marks an in-progress task as completed and submits a completion report containing at least 20 characters of report text, THE Scheduling_Module SHALL update the task status to "completed" and store the report
6. IF a Technician attempts to update a task status that does not follow the allowed progression (assigned → accepted → in-progress → completed), THEN THE Scheduling_Module SHALL reject the update and display an error message indicating the current status and the allowed next status
7. IF a Technician submits a completion report with fewer than 20 characters, THEN THE Scheduling_Module SHALL reject the submission and display an error message indicating the minimum report length requirement

---

### Requirement 15: Product Management

**User Story:** As an Admin, I want to manage the air conditioning product catalog, so that recommendations reference accurate and current products.

#### Acceptance Criteria

1. WHEN an Admin creates a new product record with all required fields (brand, model, type, horsepower, btu_capacity, price) and optional fields (description, image), THE Product_Module SHALL validate that brand and model are non-empty strings of at most 100 characters, type is one of "split-type", "window-type", or "floor-standing", horsepower is a numeric value between 0.5 and 10, btu_capacity is an integer between 5000 and 60000, price is a numeric value between 0.01 and 999999.99, and save the product to the AIRCON_PRODUCTS table with is_active set to true
2. IF any required field is missing or fails validation during product creation or update, THEN THE Product_Module SHALL reject the operation and return an error message indicating which fields failed validation, without modifying the AIRCON_PRODUCTS table
3. WHEN an Admin updates an existing product record, THE Product_Module SHALL apply the same validation rules as creation and save the changes to the AIRCON_PRODUCTS table
4. WHEN an Admin deletes a product record, THE Product_Module SHALL set the product's is_active flag to false rather than removing the record, preserving referential integrity with existing AI recommendations
5. THE Product_Module SHALL restrict all product create, update, and delete operations to Admin users only
6. IF a non-Admin user attempts a product create, update, or delete operation, THEN THE Product_Module SHALL reject the request and return an authorization error without modifying data

---

### Requirement 16: Service and Pricing Management

**User Story:** As an Admin, I want to manage service types and their pricing, so that customers see accurate service information.

#### Acceptance Criteria

1. WHEN an Admin submits a new or updated service type, THE Product_Module SHALL validate that a service name (1 to 100 characters), a description (1 to 500 characters), and a price (0.01 to 999,999.99) are provided before saving the service record
2. IF an Admin submits a service type with a missing or invalid field (empty name, description exceeding 500 characters, or price outside the range of 0.01 to 999,999.99), THEN THE Product_Module SHALL reject the submission and display an error message indicating which field failed validation
3. THE Product_Module SHALL restrict service and pricing management operations to Admin users only
4. IF a non-Admin user attempts to access service and pricing management operations, THEN THE Product_Module SHALL deny the request and return an authorization error indicating insufficient permissions
5. WHEN a service type is successfully created or updated, THE Product_Module SHALL display the updated service information (name, description, and price) on the public services page

---

### Requirement 17: BTU Factor Management

**User Story:** As an Admin, I want to manage BTU calculation factors, so that recommendations use accurate parameters for different room conditions.

#### Acceptance Criteria

1. WHEN an Admin creates a new BTU factor providing a factor name (maximum 100 characters, unique across all BTU factors), a factor value (numeric multiplier between 0.01 and 100.00), and an optional description (maximum 500 characters), THE Product_Module SHALL validate the inputs and save the factor to the BTU_FACTORS table with the Admin's user ID recorded
2. WHEN an Admin updates an existing BTU factor, THE Product_Module SHALL validate the modified fields using the same constraints as creation and save the changes to the BTU_FACTORS table
3. IF validation fails during BTU factor creation or update (duplicate factor name, factor value out of range, or factor name exceeds maximum length), THEN THE Product_Module SHALL reject the operation, preserve any previously saved data unchanged, and display an error message indicating the specific validation failure
4. WHEN an Admin deletes a BTU factor, THE Product_Module SHALL remove the factor from the BTU_FACTORS table
5. THE Product_Module SHALL restrict BTU factor management operations (create, update, delete) to Admin users only
6. WHEN the AI_Engine performs a BTU calculation, THE AI_Engine SHALL retrieve and use the current BTU factor values from the BTU_FACTORS table at the time of calculation

---

### Requirement 18: Administrative Reporting

**User Story:** As an Admin, I want to generate reports, so that I can monitor business operations and make informed decisions.

#### Acceptance Criteria

1. WHEN an Admin requests a service summary report with a specified date range, THE Report_Module SHALL aggregate service request data within that date range and generate a report containing: report type, total number of requests per service type (installation, maintenance, repair), count of requests per status (pending, approved, rejected, in-progress, completed), and generated date
2. WHEN an Admin requests a technician performance report with a specified date range, THE Report_Module SHALL aggregate technician assignment and completion data within that date range and generate a report containing: report type, number of tasks assigned per technician, number of tasks completed, number of tasks rejected, and generated date
3. WHEN an Admin requests an AI recommendation report with a specified date range, THE Report_Module SHALL aggregate AI recommendation data within that date range and generate a report containing: report type, total number of recommendations generated, breakdown of recommended unit types, and generated date
4. THE Report_Module SHALL allow Admin to export a generated report in CSV or PDF format
5. THE Report_Module SHALL restrict all report generation and viewing operations to Admin users only
6. IF no data exists for the specified date range when generating a report, THEN THE Report_Module SHALL generate the report with zero counts and display a message indicating no records were found for the selected period
7. IF a non-Admin user attempts to access report generation or viewing, THEN THE Report_Module SHALL deny access and display an error message indicating insufficient permissions

---

### Requirement 19: Account Management

**User Story:** As an Admin, I want to manage user accounts, so that I can maintain the system's user base.

#### Acceptance Criteria

1. WHEN an Admin views customer accounts, THE System SHALL display a paginated list (maximum 20 records per page) of all customer records showing name, email, account status (active/inactive), and account creation date
2. WHEN an Admin deactivates a customer account, THE System SHALL set the account's is_active flag to false and prevent that customer from logging in on subsequent login attempts
3. WHEN an Admin submits a technician creation form with name, email, password, specialization (maximum 100 characters), and contact number (maximum 15 digits), THE System SHALL create the user record with role "technician" and an associated TECHNICIAN_DETAILS record with availability_status defaulting to "available"
4. IF the email provided during technician account creation already exists in the system, THEN THE System SHALL reject the creation and display an error message indicating the email is already in use
5. WHEN an Admin updates technician details (specialization, contact number, availability status), THE System SHALL validate that specialization is not empty (maximum 100 characters), contact number is not empty (maximum 15 digits), and availability status is one of "available", "busy", or "unavailable", and save the changes
6. WHEN an Admin deactivates a technician account, THE System SHALL set the account's is_active flag to false, prevent that technician from logging in on subsequent attempts, and set the technician's availability_status to "unavailable"

---

### Requirement 20: System Security and Data Protection

**User Story:** As the system owner, I want the system to protect user data and enforce security measures, so that the platform remains trustworthy and compliant.

#### Acceptance Criteria

1. THE System SHALL validate and sanitize all request body, query parameter, and URL parameter inputs on every API endpoint using express-validator before processing the request
2. IF a request fails input validation, THEN THE System SHALL reject the request with an error response indicating which fields failed validation and the reason, without processing the request further
3. THE System SHALL configure CORS to allow requests only from the frontend application origin defined in environment variables, and reject requests from all other origins
4. THE System SHALL store all secrets, API keys, and database credentials in environment variables and SHALL NOT include them in source code or client-accessible responses
5. THE System SHALL enforce rate limiting on all public-facing endpoints, allowing a maximum of 100 requests per 15-minute window per IP address
6. IF a client exceeds the rate limit, THEN THE System SHALL reject subsequent requests with an error response indicating the rate limit has been exceeded and the time remaining until the limit resets
7. THE System SHALL restrict access to customer PII fields (email, name, contact number) to the owning customer and Admin role only, and SHALL NOT expose these fields in API responses to unauthorized roles
8. THE System SHALL transmit all data between client and server over HTTPS only

---

### Requirement 21: System Responsiveness and Accessibility

**User Story:** As a user, I want the system to be responsive and accessible across devices, so that I can use it on any modern web browser.

#### Acceptance Criteria

1. THE System SHALL render all pages in a single-column layout with full-width components on viewports below 640px (mobile), a two-column layout on viewports between 640px and 1023px (tablet), and a multi-column layout with a visible sidebar on viewports 1024px and above (desktop)
2. THE System SHALL function correctly on the latest two major versions of Chrome, Firefox, Safari, and Edge, with all interactive elements operable and content fully rendered
3. THE System SHALL conform to WCAG 2.1 Level AA guidelines, including keyboard navigability, sufficient color contrast (minimum 4.5:1 for normal text), and appropriate ARIA labels on interactive elements
4. IF the internet connection is lost during a user operation, THEN THE System SHALL display a notification indicating that the connection is unavailable within 5 seconds and SHALL prevent submission of new data until connectivity is restored
5. THE System SHALL ensure that all interactive elements (buttons, links, form inputs) have a minimum touch target size of 44x44 pixels on viewports below 1024px
