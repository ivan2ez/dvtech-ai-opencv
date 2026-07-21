# DVTech AI-Powered Web System — Project Steering

## Project Summary

This is an AI-Powered Web-Based Air Conditioning Recommendation, Service Request Management, and Technician Scheduling System for DVTech — a local AC service provider with ~30 technicians handling installation, maintenance, and repair.

#[[file:Documents/system-requirements.md]]

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js (TypeScript) + shadcn/ui + Tailwind CSS |
| Backend | Node.js + Express.js (TypeScript) |
| AI/Image Processing | Python + OpenCV (FastAPI microservice) |
| AI Intelligence | OpenAI API (gpt-4o for vision/recommendations, gpt-4o-mini for chatbot/troubleshooting) |
| Database | MySQL |
| ORM | Sequelize (sequelize-typescript) |
| Testing | Jest (unit), Playwright (E2E), Postman (API) |

---

## Architecture

- Three-tier architecture: Presentation → Application → Data
- Frontend communicates with backend via REST API
- Python microservice handles image preprocessing (OpenCV) before sending to OpenAI
- MySQL with Sequelize ORM for all data persistence

---

## User Roles

1. **Customer** — browses services, submits service requests, receives AI recommendations, chats with bot
2. **Admin** — approves reservations, assigns technicians, manages products/pricing/BTU factors, generates reports
3. **Technician** — views assigned tasks, accepts/rejects, updates status, submits completion reports
4. **Guest** — unauthenticated visitor, can browse but cannot book or use AI features

---

## Core Modules

1. **Authentication & Authorization** — registration, login, role-based access control
2. **AI Recommendation** — room data input, image analysis, BTU calculation, product matching
3. **Chatbot** — conversational interface, collects room details, guides users
4. **Service Request** — service browsing, booking/reservation, status tracking
5. **Technician Scheduling** — task assignment, accept/reject, status updates, completion reports
6. **Product Management** — CRUD for AC products, services, pricing, BTU factors
7. **Reporting** — service summaries, technician performance, AI recommendation reports

---

## Key Business Rules

- Service requests start as "pending" — Admin must approve before technician assignment
- Only approved requests can be scheduled to a technician
- Technicians can reject tasks — rejected tasks return to Admin for reassignment
- Task status progression: pending → approved → assigned → accepted → in-progress → completed
- AI recommendation requires: area, ceiling height, occupancy, sunlight level (minimum)
- BTU calculation uses configurable factors managed by Admin
- No integrated payment system — payments handled externally
- Guest users cannot submit requests or use AI features
- Reports are admin-only

---

## Database Tables

- USERS (id, name, email, password, role, timestamps)
- SERVICE_REQUESTS (id, user_id, service_type, ac_details, status, timestamps)
- ROOM_ASSESSMENTS (id, service_request_id, area, ceiling_height, occupancy, sunlight_level, image_path, timestamps)
- AI_RECOMMENDATIONS (id, room_assessment_id, total_btu, recommended_hp, unit_type, product_id, troubleshooting_notes, timestamps)
- AIRCON_PRODUCTS (id, brand, model, type, horsepower, btu_capacity, price, description, image_url, timestamps)
- TECHNICIAN_DETAILS (id, user_id, specialization, contact_number, availability_status)
- TECHNICIAN_SCHEDULE (id, technician_id, service_request_id, scheduled_date, status, report, timestamps)
- BTU_FACTORS (id, user_id, factor_name, factor_value, description)
- REPORTS (id, service_request_id, report_type, summary, generated_date)

---

## Frontend UI Guidelines (shadcn/ui)

- Use shadcn/ui as the component library (built on Radix UI primitives + Tailwind CSS)
- Install components on-demand via `npx shadcn@latest add <component>`
- Use Tailwind CSS for all styling — no separate CSS files or CSS-in-JS
- Leverage shadcn/ui components: Button, Card, Dialog, Form, Input, Table, Select, Tabs, Toast, etc.
- Use the shadcn/ui Form component (built on react-hook-form + zod) for all form handling and validation
- Follow shadcn/ui theming via CSS variables in `globals.css`
- Use the `cn()` utility from `lib/utils` for conditional class merging
- Keep custom components consistent with shadcn/ui design tokens and patterns

---

## Coding Standards & Conventions

- Use TypeScript for both frontend and backend (strict mode)
- Use functional React components with hooks
- Follow RESTful API naming conventions (plural nouns, proper HTTP methods)
- Use Sequelize models with sequelize-typescript decorators
- Store secrets and API keys in environment variables (.env), never in code
- Hash passwords before storage (bcrypt)
- Use JWT for session management
- Validate all user input on both client and server side
- Use descriptive variable and function names (camelCase for variables/functions, PascalCase for classes/components)
- Group files by module/feature rather than by type

---

## Folder Structure Convention

```
/frontend          → React.js (TypeScript) + shadcn/ui application
  /src
    /components    → Reusable UI components
    /components/ui → shadcn/ui components (auto-generated)
    /pages         → Page-level components per role
    /hooks         → Custom React hooks
    /services      → API call utilities
    /contexts      → React context providers (auth, theme, etc.)
    /types         → TypeScript type definitions
    /utils         → Utility/helper functions
    /lib           → shadcn/ui utils (cn helper)

/backend           → Node.js + Express.js (TypeScript) API
  /src
    /controllers   → Route handlers grouped by module
    /models        → Sequelize model definitions
    /routes        → Express route definitions
    /middlewares   → Auth, validation, error handling middleware
    /services      → Business logic layer
    /utils         → Utility/helper functions
    /config        → Database config, environment setup
    /types         → TypeScript type definitions

/ai-service        → Python + OpenCV microservice (FastAPI)
  /app
    /routes        → API endpoints
    /services      → Image processing & OpenAI integration logic
    /models        → Pydantic models for request/response
    /utils         → Helper functions

/Documents         → Project documentation & thesis materials
```

---

## OpenAI Integration Guidelines

- Use the official `openai` npm package in the Node.js backend
- Use JSON mode (`response_format: { type: "json_object" }`) for structured outputs
- Store system prompts as configurable templates (DB or config) so Admin can tune without code changes
- Implement request queuing to avoid rate limits
- Use `gpt-4o-mini` for chatbot and troubleshooting (cost-effective)
- Reserve `gpt-4o` for image analysis and final recommendations
- Set `max_tokens` limits per feature (chatbot: 500, recommendation: 1000)
- Compress/resize images before sending to OpenAI
- Store chat history per session; send last N messages for context continuity
- Implement retry logic with exponential backoff for API failures

---

## Security Requirements

- Secure authentication with hashed passwords (bcrypt) and JWT tokens
- Role-based access control enforced at both frontend routes and backend middleware
- Input validation and sanitization on all endpoints
- CORS properly configured for frontend-backend communication
- Environment variables for all secrets and API keys
- Rate limiting on public-facing endpoints
- Data privacy and protection for customer information
