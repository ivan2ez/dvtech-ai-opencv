3wkl# 10 — Security Operations

## Authentication & Authorization

### How Auth Works

1. User logs in via `POST /api/auth/login` with email + password
2. Backend verifies bcrypt-hashed password
3. On success, returns a signed JWT token
4. Frontend stores token in `localStorage`
5. All protected API calls include `Authorization: Bearer <token>` header
6. Backend middleware validates token and extracts user role
7. Role middleware restricts access based on allowed roles per route

### Token Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Algorithm | HS256 | hardcoded in `jsonwebtoken` usage |
| Expiration | 24 hours | `JWT_EXPIRES_IN` in `.env` |
| Secret | 64+ char hex | `JWT_SECRET` in `.env` |

---

## Secret Rotation

### Rotating JWT_SECRET

**Impact:** All active user sessions will be invalidated. Users must log in again.

**Steps:**
1. Generate new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `JWT_SECRET` in production `.env`
3. Restart the backend service: `pm2 restart dvtech-backend`
4. Notify users if needed (they'll be logged out)

### Rotating OPENAI_API_KEY

**Impact:** AI features will fail until the new key is active.

**Steps:**
1. Generate a new key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Update `OPENAI_API_KEY` in production `.env`
3. Restart the backend: `pm2 restart dvtech-backend`
4. Revoke the old key in the OpenAI dashboard
5. Verify AI features work: test a recommendation or chatbot request

---

## Rate Limiting

Rate limiting is configured via `express-rate-limit` in `src/middlewares/rateLimitMiddleware.ts`.

| Endpoint Group | Window | Max Requests |
|---------------|--------|--------------|
| Auth (login/register) | 15 minutes | 10 attempts |
| General API | 15 minutes | 100 requests |

### Signs of Abuse

- Many 429 responses in logs from same IP
- Multiple failed login attempts for different emails (credential stuffing)
- Unusually high request volume to AI endpoints (cost impact)

### Temporary IP Block (nginx)

```nginx
# Add to nginx server block
deny 1.2.3.4;  # Malicious IP
```

Or use fail2ban for automated blocking.

---

## Input Validation

Validation is enforced at two levels:

1. **Frontend** — react-hook-form + zod schemas (UX feedback)
2. **Backend** — express-validator middleware (security enforcement)

### Key Validation Points

| Input | Validation |
|-------|-----------|
| Email | Valid email format, unique on registration |
| Password | Minimum length (6+ chars) |
| File uploads | Type check (JPEG/PNG only), size limit |
| IDs (URL params) | Integer validation |
| Free text fields | Sanitized, length limits |

---

## CORS Configuration

CORS is set in `src/app.ts` using the `cors` package.

| Environment | Allowed Origin |
|-------------|---------------|
| Development | `http://localhost:5173` |
| Production | `FRONTEND_URL` env variable (exact match) |

**Rules:**
- Never use `*` (wildcard) in production
- Never allow credentials with wildcard origins
- Must match exactly (including protocol and port)

---

## File Upload Security

Uploads are handled by `multer` middleware.

| Control | Implementation |
|---------|---------------|
| File type restriction | MIME type check (image/jpeg, image/png) |
| File size limit | Configured in multer options |
| Storage location | `backend/uploads/` directory |
| Filename | Randomized (prevents path traversal) |

**Production hardening:**
- Serve uploads from a separate domain/CDN (prevents XSS via uploaded files)
- Scan uploads for malware in high-security environments
- Set appropriate `Content-Type` and `Content-Disposition` headers when serving

---

## Data Protection

### Sensitive Data Inventory

| Data | Storage | Protection |
|------|---------|------------|
| Passwords | Database | bcrypt hash (10 rounds) |
| JWT tokens | Client localStorage | Signed, expires in 24h |
| OpenAI API key | Server `.env` | Never exposed to frontend |
| Customer details | Database | Access restricted by role middleware |
| Room images | `uploads/` folder | No public listing |

### What NOT to Log

- Passwords (plaintext or hashed)
- JWT tokens
- API keys
- Full credit card numbers (if ever added)
- Full request bodies containing sensitive user data

---

## Security Checklist (Production)

- [ ] `JWT_SECRET` is a strong random value (not the example from `.env.example`)
- [ ] `NODE_ENV=production` is set
- [ ] CORS restricted to production frontend domain only
- [ ] Rate limiting is active on auth and public routes
- [ ] No `.env` files are committed to git (verify with `git log --all -- '*.env'`)
- [ ] Passwords in seed/test data are NOT used in production
- [ ] OpenAI API key has spending limits configured
- [ ] HTTPS is enforced (redirect HTTP → HTTPS)
- [ ] Security headers are set (via nginx or helmet)
- [ ] Database backups are encrypted at rest
- [ ] File uploads directory is not publicly browsable
- [ ] npm audit shows no critical vulnerabilities

### Running npm audit

```bash
cd backend
npm audit

cd ../frontend
npm audit
```

Fix vulnerabilities:
```bash
npm audit fix
```

---

## Incident — Suspected Account Compromise

1. **Deactivate the account** via admin panel (`/admin/accounts`) or database:
   ```sql
   UPDATE Users SET isActive = 0 WHERE email = 'compromised@email.com';
   ```
2. **Rotate JWT_SECRET** if admin account was compromised (invalidates ALL sessions)
3. **Review access logs** for suspicious activity patterns
4. **Rotate API keys** if any admin had access to OpenAI or Gemini keys
5. **Notify affected users** to change passwords upon reactivation
