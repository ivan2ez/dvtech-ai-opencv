# DVTech AI-Powered Web-Based System — Application Requirements Document

## Project Overview

**Full Title:** AI-Powered Web-Based Air Conditioning Recommendation, Service Request Management, and Technician Scheduling System for DVTech

**Purpose:** Design, develop, and deploy a unified web-based platform that improves accuracy in AC unit recommendation, streamlines technician scheduling, enhances customer experience, and provides management reports for DVTech — a local air conditioning service provider with ~30 technicians handling installation, maintenance, and repair services.

---

## 1. System Actors / User Roles

| Role | Description |
|------|-------------|
| **Customer** | End-user who browses services, submits service requests, receives AI recommendations, and interacts with the chatbot. |
| **Admin** | DVTech management who approves reservations, assigns technicians, manages products/pricing/BTU factors, oversees accounts, and generates reports. |
| **Technician** | Field personnel who views assigned tasks, accepts/rejects assignments, updates service status, and submits completion reports. |
| **Guest** | Unauthenticated visitor who can browse the website, view services, and pricing — but cannot book or interact with AI features. |

---

## 2. Functional Requirements

### 2.1 Authentication & Authorization Module

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | The system shall allow users to register as Customer. |
| FR-AUTH-02 | The system shall allow users to log in with secure credentials (email/password). |
| FR-AUTH-03 | The system shall enforce role-based access control (Admin, Technician, Customer). |
| FR-AUTH-04 | The system shall redirect users to their role-specific dashboard after login. |
| FR-AUTH-05 | The system shall allow users to update their profile information. |

### 2.2 AI Recommendation Module

| ID | Requirement |
|----|-------------|
| FR-AI-01 | The system shall accept room information (size/area, ceiling height, occupancy, sunlight level/exposure). |
| FR-AI-02 | The system shall accept room images for AI-based image analysis. |
| FR-AI-03 | The system shall perform image analysis using AI (OpenAI API + OpenCV) to assess room layout and environmental factors. |
| FR-AI-04 | The system shall calculate total BTU requirements based on room parameters and BTU factors. |
| FR-AI-05 | The system shall recommend appropriate AC unit type (split-type, window-type, floor-standing), horsepower, and specific product from the AIRCON_PRODUCTS catalog. |
| FR-AI-06 | The system shall provide simple troubleshooting suggestions based on image analysis for minor/common AC issues. |
| FR-AI-07 | The system shall display recommended units with their specifications to the customer. |

### 2.3 Chatbot Module

| ID | Requirement |
|----|-------------|
| FR-CHAT-01 | The system shall provide a conversational chatbot interface for customers. |
| FR-CHAT-02 | The chatbot shall collect room details and service request information interactively. |
| FR-CHAT-03 | The chatbot shall provide real-time automated responses. |
| FR-CHAT-04 | The chatbot shall guide users through the service request and recommendation process. |
| FR-CHAT-05 | The chatbot shall offer quick support/FAQ for common questions. |

### 2.4 Service Request Module

| ID | Requirement |
|----|-------------|
| FR-SR-01 | Customers shall be able to browse available services and pricing. |
| FR-SR-02 | Customers shall be able to select a service type (installation, maintenance, repair/consultation). |
| FR-SR-03 | Customers shall be able to enter air conditioner details for the service request. |
| FR-SR-04 | Customers shall be able to submit a service request (reservation/booking). |
| FR-SR-05 | The system shall validate and save service requests with a **pending** status. |
| FR-SR-06 | Admin shall be able to view all submitted service requests. |
| FR-SR-07 | Admin shall be able to approve or reject service requests/reservations. |
| FR-SR-08 | Customers shall be able to view the status of their service requests. |

### 2.5 Technician Scheduling Module

