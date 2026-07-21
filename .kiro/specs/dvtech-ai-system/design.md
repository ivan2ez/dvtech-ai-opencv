# Design Document

## Overview

This design document describes the technical implementation plan for the DVTech AI-Powered Web-Based System. The system follows a three-tier architecture with a React.js (TypeScript) frontend using shadcn/ui components, a Node.js/Express.js (TypeScript) REST API backend, a Python/FastAPI AI microservice for image processing, and a MySQL database with Sequelize ORM.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (Frontend)                        │
│              React.js (TypeScript) + shadcn/ui + Tailwind CSS            │
│                                                                         │
│  Customer Views │ Admin Dashboard │ Technician Dashboard │ Chatbot UI   │
└─────────────────────────────────────────────────────────────────────────┘
                              │ REST API (HTTP/JSON) │
┌─────────────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER (Backend)                          │
│              Node.js + Express.js (TypeScript)                           │
│                                                                         │
│  Auth │ Service Request │ Scheduling │ Product │ Report │ AI │ Chatbot  │
└─────────────────────────────────────────────────────────────────────────┘
           │                          │                        │
           ▼                          ▼                        ▼
┌──────────────────┐     ┌──────────────────────┐   ┌─────────────────────┐
│  MySQL Database  │     │  OpenAI API          │   │  Python AI Service  │
│  (Sequelize ORM) │     │  (gpt-4o, gpt-4o-mini)│   │  (FastAPI + OpenCV) │
└──────────────────┘     └──────────────────────┘   └─────────────────────┘
```

### Communication Patterns

- Frontend → Backend: REST API with JWT bearer token authentication
- Backend → MySQL: Sequelize ORM with sequelize-typescript decorators
- Backend → OpenAI API: Official `openai` npm SDK with JSON mode
- Backend → Python AI Service: Internal HTTP calls to FastAPI microservice
- Python AI Service: Image preprocessing (OpenCV) before forwarding to OpenAI

---

## Database Design

### Entity Relationship Diagram

```
USERS (1) ──── (N) SERVICE_REQUESTS (1) ──── (1) ROOM_ASSESSMENTS (1) ──── (1) AI_RECOMMENDATIONS
  │                       │                                                         │
  │ (1:1)                 │ (1:N)                                                   │ (N:1)
  ▼                       ▼                                                         ▼
TECHNICIAN_DETAILS     REPORTS                                              AIRCON_PRODUCTS

