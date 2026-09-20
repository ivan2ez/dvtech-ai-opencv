# 04 — Deployment

## Production Deployment Checklist

### Pre-Deployment

- [ ] All tests pass (`npm run test` in backend, `npm run test:e2e` in frontend)
- [ ] TypeScript compiles without errors (`npm run lint` / `npm run build`)
- [ ] Environment variables are set for production
- [ ] MySQL database is provisioned and accessible
- [ ] OpenAI API key has appropriate rate limits/spending caps
- [ ] JWT_SECRET is a strong, unique production secret
- [ ] CORS is restricted to the production frontend domain

### Backend Deployment

```bash
cd backend

# 1. Install production dependencies
npm ci --omit=dev

# 2. Build TypeScript
npm run build

# 3. Run migrations
npm run db:migrate

# 4. Start server
npm start   # runs node dist/app.js
```

### Frontend Deployment

```bash
cd frontend

# 1. Install dependencies
npm ci

# 2. Build for production
npm run build

# 3. Output is in dist/ — serve with any static file server (nginx, Vercel, etc.)
```

### AI Service Deployment

```bash
cd ai-service

# 1. Install dependencies
pip install -r requirements.txt

# 2. Start with production server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Production Environment Variables

### Backend

```env
PORT=3000
NODE_ENV=production
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USERNAME=dvtech_app
DB_PASSWORD=<strong-password>
DB_NAME=dvtech_ai
JWT_SECRET=<64-char-random-hex>
JWT_EXPIRES_IN=24h
OPENAI_API_KEY=sk-proj-<production-key>
GEMINI_API_KEY=<production-key>
AI_SERVICE_URL=http://ai-service-host:8000
FRONTEND_URL=https://your-production-domain.com
```

### AI Service

```env
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://backend-host:3000
```

---

## Production Security Hardening

1. **CORS** — Set `FRONTEND_URL` to exact production domain (no wildcards)
2. **Rate Limiting** — Already configured via `express-rate-limit` for public routes
3. **HTTPS** — Use a reverse proxy (nginx) with TLS termination
4. **Headers** — Add security headers (Helmet.js or nginx config):
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security`
5. **Database** — Use a dedicated user with minimal required privileges
6. **Secrets** — Use environment variables or a secrets manager (never hardcode)
7. **Logging** — Set `NODE_ENV=production` to disable SQL query logging

---

## Nginx Reverse Proxy Example

```nginx
server {
    listen 80;
    server_name dvtech.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name dvtech.example.com;

    ssl_certificate /etc/letsencrypt/live/dvtech.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dvtech.example.com/privkey.pem;

    # Frontend (static files)
    location / {
        root /var/www/dvtech/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded files
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

---

## Process Management (PM2)

For keeping the backend alive in production:

```bash
# Install PM2
npm install -g pm2

# Start backend
cd backend
pm2 start dist/app.js --name dvtech-backend

# Start AI service
cd ai-service
pm2 start "uvicorn app.main:app --host 0.0.0.0 --port 8000" --name dvtech-ai

# Save process list
pm2 save

# Auto-start on reboot
pm2 startup
```

### PM2 Commands

| Command | Description |
|---------|-------------|
| `pm2 status` | View all processes |
| `pm2 logs dvtech-backend` | View backend logs |
| `pm2 restart dvtech-backend` | Restart backend |
| `pm2 reload dvtech-backend` | Zero-downtime reload |
| `pm2 stop all` | Stop everything |