| ID | Requirement |
|----|-------------|
| FR-TS-01 | Admin shall be able to assign technicians to approved service requests. |
| FR-TS-02 | The system shall consider technician availability and workload for scheduling. |
| FR-TS-03 | The system shall allow priority-based task assignment. |
| FR-TS-04 | Technicians shall be able to view their assigned tasks. |
| FR-TS-05 | Technicians shall be able to accept or reject assigned tasks. |
| FR-TS-06 | Rejected tasks shall be returned to the Admin for reassignment. |
| FR-TS-07 | Technicians shall be able to update task status (e.g., in-progress, completed). |
| FR-TS-08 | Technicians shall submit a report upon task completion. |
| FR-TS-09 | The system shall prevent scheduling conflicts. |

### 2.6 Product Management Module

| ID | Requirement |
|----|-------------|
| FR-PM-01 | Admin shall be able to add, edit, and delete air conditioning product records. |
| FR-PM-02 | Product records shall include specifications (type, horsepower, BTU capacity, brand, model, price). |
| FR-PM-03 | Admin shall be able to manage service types and pricing. |
| FR-PM-04 | Admin shall be able to manage BTU factor categories/parameters. |

### 2.7 Reporting Module

| ID | Requirement |
|----|-------------|
| FR-RPT-01 | The system shall generate reports summarizing service requests. |
| FR-RPT-02 | The system shall generate reports on technician assignments and performance. |
| FR-RPT-03 | The system shall generate reports on AI-generated recommendations. |
| FR-RPT-04 | Reports shall include report type, summarized results, and generated date. |
| FR-RPT-05 | Admin shall be able to view and export reports for monitoring and decision-making. |

### 2.8 Account Management Module

| ID | Requirement |
|----|-------------|
| FR-AM-01 | Admin shall be able to manage customer accounts (view, deactivate). |
| FR-AM-02 | Admin shall be able to manage technician accounts (create, view, update, deactivate). |
| FR-AM-03 | Admin shall be able to manage technician details (specialization, contact, etc.). |

---

## 3. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Connectivity | The system requires a stable internet connection for all operations. |
| NFR-02 | Security | The system shall implement secure user authentication (hashed passwords, session tokens). |
| NFR-03 | Performance | The system shall maintain acceptable response time during AI image processing and recommendation generation. |
| NFR-04 | Reliability | The system shall operate consistently without critical failures during operational hours. |
| NFR-05 | Usability | The system shall provide a user-friendly, responsive interface for all user roles. |
| NFR-06 | Data Integrity | The system shall maintain accuracy and integrity of stored data. |
| NFR-07 | Scalability | The system shall support multiple concurrent users and service requests. |
| NFR-08 | Availability | The system shall be available during DVTech's operational hours. |
| NFR-09 | Privacy | The system shall ensure data privacy and protection for customer information. |
| NFR-10 | Portability | The system shall be accessible across devices via modern web browsers. |

---

## 4. System Architecture

### 4.1 High-Level Architecture (Based on Context Diagram — Figure 2)

```
┌─────────────┐         ┌──────────────────────────────────────┐         ┌─────────────┐
│  CUSTOMER   │◄───────►│                                      │◄───────►│    ADMIN    │
│             │         │   DVTech AI-Powered Web System        │         │             │
│ - Login     │         │                                      │         │ - Login     │
│ - Room Info │         │  ┌──────────┐  ┌─────────────────┐   │         │ - Approve   │
│ - Images    │         │  │ AI Rec.  │  │ Service Request │   │         │ - Schedule  │
│ - Service   │         │  │ Module   │  │    Module       │   │         │ - Manage    │
│   Request   │         │  └──────────┘  └─────────────────┘   │         │ - Reports   │
└─────────────┘         │  ┌──────────┐  ┌─────────────────┐   │         └─────────────┘
                        │  │ Chatbot  │  │   Scheduling    │   │
                        │  │ Module   │  │    Module       │   │
                        │  └──────────┘  └─────────────────┘   │
┌─────────────┐         │  ┌──────────┐  ┌─────────────────┐   │
│ TECHNICIAN  │◄───────►│  │ Reports  │  │  Product Mgmt   │   │
│             │         │  │ Module   │  │    Module       │   │
│ - Login     │         │  └──────────┘  └─────────────────┘   │
│ - View Tasks│         │                                      │
│ - Accept/   │         └──────────────────────────────────────┘
│   Reject    │
│ - Update    │
│   Status    │
└─────────────┘
```