USERS (1) ──── (N) BTU_FACTORS
TECHNICIAN_SCHEDULE references USERS (technician) + SERVICE_REQUESTS
```

### Table Schemas

**USERS**
- id: INT (PK, AUTO_INCREMENT)
- name: VARCHAR(255)
- email: VARCHAR(255, UNIQUE)
- password: VARCHAR(255) — bcrypt hashed
- role: ENUM('admin', 'technician', 'customer')
- is_active: BOOLEAN (default: true)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

**SERVICE_REQUESTS**
- id: INT (PK, AUTO_INCREMENT)
- user_id: INT (FK → USERS)
- service_type: VARCHAR(100) — installation, maintenance, repair
- ac_details: TEXT
- status: ENUM('pending', 'approved', 'rejected', 'assigned', 'in-progress', 'completed')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

**ROOM_ASSESSMENTS**
- id: INT (PK, AUTO_INCREMENT)
- service_request_id: INT (FK → SERVICE_REQUESTS, UNIQUE)
- area: FLOAT — square meters
- ceiling_height: FLOAT — meters
- occupancy: INT
- sunlight_level: VARCHAR(50) — low, moderate, high
- image_path: VARCHAR(500) — nullable
- created_at: TIMESTAMP

**AI_RECOMMENDATIONS**
- id: INT (PK, AUTO_INCREMENT)
- room_assessment_id: INT (FK → ROOM_ASSESSMENTS, UNIQUE)
- total_btu: FLOAT
- recommended_hp: FLOAT
- unit_type: VARCHAR(50) — split-type, window-type, floor-standing
- product_id: INT (FK → AIRCON_PRODUCTS)
- troubleshooting_notes: TEXT — nullable
- reasoning: TEXT
- created_at: TIMESTAMP

**AIRCON_PRODUCTS**
- id: INT (PK, AUTO_INCREMENT)
- brand: VARCHAR(100)
- model: VARCHAR(100)
- type: VARCHAR(50) — split-type, window-type, floor-standing
- horsepower: FLOAT
- btu_capacity: INT
- price: DECIMAL(10,2)
- description: TEXT
- image_url: VARCHAR(500)
- is_active: BOOLEAN (default: true)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

**TECHNICIAN_DETAILS**
- id: INT (PK, AUTO_INCREMENT)
- user_id: INT (FK → USERS, UNIQUE)
- specialization: VARCHAR(255)
- contact_number: VARCHAR(50)
- availability_status: ENUM('available', 'busy', 'unavailable')

**TECHNICIAN_SCHEDULE**
- id: INT (PK, AUTO_INCREMENT)
- technician_id: INT (FK → USERS)
- service_request_id: INT (FK → SERVICE_REQUESTS)
- scheduled_date: DATE
- status: ENUM('assigned', 'accepted', 'rejected', 'in-progress', 'completed')
- priority: ENUM('low', 'medium', 'high') — default: medium
- report: TEXT — nullable, filled on completion
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

**BTU_FACTORS**
- id: INT (PK, AUTO_INCREMENT)
- user_id: INT (FK → USERS) — Admin who manages
- factor_name: VARCHAR(100)
- factor_value: FLOAT
- description: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

**REPORTS**
- id: INT (PK, AUTO_INCREMENT)
- service_request_id: INT (FK → SERVICE_REQUESTS) — nullable
- report_type: VARCHAR(100) — service_summary, technician_performance, ai_recommendation
- summary: TEXT
- generated_date: TIMESTAMP
- created_at: TIMESTAMP

---

## API Design

### Authentication Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/auth/register | Register new customer | Public |
| POST | /api/auth/login | Authenticate user | Public |
| GET | /api/auth/profile | Get current user profile | Authenticated |
| PUT | /api/auth/profile | Update profile | Authenticated |

### Service Request Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/services | List all service types with pricing | Public |
| POST | /api/service-requests | Create service request | Customer |
| GET | /api/service-requests | List service requests | Customer (own), Admin (all) |
| GET | /api/service-requests/:id | Get request details | Customer (own), Admin |
| PATCH | /api/service-requests/:id/approve | Approve request | Admin |
| PATCH | /api/service-requests/:id/reject | Reject request | Admin |

### AI Recommendation Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/ai/room-assessment | Submit room data + image | Customer |
| GET | /api/ai/recommendations/:id | Get recommendation result | Customer (own), Admin |
| POST | /api/ai/chatbot | Send chatbot message | Customer |

### Technician Scheduling Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/schedules | Assign technician to request | Admin |
| GET | /api/schedules | List schedules | Admin (all), Technician (own) |
| PATCH | /api/schedules/:id/accept | Accept task | Technician |
| PATCH | /api/schedules/:id/reject | Reject task | Technician |
| PATCH | /api/schedules/:id/status | Update task status | Technician |
| PATCH | /api/schedules/:id/complete | Complete with report | Technician |

### Product Management Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/products | List products | Public |
| POST | /api/products | Create product | Admin |
| PUT | /api/products/:id | Update product | Admin |
| DELETE | /api/products/:id | Delete product | Admin |
| GET | /api/btu-factors | List BTU factors | Admin |
| POST | /api/btu-factors | Create BTU factor | Admin |
| PUT | /api/btu-factors/:id | Update BTU factor | Admin |
| DELETE | /api/btu-factors/:id | Delete BTU factor | Admin |

### Reporting Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/reports/generate | Generate report | Admin |
| GET | /api/reports | List generated reports | Admin |
| GET | /api/reports/:id | Get report details | Admin |
| GET | /api/reports/:id/export | Export report | Admin |

### Account Management Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/admin/customers | List customers | Admin |
| PATCH | /api/admin/customers/:id/deactivate | Deactivate customer | Admin |
| GET | /api/admin/technicians | List technicians | Admin |
| POST | /api/admin/technicians | Create technician | Admin |
| PUT | /api/admin/technicians/:id | Update technician | Admin |
| PATCH | /api/admin/technicians/:id/deactivate | Deactivate technician | Admin |

---

## Component Design

### Backend Module Structure

```
/backend/src
├── config/
│   ├── database.ts          — Sequelize connection configuration
│   ├── environment.ts       — Environment variable management
│   └── openai.ts            — OpenAI client configuration
├── models/
│   ├── User.ts              — User model with role enum
│   ├── ServiceRequest.ts    — Service request with status workflow
│   ├── RoomAssessment.ts    — Room parameters for AI input
│   ├── AiRecommendation.ts  — AI output with product match
│   ├── AirconProduct.ts     — Product catalog model
│   ├── TechnicianDetail.ts  — Technician profile extension
│   ├── TechnicianSchedule.ts— Task assignment and tracking
│   ├── BtuFactor.ts         — Configurable BTU parameters
│   ├── Report.ts            — Generated report records
│   └── index.ts             — Model associations
├── controllers/
│   ├── authController.ts    — Registration, login, profile
│   ├── serviceRequestController.ts — CRUD + approval workflow
│   ├── aiController.ts      — Room assessment, recommendation, chatbot
│   ├── scheduleController.ts— Task assignment and management
│   ├── productController.ts — Product and BTU factor CRUD
│   ├── reportController.ts  — Report generation and export
│   └── adminController.ts   — Account management
├── services/
│   ├── authService.ts       — Authentication business logic
│   ├── serviceRequestService.ts — Request workflow logic
│   ├── aiService.ts         — OpenAI integration, BTU calculation
│   ├── imageService.ts      — Python microservice communication
│   ├── chatbotService.ts    — Chat session management
│   ├── scheduleService.ts   — Scheduling and conflict detection
│   ├── productService.ts    — Product catalog logic
│   └── reportService.ts     — Report aggregation logic
├── middlewares/
│   ├── authMiddleware.ts    — JWT verification
│   ├── roleMiddleware.ts    — Role-based access check
│   ├── validationMiddleware.ts — Input validation (express-validator)
│   ├── rateLimitMiddleware.ts  — Rate limiting
│   └── errorMiddleware.ts   — Global error handler
├── routes/
│   ├── authRoutes.ts
│   ├── serviceRequestRoutes.ts
│   ├── aiRoutes.ts
│   ├── scheduleRoutes.ts
│   ├── productRoutes.ts
│   ├── reportRoutes.ts
│   └── adminRoutes.ts
├── utils/
│   ├── jwt.ts               — Token generation and verification
│   ├── validators.ts        — Validation schemas
│   └── helpers.ts           — Common utility functions
├── types/
│   └── index.ts             — Shared TypeScript interfaces
└── app.ts                   — Express app initialization
```

### Frontend Component Structure

```
/frontend/src
├── components/
│   ├── ui/                  — shadcn/ui auto-generated components
│   ├── layout/
│   │   ├── Navbar.tsx       — Navigation bar with role-aware links
│   │   ├── Sidebar.tsx      — Dashboard sidebar
│   │   └── Footer.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── chatbot/
│   │   ├── ChatWindow.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   └── shared/
│       ├── DataTable.tsx    — Reusable table with sort/filter
│       ├── StatusBadge.tsx  — Status display component
│       └── LoadingSpinner.tsx
├── pages/
│   ├── public/
│   │   ├── HomePage.tsx
│   │   ├── ServicesPage.tsx
│   │   └── ProductsPage.tsx
│   ├── customer/
│   │   ├── CustomerDashboard.tsx
│   │   ├── ServiceRequestForm.tsx
│   │   ├── MyRequests.tsx
│   │   └── AiRecommendation.tsx
│   ├── admin/
│   │   ├── AdminDashboard.tsx
│   │   ├── ManageRequests.tsx
│   │   ├── ManageSchedules.tsx
│   │   ├── ManageProducts.tsx
│   │   ├── ManageBtuFactors.tsx
│   │   ├── ManageAccounts.tsx
│   │   └── Reports.tsx
│   └── technician/
│       ├── TechnicianDashboard.tsx
│       ├── MyTasks.tsx
│       └── TaskDetail.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useServiceRequests.ts
│   ├── useProducts.ts
│   └── useChatbot.ts
├── services/
│   ├── api.ts              — Axios instance with interceptors
│   ├── authApi.ts
│   ├── serviceRequestApi.ts
│   ├── aiApi.ts
│   ├── scheduleApi.ts
│   ├── productApi.ts
│   └── reportApi.ts
├── contexts/
│   ├── AuthContext.tsx      — Authentication state provider
│   └── ThemeContext.tsx
├── types/
│   └── index.ts            — Frontend type definitions
├── utils/
│   └── helpers.ts
├── lib/
│   └── utils.ts            — shadcn/ui cn() helper
└── App.tsx                  — Router setup with role-based routes
```

### Python AI Service Structure

```
/ai-service/app
├── main.py                  — FastAPI application entry
├── routes/
│   ├── image_analysis.py    — Image preprocessing endpoint
│   └── health.py            — Health check endpoint
├── services/
│   ├── opencv_service.py    — Image resize, compress, enhance
│   └── preprocessing.py     — Image preparation pipeline
├── models/
│   ├── requests.py          — Pydantic request models
│   └── responses.py         — Pydantic response models
└── utils/
    └── image_utils.py       — Helper functions for image ops
