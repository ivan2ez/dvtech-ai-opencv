# 05 — API Reference

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

---

## Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "message": "DVTech AI Backend is running",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

---

## Authentication

### Register

```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer"
  }
}
```

### Get Profile

```
GET /api/auth/profile
Authorization: Bearer <token>
```

---

## Route Groups

All protected routes require the `Authorization: Bearer <token>` header.

### Public Routes (Rate Limited)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new customer |
| POST | `/api/auth/login` | Login |
| GET | `/api/products` | List AC products |
| GET | `/api/products/:id` | Get product details |
| GET | `/api/services` | List service types |
| GET | `/api/brands` | List brands |

### Customer Routes (Role: customer)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/profile` | Get logged-in user profile |
| POST | `/api/service-requests` | Submit a service request |
| GET | `/api/service-requests/my` | Get user's own requests |
| POST | `/api/ai/recommend` | Get AI recommendation |
| POST | `/api/ai/troubleshoot` | AI troubleshooting |
| POST | `/api/ai/chat` | Chatbot interaction |

### Admin Routes (Role: admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/service-requests` | List all service requests |
| PATCH | `/api/service-requests/:id/status` | Update request status |
| GET | `/api/schedules` | List all schedules |
| POST | `/api/schedules` | Assign technician |
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id` | Update user (activate/deactivate) |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/btu-factors` | List BTU factors |
| POST | `/api/btu-factors` | Create BTU factor |
| PUT | `/api/btu-factors/:id` | Update BTU factor |
| DELETE | `/api/btu-factors/:id` | Delete BTU factor |
| GET | `/api/reports` | List reports |

### Technician Routes (Role: technician)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules/my` | Get assigned tasks |
| PATCH | `/api/schedules/:id/status` | Accept/reject/update task |
| PATCH | `/api/schedules/:id/report` | Submit completion report |

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "message": "Description of what went wrong",
  "errors": [
    { "field": "email", "message": "Email is required" }
  ]
}
```

### HTTP Status Codes Used

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Rate Limiting

Public routes are rate-limited. If exceeded, response:
```json
{
  "message": "Too many requests, please try again later."
}
```