### 4.2 Technical Architecture (Three-Tier)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                            │
│              (React.js + shadcn/ui + Tailwind CSS)                    │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────────┐ │
│  │ Customer  │ │   Admin   │ │Technician │ │   Chatbot Interface  │ │
│  │   Views   │ │ Dashboard │ │ Dashboard │ │                      │ │
│  └───────────┘ └───────────┘ └───────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                              │ REST API │
┌──────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                             │
│              (Node.js + Express.js Backend)                          │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ Auth        │ │ Service Req  │ │ Scheduling   │ │ Reporting   │ │
│  │ Controller  │ │ Controller   │ │ Controller   │ │ Controller  │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│  │ AI/Rec.     │ │ Product      │ │ Chatbot      │                 │
│  │ Controller  │ │ Controller   │ │ Controller   │                 │
│  └─────────────┘ └──────────────┘ └──────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
                              │        │
              ┌───────────────┘        └────────────────┐
              ▼                                         ▼
┌─────────────────────────┐              ┌─────────────────────────────┐
│   AI PROCESSING LAYER   │              │       DATA LAYER            │
│   (Python + OpenCV)     │              │       (MySQL)               │
│                         │              │                             │
│ - Image Analysis        │              │ - Users                     │
│ - Room Assessment       │              │ - Service Requests          │
│ - OpenAI API Integration│              │ - Room Assessments          │
│                         │              │ - AI Recommendations        │
└─────────────────────────┘              │ - Aircon Products           │
                                         │ - Technician Schedule       │
                                         │ - Technician Details        │
                                         │ - BTU Factors               │
                                         │ - Reports                   │
                                         └─────────────────────────────┘
```

---

## 5. Data Flow (Based on DFD Level 1 — Figure 3)

### Primary Data Flows:

1. **Login Process** → User submits credentials → System validates against USERS store → Returns auth result
2. **Service Request** → Customer submits service details → Validated & stored in SERVICE_REQUESTS → Notification to Admin
3. **AI Recommendation** → Room data + Image submitted → Processed by AI engine → BTU calculation using BTU_FACTORS → Product matched from AIRCON_PRODUCTS → Stored in AI_RECOMMENDATIONS → Displayed to customer
4. **Scheduling** → Admin assigns technician → References TECHNICIAN_DETAILS + availability → Creates entry in TECHNICIAN_SCHEDULE
5. **Reporting** → Admin requests report → System aggregates data from SERVICE_REQUESTS, TECHNICIAN_SCHEDULE, AI_RECOMMENDATIONS → Generates report in REPORTS store

---

## 6. Use Case Summary (Based on Use Case Diagram — Figure 4)

### Customer Use Cases
- Register / Login
- Update Profile
- Browse Services & Pricing (also as Guest)
- Access Website Information (also as Guest)
- Submit Service Request (select service, enter AC details, book)
- Interact with Chatbot (input room details, receive guidance)
- Receive AI Recommendation (upload image, input room data)
- View Service Request Status

### Admin Use Cases
- Login
- Approve/Reject Service Requests (reservations)
- Assign Technicians to Service Requests
- Manage Technician Accounts
- Manage Customer Accounts
- Manage Products (AC units, specifications, pricing)
- Manage Services & Pricing
- Manage BTU Categories/Factors
- Generate & View Reports

### Technician Use Cases
- Login
- View Assigned Tasks
- Accept or Reject Assignments
- Update Task Status (in-progress, completed)
- Submit Completion Report

---

## 7. Flowchart Summary (Based on Figures 6.1 & 6.2)

### Overall System Workflow:

```
[User Access Website]
        │
        ├── Guest: Browse services, view pricing
        │
        └── [Login / Register]
                │
                ├── Role: CUSTOMER
                │       │
                │       ├── Update Profile
                │       ├── Browse Services
                │       ├── Select Service
                │       ├── Enter AC Details
                │       ├── Submit Reservation (Booking)
                │       │       │
                │       │       └── System validates → Saved as PENDING
                │       │
                │       └── AI Recommendation Flow
                │               ├── Input room data / Upload image
                │               ├── Chatbot collects additional info
                │               └── System returns recommendation
                │
                ├── Role: TECHNICIAN
                │       │
                │       ├── View Assigned Tasks
                │       ├── Accept Task → Status: IN PROGRESS
                │       │       │
                │       │       └── Complete Task → Status: COMPLETED
                │       │               │
                │       │               └── Submit Report
                │       │
                │       └── Reject Task → Returned to Admin
                │
                └── Role: ADMIN
                        │
                        ├── Manage Services / Pricing
                        ├── Manage BTU Categories
                        ├── Manage AC Products
                        ├── Approve Reservations → Assign Technician
                        ├── Handle Rejected Tasks (Reassign)
                        ├── Manage Customer & Technician Accounts
                        └── Generate Reports