```

---

## Key Workflows

### AI Recommendation Flow

```
Customer submits room data + image
        │
        ▼
Backend validates input → Creates Room_Assessment record
        │
        ▼
Backend sends image to Python AI Service (FastAPI)
        │
        ▼
Python service preprocesses image (OpenCV: resize, compress)
        │
        ▼
Backend sends preprocessed image to OpenAI Vision (gpt-4o)
        │
        ▼
OpenAI returns structured room characteristics (JSON)
        │
        ▼
Backend fetches BTU_Factors from database
        │
        ▼
Backend sends room data + BTU factors + product catalog to OpenAI (gpt-4o)
        │
        ▼
OpenAI returns recommendation (total_btu, hp, type, product_id, reasoning)
        │
        ▼
Backend saves AI_Recommendation record → Returns result to Customer
```

### Service Request & Scheduling Flow

```
Customer submits service request → Status: "pending"
        │
        ▼
Admin reviews and approves → Status: "approved"
        │
        ▼
Admin assigns technician → Creates TECHNICIAN_SCHEDULE → Status: "assigned"
        │
        ▼
Technician accepts → Status: "accepted"
   OR
Technician rejects → Status: "rejected" → Returns to Admin
        │
        ▼
Technician starts work → Status: "in-progress"
        │
        ▼
