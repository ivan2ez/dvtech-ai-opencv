# 08 — User Accounts & Roles

## Role Overview

| Role | Description | Access Level |
|------|-------------|--------------|
| **admin** | System administrator | Full access to all features, user management, reports |
| **technician** | Service technician | View/manage assigned tasks, submit reports |
| **customer** | End user | Browse products, submit requests, use AI features |
| **guest** | Unauthenticated visitor | Browse services and products only |

---

## Default Seed Accounts

After running `npm run seed`, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@dvtech.com` | `password123` |
| Technician | `juan@dvtech.com` | `password123` |
| Technician | `pedro@dvtech.com` | `password123` |
| Technician | `maria@dvtech.com` | `password123` |
| Technician | `carlos@dvtech.com` | `password123` |
| Technician | `ana@dvtech.com` | `password123` |
| Customer | `customer1@email.com` | `password123` |
| Customer | `customer2@email.com` | `password123` |
| Customer | `customer3@email.com` | `password123` |
| Customer | `customer4@email.com` | `password123` |

> **Warning:** Change all passwords in production. These are for development/testing only.

---

## Role Permissions Matrix

| Feature | Guest | Customer | Technician | Admin |
|---------|:-----:|:--------:|:----------:|:-----:|
| Browse products/services | ✅ | ✅ | ✅ | ✅ |
| Register/Login | ✅ | — | — | — |
| View profile | — | ✅ | ✅ | ✅ |
| Submit service request | — | ✅ | — | — |
| View own requests | — | ✅ | — | — |
| AI recommendation | — | ✅ | — | — |
| AI chatbot | — | ✅ | — | — |
| AI troubleshooting | — | ✅ | — | — |
| View assigned tasks | — | — | ✅ | — |
| Accept/reject tasks | — | — | ✅ | — |
| Submit task report | — | — | ✅ | — |
| Manage all requests | — | — | — | ✅ |
| Assign technicians | — | — | — | ✅ |
| Manage products | — | — | — | ✅ |
| Manage brands | — | — | — | ✅ |
| Manage services | — | — | — | ✅ |
| Manage BTU factors | — | — | — | ✅ |
| Manage user accounts | — | — | — | ✅ |
| View reports | — | — | — | ✅ |

---

## Frontend Route Access

| Path | Allowed Roles |
|------|---------------|
| `/` | All (public) |
| `/login`, `/register` | All (public) |
| `/services`, `/products` | All (public) |
| `/profile` | customer, admin, technician |
| `/dashboard` | customer |
| `/service-request` | customer |
| `/my-requests` | customer |
| `/ai-recommendation` | customer |
| `/troubleshooting` | customer |
| `/chat` | customer |
| `/admin/*` | admin |
| `/technician/*` | technician |

---

## Creating New Admin Users

There is no self-registration for admin users. Options:

1. **Via seed script** — Add to the `users` array in `seed.ts` with `role: 'admin'`
2. **Via database** — Insert directly:
   ```sql
   INSERT INTO Users (name, email, password, role, isActive, createdAt, updatedAt)
   VALUES ('New Admin', 'newadmin@dvtech.com', '<bcrypt-hashed-password>', 'admin', 1, NOW(), NOW());
   ```
3. **Via admin panel** — Existing admin can manage accounts at `/admin/accounts`

### Generating a bcrypt hash

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10).then(h => console.log(h))"
```

---

## Account Status

| Status | Behavior |
|--------|----------|
| `isActive: true` | Normal access |
| `isActive: false` | Cannot login, existing tokens may still work until expiry |

Admins can activate/deactivate accounts via the Manage Accounts page (`/admin/accounts`).

---

## Password Policy

- Minimum length enforced by frontend validation (typically 6+ characters)
- Passwords are hashed with bcrypt (10 salt rounds) before storage
- No password reset flow currently implemented
- JWT tokens expire after 24 hours (configurable via `JWT_EXPIRES_IN`)