```

---

## 8. Database Design (Based on ERD — Figure 5)

### 8.1 Entity Relationship Summary

```
USERS (1) ─────────────────── (N) SERVICE_REQUESTS
  │                                      │
  │ (1:1)                                │ (1:1)
  ▼                                      ▼
TECHNICIAN_DETAILS                 ROOM_ASSESSMENTS
                                         │
                                         │ (1:1)
                                         ▼
                                   AI_RECOMMENDATIONS ──── (N:1) ──── AIRCON_PRODUCTS
                                         
USERS (1) ──── (N) BTU_FACTORS

SERVICE_REQUESTS (1) ──── (N) REPORTS

TECHNICIAN_SCHEDULE references both USERS (technician) and SERVICE_REQUESTS
```

### 8.2 Table Definitions

#### USERS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| name | VARCHAR | Full name |
| email | VARCHAR | Unique email |
| password | VARCHAR | Hashed password |
| role | ENUM | 'admin', 'technician', 'customer' |
| created_at | TIMESTAMP | Account creation date |
| updated_at | TIMESTAMP | Last update |

#### SERVICE_REQUESTS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| user_id | INT (FK → USERS) | Customer who submitted |
| service_type | VARCHAR | Installation, maintenance, repair |
| ac_details | TEXT | Air conditioner details |
| status | ENUM | 'pending', 'approved', 'rejected', 'in-progress', 'completed' |
| created_at | TIMESTAMP | Request submission date |
| updated_at | TIMESTAMP | Last status update |

#### ROOM_ASSESSMENTS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| service_request_id | INT (FK → SERVICE_REQUESTS) | Linked service request |
| area | FLOAT | Room area (sq. meters) |
| ceiling_height | FLOAT | Ceiling height (meters) |
| occupancy | INT | Number of occupants |
| sunlight_level | VARCHAR | Sunlight exposure level |
| image_path | VARCHAR | Path to uploaded room image |
| created_at | TIMESTAMP | Assessment date |

#### AI_RECOMMENDATIONS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| room_assessment_id | INT (FK → ROOM_ASSESSMENTS) | Linked room assessment |
| total_btu | FLOAT | Calculated BTU requirement |
| recommended_hp | FLOAT | Recommended horsepower |
| unit_type | VARCHAR | split-type, window-type, floor-standing |
| product_id | INT (FK → AIRCON_PRODUCTS) | Recommended product |
| troubleshooting_notes | TEXT | AI-generated troubleshooting suggestions |
| created_at | TIMESTAMP | Recommendation date |

#### AIRCON_PRODUCTS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| brand | VARCHAR | Product brand |
| model | VARCHAR | Product model |
| type | VARCHAR | split-type, window-type, floor-standing |
| horsepower | FLOAT | HP rating |
| btu_capacity | INT | BTU capacity |
| price | DECIMAL | Product price |
| description | TEXT | Product description |
| image_url | VARCHAR | Product image |
| created_at | TIMESTAMP | Record creation date |

#### TECHNICIAN_DETAILS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| user_id | INT (FK → USERS, UNIQUE) | 1-to-1 with USERS |
| specialization | VARCHAR | Area of expertise |
| contact_number | VARCHAR | Phone number |
| availability_status | ENUM | 'available', 'busy', 'unavailable' |

#### TECHNICIAN_SCHEDULE
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| technician_id | INT (FK → USERS) | Assigned technician |
| service_request_id | INT (FK → SERVICE_REQUESTS) | Associated request |
| scheduled_date | DATE | Date of assignment |
| status | ENUM | 'assigned', 'accepted', 'rejected', 'in-progress', 'completed' |
| report | TEXT | Technician's completion report |
| created_at | TIMESTAMP | Schedule creation date |

#### BTU_FACTORS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| user_id | INT (FK → USERS) | Admin who manages this entry |
| factor_name | VARCHAR | Factor category name |
| factor_value | FLOAT | Numeric value for BTU calculation |
| description | TEXT | Description of the factor |

#### REPORTS
| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Primary key |
| service_request_id | INT (FK → SERVICE_REQUESTS) | Related service request |
| report_type | VARCHAR | Type of report |
| summary | TEXT | Summarized results |
| generated_date | TIMESTAMP | Report generation date |

### 8.3 Key Relationships

| Relationship | Cardinality | Description |
|--------------|-------------|-------------|
| USERS → SERVICE_REQUESTS | 1:N | One customer can submit multiple service requests |
| SERVICE_REQUESTS → ROOM_ASSESSMENTS | 1:1 | Each service request has one room assessment |
| ROOM_ASSESSMENTS → AI_RECOMMENDATIONS | 1:1 | Each assessment generates one recommendation |
| AI_RECOMMENDATIONS → AIRCON_PRODUCTS | N:1 | Multiple recommendations can reference same product |
| USERS → TECHNICIAN_DETAILS | 1:1 | Each technician has one detail record |
| USERS → BTU_FACTORS | 1:N | Admin manages multiple BTU factors |
| SERVICE_REQUESTS → REPORTS | 1:N | One request can have multiple reports |
| TECHNICIAN_SCHEDULE → USERS | N:1 | A technician can have multiple schedule entries |
| TECHNICIAN_SCHEDULE → SERVICE_REQUESTS | N:1 | A request can have schedule history |

---

## 9. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React.js (TypeScript) + shadcn/ui + Tailwind CSS | Dynamic, responsive UI with role-based views using shadcn/ui component library |
| **Backend** | Node.js + Express.js (TypeScript) | REST API, server-side logic, routing, type-safe development |
| **AI/Image Processing** | Python + OpenCV | Room image analysis, computer vision tasks |
| **AI Intelligence** | OpenAI API | Intelligent recommendations, chatbot NLP, troubleshooting |
| **Database** | MySQL | Relational data storage (structured, referential integrity) |
| **ORM** | Sequelize (with sequelize-typescript) | Database queries, migrations, model definitions |
| **IDE** | Visual Studio Code | Development environment |
| **UI Testing** | Playwright | Automated browser/UI testing (end-to-end) |
| **API Testing** | Postman | Backend endpoint testing |
| **Unit Testing** | Jest (with ts-jest) | TypeScript unit testing |

---

## 10. OpenAI API Recommendations

### 10.1 Recommended Model & Endpoints

| Feature | Recommended API/Model | Reason |
|---------|----------------------|--------|
| **Room Image Analysis** | `gpt-4o` (Vision) | Supports image input natively. Can analyze room photos to identify size estimates, sunlight exposure, window count, insulation quality, and heat sources — all relevant for BTU calculation. |
| **Chatbot Conversations** | `gpt-4o-mini` | Cost-effective for conversational interactions. Fast response time suitable for real-time chat. Sufficient intelligence for guided data collection. |
| **AC Recommendation Logic** | `gpt-4o` | Capable of structured output (JSON mode). Can take room assessment data + BTU factors and return a structured recommendation with reasoning. |
| **Troubleshooting Suggestions** | `gpt-4o-mini` | Quick diagnosis of common AC issues from image or text description. Lower cost per request for simpler analysis tasks. |

### 10.2 Recommended API Usage Pattern

```
┌─────────────────────────────────────────────────────────┐
│                  OPENAI API INTEGRATION                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. IMAGE ANALYSIS (gpt-4o with vision)                 │
│     Input: Room photo (base64 or URL)                   │
│     Prompt: System prompt with room assessment criteria  │
│     Output: Structured JSON with room characteristics   │
│             (estimated area, windows, sunlight,          │
│              heat sources, insulation quality)           │
│                                                         │
│  2. BTU CALCULATION + RECOMMENDATION (gpt-4o)           │
│     Input: Room assessment data + BTU factors from DB   │
│            + Available products from AIRCON_PRODUCTS     │
│     Prompt: System prompt with BTU formula + product    │
│             matching criteria                           │
│     Output: JSON with total_btu, recommended_hp,        │
│             unit_type, matched product_id, reasoning    │
│                                                         │
│  3. CHATBOT (gpt-4o-mini)                               │
│     Input: Conversation history + system context        │
│     Prompt: Guided conversation to collect room data    │
│     Output: Natural language response + extracted data  │
│                                                         │
│  4. TROUBLESHOOTING (gpt-4o-mini)                       │
│     Input: Image or text description of AC issue        │
│     Prompt: Common AC problems knowledge base           │
│     Output: Diagnosis + suggested fix steps             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 10.3 Implementation Recommendations