Technician completes + submits report → Status: "completed"
```

---

## Security Design

### Authentication Flow

1. User submits credentials → Backend validates against hashed password (bcrypt)
2. On success → Backend generates JWT token with user id, role, expiration
3. Frontend stores token → Sends in Authorization header for subsequent requests
4. Backend middleware verifies token on each protected request
5. Role middleware checks user role against endpoint permissions

### Authorization Matrix

| Resource | Guest | Customer | Technician | Admin |
|----------|-------|----------|------------|-------|
| Browse services/products | ✓ | ✓ | ✓ | ✓ |
| Submit service request | ✗ | ✓ | ✗ | ✗ |
| AI recommendation | ✗ | ✓ | ✗ | ✗ |
| Chatbot | ✗ | ✓ | ✗ | ✗ |
| View own requests | ✗ | ✓ | ✗ | ✓ (all) |
| Approve/reject requests | ✗ | ✗ | ✗ | ✓ |
| Assign technicians | ✗ | ✗ | ✗ | ✓ |
| View/manage own tasks | ✗ | ✗ | ✓ | ✗ |
| Accept/reject tasks | ✗ | ✗ | ✓ | ✗ |
| Manage products | ✗ | ✗ | ✗ | ✓ |
| Manage BTU factors | ✗ | ✗ | ✗ | ✓ |
| Generate reports | ✗ | ✗ | ✗ | ✓ |
| Manage accounts | ✗ | ✗ | ✗ | ✓ |

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | React.js (TypeScript) | Dynamic SPA with role-based views, type safety |
| Component library | shadcn/ui + Tailwind CSS | Accessible, customizable components with utility-first styling |
| Backend framework | Express.js (TypeScript) | Lightweight, widely-adopted, type-safe REST API server |
| ORM | Sequelize (sequelize-typescript) | Mature ORM with TypeScript decorators, migration support |
| Database | MySQL | Relational integrity for structured business data |
| AI service | FastAPI (Python) | High-performance async framework for image processing |
| Image processing | OpenCV (Python) | Industry-standard for image preprocessing |
| AI models | OpenAI gpt-4o / gpt-4o-mini | Vision capabilities, structured output, cost optimization |
| Auth | JWT + bcrypt | Stateless auth tokens, secure password hashing |
| Validation | express-validator + zod | Server-side and client-side schema validation |
| State management | React Context + hooks | Sufficient for role-based app without complex state |
| Form handling | react-hook-form + zod | shadcn/ui Form component integration |
| HTTP client | Axios | Request/response interceptors for token management |
| Testing | Jest (unit), Playwright (E2E) | Standard TypeScript testing ecosystem |

---

## Error Handling Strategy

### Backend
- Global error middleware catches unhandled errors
- Service layer throws typed errors (ValidationError, NotFoundError, UnauthorizedError)
- OpenAI API calls wrapped with retry logic (exponential backoff, max 3 retries)
- All errors logged with context; user-facing messages are generic

### Frontend
- Axios interceptors handle 401 (redirect to login) and 500 (toast notification)
- Form validation errors displayed inline via react-hook-form
- Loading states and error boundaries for async operations
- Toast notifications (shadcn/ui) for success/error feedback

---

## Deployment Considerations

- Frontend: Static build deployed to web server or CDN
- Backend: Node.js process with PM2 or similar process manager
- AI Service: Python FastAPI with uvicorn
- Database: MySQL server with proper indexing on foreign keys
- Environment: All secrets in .env files, separate configs per environment
- CORS: Configured to allow only the frontend origin
