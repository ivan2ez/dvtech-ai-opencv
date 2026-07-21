# Implementation Plan

## Overview

This implementation plan covers the DVTech AI-Powered Web-Based System — a unified platform providing AI-driven AC recommendations, service request management, and technician scheduling. The plan is organized into 12 task groups covering project setup, authentication, product management, service requests, AI recommendation, chatbot, scheduling, reporting, account management, security, frontend layout, and testing.

## Tasks

- [ ] 1. Project Setup and Configuration
  - [x] 1.1 Initialize frontend project with Vite + React + TypeScript, install shadcn/ui, Tailwind CSS, react-router-dom, axios, react-hook-form, zod, and configure tsconfig
  - [x] 1.2 Initialize backend project with Express.js + TypeScript, install sequelize, sequelize-typescript, mysql2, bcrypt, jsonwebtoken, express-validator, cors, dotenv, openai SDK, and configure tsconfig
  - [x] 1.3 Initialize Python AI service with FastAPI, install opencv-python, uvicorn, pydantic, and create project structure
  - [x] 1.4 Create MySQL database schema and Sequelize migrations for all tables (USERS, SERVICE_REQUESTS, ROOM_ASSESSMENTS, AI_RECOMMENDATIONS, AIRCON_PRODUCTS, TECHNICIAN_DETAILS, TECHNICIAN_SCHEDULE, BTU_FACTORS, REPORTS)
  - [x] 1.5 Create Sequelize models with sequelize-typescript decorators and define associations (User, ServiceRequest, RoomAssessment, AiRecommendation, AirconProduct, TechnicianDetail, TechnicianSchedule, BtuFactor, Report)
  - [x] 1.6 Set up environment configuration files (.env.example) for backend (DB credentials, JWT secret, OpenAI API key, AI service URL) and AI service (host, port)
- [ ] 2. Authentication and Authorization Module
  - [ ] 2.1 Create authService with registration logic (validate input, check email uniqueness, hash password with bcrypt, create user with 'customer' role)
  - [ ] 2.2 Create authService with login logic (validate credentials, compare hashed password, generate JWT with user id and role, return token)
  - [ ] 2.3 Create authMiddleware for JWT verification (extract token from Authorization header, verify signature, attach user to request)
  - [ ] 2.4 Create roleMiddleware factory function that checks user role against allowed roles and returns 403 if unauthorized
  - [ ] 2.5 Create authController and authRoutes (POST /api/auth/register, POST /api/auth/login, GET /api/auth/profile, PUT /api/auth/profile)
  - [ ] 2.6 Create frontend AuthContext with login/logout/register state management and token storage in localStorage
  - [ ] 2.7 Create frontend LoginForm and RegisterForm components using shadcn/ui Form with zod validation schemas
  - [ ] 2.8 Create ProtectedRoute component that checks authentication and role, redirects unauthenticated users to login
  - [ ] 2.9 Configure React Router with public routes, customer routes, admin routes, and technician routes with appropriate ProtectedRoute wrappers
- [ ] 3. Product Management Module
  - [ ] 3.1 Create productService with CRUD operations for AIRCON_PRODUCTS (create, findAll, findById, update, delete/deactivate)
  - [ ] 3.2 Create productController and productRoutes (GET /api/products public, POST/PUT/DELETE /api/products admin-only)
  - [ ] 3.3 Create btuFactorService with CRUD operations for BTU_FACTORS (create, findAll, update, delete)
  - [ ] 3.4 Create btuFactor endpoints in productController (GET/POST/PUT/DELETE /api/btu-factors admin-only)
  - [ ] 3.5 Create serviceTypeService for managing service types and pricing
  - [ ] 3.6 Create frontend ManageProducts page (Admin) with DataTable, add/edit dialog using shadcn/ui Dialog and Form components
  - [ ] 3.7 Create frontend ManageBtuFactors page (Admin) with DataTable and CRUD operations
  - [ ] 3.8 Create frontend public ProductsPage and ServicesPage displaying catalog and pricing for all users
- [ ] 4. Service Request Module
  - [ ] 4.1 Create serviceRequestService with creation logic (validate input, set status to 'pending', save with user_id)
  - [ ] 4.2 Create serviceRequestService with approval workflow (approve sets status to 'approved', reject sets status to 'rejected' with reason, validate only Admin can perform)
  - [ ] 4.3 Create serviceRequestController and serviceRequestRoutes with all endpoints (POST create, GET list with role-based filtering, PATCH approve/reject)
  - [ ] 4.4 Create frontend ServiceRequestForm page (Customer) with service type selection, AC details input using shadcn/ui form components
  - [ ] 4.5 Create frontend MyRequests page (Customer) displaying user's requests with status badges and detail view
  - [ ] 4.6 Create frontend ManageRequests page (Admin) with DataTable showing all requests, approve/reject action buttons, filtering by status