| Concern | Recommendation |
|---------|---------------|
| **SDK** | Use the official `openai` npm package (TypeScript-compatible) in the Node.js backend |
| **Structured Output** | Use JSON mode (`response_format: { type: "json_object" }`) for recommendation and image analysis to get parseable results |
| **System Prompts** | Store system prompts as configurable templates (in DB or config files) so Admin can tune behavior without code changes |
| **Rate Limiting** | Implement request queuing on the backend to avoid API rate limits during peak usage |
| **Cost Control** | Use `gpt-4o-mini` for chatbot and troubleshooting (cheaper), reserve `gpt-4o` for image analysis and final recommendations |
| **Error Handling** | Implement retry logic with exponential backoff for API failures; show user-friendly fallback messages |
| **Token Management** | Set `max_tokens` limits per feature to control costs (e.g., chatbot: 500 tokens, recommendation: 1000 tokens) |
| **Image Handling** | Compress/resize images on the backend before sending to OpenAI to reduce latency and cost (use `detail: "low"` for initial analysis, `detail: "high"` only if needed) |
| **Conversation Memory** | Store chat history per session in the database; send last N messages as context to maintain conversation continuity |
| **Prompt Engineering** | Include BTU factors and product catalog as context in the recommendation prompt so the AI can match directly to real products |

