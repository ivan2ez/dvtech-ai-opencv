# 02 — Environment Variables

## Backend (`/backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Express server port |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`) |
| `DB_HOST` | Yes* | `127.0.0.1` | MySQL host |
| `DB_PORT` | Yes* | `3306` | MySQL port |
| `DB_USERNAME` | Yes* | `root` | MySQL username |
| `DB_PASSWORD` | Yes* | — | MySQL password |
| `DB_NAME` | Yes* | `dvtech_ai` | MySQL database name |
| `DB_NAME_TEST` | No | `dvtech_ai_test` | Test database name |
| `JWT_SECRET` | **Yes** | — | Secret key for JWT token signing. Use a strong random string (32+ chars) |
| `JWT_EXPIRES_IN` | No | `24h` | Token expiration duration |
| `OPENAI_API_KEY` | **Yes** | — | OpenAI API key for GPT-4o (recommendations, image analysis) |
| `GEMINI_API_KEY` | No | — | Google Gemini API key (troubleshooting feature) |
| `AI_SERVICE_URL` | No | `http://localhost:8000` | URL of the Python AI microservice |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend origin for CORS |

> *Database vars are required for MySQL in production. Local dev uses SQLite (file-based, no config needed).

### Example

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
JWT_EXPIRES_IN=24h
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
GEMINI_API_KEY=AQ.xxxxxxxxxxxxx
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

---

## AI Service (`/ai-service/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | `0.0.0.0` | FastAPI bind address |
| `PORT` | No | `8000` | FastAPI port |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | CORS allowed origins (comma-separated) |

### Example

```env
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://localhost:3000
```

---

## Security Notes

- **Never commit `.env` files** — they are in `.gitignore`
- **Rotate `JWT_SECRET`** if compromised. All existing tokens will be invalidated.
- **OpenAI API key** should have spending limits configured in the OpenAI dashboard.
- **Use different secrets** for development, staging, and production environments.
- Generate a strong JWT secret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