- [ ] 5. AI Recommendation Module
  - [ ] 5.1 Create Python AI service image preprocessing endpoint (POST /api/preprocess) — accepts image, applies OpenCV resize to 1024x1024 max and compress to under 1MB, returns processed image
  - [ ] 5.2 Create imageService in backend to communicate with Python AI service (send image, receive preprocessed result)
  - [ ] 5.3 Create aiService with room assessment logic (validate required fields: area, ceiling height, occupancy, sunlight level; create RoomAssessment record; handle optional image upload)
  - [ ] 5.4 Create aiService with OpenAI Vision integration (send preprocessed image to gpt-4o, parse structured JSON response with room characteristics)
  - [ ] 5.5 Create aiService with BTU calculation and recommendation logic (fetch BTU_Factors from DB, combine with room data + image analysis, send to gpt-4o with product catalog context, parse recommendation JSON, match to product, save AiRecommendation record)
  - [ ] 5.6 Create aiController and aiRoutes (POST /api/ai/room-assessment, GET /api/ai/recommendations/:id) with customer-only access
  - [ ] 5.7 Implement retry logic with exponential backoff for OpenAI API calls (max 3 retries starting at 1 second, user-friendly error on failure)
  - [ ] 5.8 Create frontend AiRecommendation page (Customer) with room data form (area, ceiling height, occupancy, sunlight level), image upload, and recommendation result display
- [ ] 6. Chatbot Module
  - [ ] 6.1 Create chatbotService with session management (store chat history per user session, maintain conversation context with last 10 messages)
  - [ ] 6.2 Create chatbotService with OpenAI gpt-4o-mini integration (build message array with system prompt + last 10 messages, send to API with max 500 tokens, parse response)
  - [ ] 6.3 Create chatbot system prompt template that guides the AI to collect room details one at a time and answer FAQ about DVTech services
  - [ ] 6.4 Create chatbot endpoint in aiController (POST /api/ai/chatbot) with customer-only access
  - [ ] 6.5 Create frontend ChatWindow component with message list, ChatInput component, and ChatMessage component using shadcn/ui styling
  - [ ] 6.6 Integrate chatbot UI into customer pages as a floating widget or dedicated chat page
- [ ] 7. Technician Scheduling Module
  - [ ] 7.1 Create scheduleService with assignment logic (validate request is 'approved', check technician availability_status is 'available', check for scheduling conflicts on date, create TECHNICIAN_SCHEDULE with 'assigned' status and priority, update service request status to 'assigned')
  - [ ] 7.2 Create scheduleService with technician actions (accept: assigned→accepted, reject: assigned→rejected with reason and return request to 'approved', update status: accepted→in-progress, complete: in-progress→completed with report min 20 chars)
  - [ ] 7.3 Create scheduleController and scheduleRoutes (POST /api/schedules admin-only, GET list role-based, PATCH accept/reject/status/complete technician-only)
  - [ ] 7.4 Create frontend ManageSchedules page (Admin) with approved requests list, technician selector with availability display and task count, assign action with date picker and priority selector
  - [ ] 7.5 Create frontend TechnicianDashboard and MyTasks page showing assigned tasks with accept/reject buttons, status update controls, and completion report form
  - [ ] 7.6 Create frontend TaskDetail page (Technician) with full request details, status progression, and completion report submission
- [ ] 8. Reporting Module
  - [ ] 8.1 Create reportService with service summary report generation (aggregate service requests by status and type within date range)
  - [ ] 8.2 Create reportService with technician performance report generation (aggregate assignments, completions, rejections per technician within date range)
  - [ ] 8.3 Create reportService with AI recommendation report generation (aggregate recommendations by unit type within date range)
  - [ ] 8.4 Create reportController and reportRoutes (POST /api/reports/generate, GET /api/reports, GET /api/reports/:id, GET /api/reports/:id/export) admin-only
  - [ ] 8.5 Create frontend Reports page (Admin) with report type selection, date range picker, generate action, results display, and CSV/PDF export functionality