### 10.4 Cost Estimate (Per Request)

| Feature | Model | Est. Tokens (Input + Output) | Est. Cost |
|---------|-------|------------------------------|-----------|
| Image Analysis | gpt-4o (vision) | ~1,500 tokens | ~$0.01–0.03 |
| Recommendation | gpt-4o | ~2,000 tokens | ~$0.01–0.02 |
| Chatbot (per message) | gpt-4o-mini | ~500 tokens | ~$0.0005 |
| Troubleshooting | gpt-4o-mini | ~800 tokens | ~$0.001 |

> Note: Costs are approximate and based on current OpenAI pricing. Actual costs depend on prompt length, image resolution, and response size.

---

## 11. API Integration Points

| Integration | Technology | Usage |
|-------------|-----------|-------|
| OpenAI API (gpt-4o) | REST API via `openai` npm SDK | Room image analysis (vision), AC recommendation with structured JSON output |
| OpenAI API (gpt-4o-mini) | REST API via `openai` npm SDK | Chatbot conversations, troubleshooting suggestions |
| Python OpenCV Service | Internal microservice (FastAPI) or child process | Image preprocessing (resize, enhance) before sending to OpenAI |
| MySQL Database | Sequelize ORM (sequelize-typescript) | All CRUD operations with model-based queries |