- [ ] 9. Account Management Module
  - [ ] 9.1 Create adminController with customer account management endpoints (GET /api/admin/customers paginated list, PATCH deactivate setting is_active to false)
  - [ ] 9.2 Create adminController with technician account management endpoints (GET list, POST create with TechnicianDetail, PUT update details, PATCH deactivate)
  - [ ] 9.3 Create frontend ManageAccounts page (Admin) with tabs for customers and technicians, DataTable with actions (deactivate, edit details), create technician dialog
- [ ] 10. Security, Middleware, and Cross-Cutting Concerns
  - [ ] 10.1 Create global error handling middleware (catch typed errors, log with context, return appropriate HTTP status codes with generic user messages)
  - [ ] 10.2 Create rate limiting middleware for public endpoints (100 requests per 15-minute window per IP) using express-rate-limit
  - [ ] 10.3 Configure CORS middleware to allow only the frontend origin from environment variables
  - [ ] 10.4 Create input validation schemas using express-validator for all endpoints (registration, login, service request, room assessment, product, schedule, BTU factors)
  - [ ] 10.5 Set up Axios interceptor in frontend for automatic token attachment, 401 redirect to login, and error toast notifications
- [ ] 11. Frontend Layout and Navigation
  - [ ] 11.1 Create Navbar component with role-aware navigation links, user menu dropdown, and logout functionality using shadcn/ui
  - [ ] 11.2 Create Sidebar component for dashboard pages (Admin, Technician) with module navigation links
  - [ ] 11.3 Create HomePage with hero section, service overview, and call-to-action for registration
  - [ ] 11.4 Create CustomerDashboard with summary cards (recent requests, recommendation status) and quick action links
  - [ ] 11.5 Create AdminDashboard with summary cards (pending requests count, active technicians, recent reports) and quick navigation
  - [ ] 11.6 Create shared DataTable component using shadcn/ui Table with sorting, filtering, and pagination (max 20 items per page)
  - [ ] 11.7 Create StatusBadge component for displaying request/task status with appropriate colors
- [ ] 12. Testing Setup
  - [ ] 12.1 Configure Jest with ts-jest for backend unit testing, create test utilities for mocking Sequelize models and request/response objects
  - [ ] 12.2 Write unit tests for authService (registration validation, password hashing, login verification, JWT generation, account lockout)
  - [ ] 12.3 Write unit tests for serviceRequestService (creation with pending status, approval workflow with reason validation, role validation)
  - [ ] 12.4 Write unit tests for scheduleService (assignment validation, conflict detection, status transitions, rejection flow with reason)
  - [ ] 12.5 Write unit tests for aiService (input validation, room assessment creation, recommendation parsing)
  - [ ] 12.6 Configure Playwright for frontend E2E testing and write smoke tests for login flow, service request submission, and admin approval workflow

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"],
      "description": "Project Setup and Configuration — foundation for all modules"
    },
    {
      "wave": 2,
      "tasks": ["2", "10", "11"],
      "description": "Authentication, Security Middleware, and Frontend Layout — depend on project setup"
    },
    {
      "wave": 3,
      "tasks": ["3", "4", "6", "9"],
      "description": "Product Management, Service Requests, Chatbot, Account Management — depend on auth"
    },
    {
      "wave": 4,
      "tasks": ["5", "7"],
      "description": "AI Recommendation and Technician Scheduling — depend on products and service requests"
    },
    {
      "wave": 5,
      "tasks": ["8"],
      "description": "Reporting — depends on service requests, AI recommendations, and scheduling"
    },
    {
      "wave": 6,
      "tasks": ["12"],
      "description": "Testing Setup — depends on all core modules being implemented"
    }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": ["1", "2"],
    "4": ["1", "2"],
    "5": ["1", "2", "3"],
    "6": ["1", "2"],
    "7": ["1", "2", "4"],
    "8": ["4", "5", "7"],
    "9": ["1", "2"],
    "10": ["1"],
    "11": ["1"],
    "12": ["2", "3", "4", "5", "7"]
  }
}
```

## Notes

- Tasks within each group can be executed sequentially (backend tasks before frontend tasks within the same module)
- Task 1 (Project Setup) must be completed first as all other tasks depend on it
- Task 2 (Auth) is the next priority since most modules require authentication
- Tasks 10 and 11 can run in parallel with Task 2 since they only depend on Task 1
- The AI service (Python/FastAPI) in Task 5.1 can be developed independently of the Node.js backend