---

## 12. Key Business Rules

1. **Service requests start as "pending"** — Admin must approve before technician assignment.
2. **Technician assignment requires approval first** — Only approved requests can be scheduled.
3. **Technicians can reject tasks** — Rejected tasks return to Admin for reassignment.
4. **Task status progression:** pending → approved → assigned → accepted → in-progress → completed.
5. **AI recommendation requires room data** — At minimum: area, ceiling height, occupancy, sunlight level.
6. **BTU calculation** uses configurable factors managed by Admin in the BTU_FACTORS table.
7. **No integrated payment system** — Payments handled externally/manually.
8. **Guest users can browse** — But cannot submit requests or use AI features without authentication.
9. **Reports are admin-only** — Only administrators can generate and view system reports.

---

## 13. Development Methodology

**Agile Software Development** with the following phases:

1. **Planning** — Identify objectives, scope, timeline
2. **Requirement Analysis** — Gather functional/non-functional requirements
3. **System Design** — Architecture diagrams, ERD, DFD, flowcharts
4. **Development** — Iterative coding of modules
5. **Testing** — Selenium (UI), Postman (API), Jest (Unit)
6. **Deployment** — Production setup, database connection, user orientation
7. **Evaluation** — ISO/IEC 25010 (IT experts) + TAM (end-user acceptance)

---

## 14. Constraints & Limitations

| Constraint | Impact |
|-----------|--------|
| Internet required | System non-functional offline |
| Accuracy depends on user input | Room data quality directly affects recommendation quality |
| DVTech-specific | Not portable to other organizations without customization |
| No payment integration | Service payments processed externally |
| AI processing time | Image analysis may introduce latency |

---

## 15. Module Priority & Dependencies

```
Login Module ──────────► (Required by all other modules)
        │
        ├── AI Recommendation Module ─── depends on ─── Product Management Module
        │       │
        │       └── Chatbot Module (feeds into AI Recommendation)
        │
        ├── Service Request Module ─── depends on ─── AI Recommendation Module
        │       │
        │       └── Technician Scheduling Module ─── depends on ─── Service Request
        │
        ├── Product Management Module (Admin-only, standalone data entry)
        │
        └── Reporting Module ─── depends on ─── Service Request + Scheduling
```

---

## 16. Evaluation Criteria

### ISO/IEC 25010 (Evaluated by 3 IT Experts)
- Functional Suitability
- Usability
- Performance Efficiency
- Compatibility
- Reliability
- Maintainability
- Security
- Portability

### Technology Acceptance Model — TAM (Evaluated by 27 Respondents)
- **Perceived Usefulness (PU)** — Does the system help users accomplish tasks?
- **Perceived Ease of Use (PEOU)** — Is the system easy to operate?
- **Attitude Towards Using (ATU)** — Are users willing to adopt and continue using the system?

**Likert Scale Interpretation:**
| Range | Interpretation |
|-------|---------------|
| 4.51 – 5.00 | Highly Acceptable |
| 3.51 – 4.50 | Acceptable |
| 2.51 – 3.50 | Moderately Acceptable |
| 1.51 – 2.50 | Slightly Acceptable |
| 1.00 – 1.50 | Not Acceptable |

---

*Document generated from thesis-documents.docx analysis. All requirements, flows, and architecture are derived directly from the thesis document content including referenced diagrams (Figures 1–6.2).*
