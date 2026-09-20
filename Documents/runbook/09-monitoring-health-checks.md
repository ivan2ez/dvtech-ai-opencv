# 09 — Monitoring & Health Checks

## Service Health Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Backend | `GET /api/health` | `{ "status": "ok" }` |
| AI Service | `GET /health` | `{ "status": "healthy" }` |
| Frontend | Load `https://your-domain.com` | HTTP 200, page renders |

---

## Quick Health Check Script

Save as `scripts/healthcheck.sh` or run manually:

```bash
#!/bin/bash

echo "=== DVTech Health Check ==="

# Backend
BACKEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$BACKEND" = "200" ]; then
  echo "✅ Backend: OK"
else
  echo "❌ Backend: FAILED (HTTP $BACKEND)"
fi

# AI Service
AI=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ "$AI" = "200" ]; then
  echo "✅ AI Service: OK"
else
  echo "❌ AI Service: FAILED (HTTP $AI)"
fi

# Frontend (dev server)
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173)
if [ "$FRONTEND" = "200" ]; then
  echo "✅ Frontend: OK"
else
  echo "❌ Frontend: FAILED (HTTP $FRONTEND)"
fi

echo "=========================="
```

---

## What to Monitor in Production

### Application Metrics

| Metric | Why | Alert When |
|--------|-----|------------|
| API response time (p95) | Detect slowdowns | > 2 seconds |
| Error rate (5xx) | Server-side failures | > 1% of requests |
| Authentication failures | Brute force attempts | > 10/minute from same IP |
| OpenAI API latency | AI feature degradation | > 10 seconds |
| OpenAI API errors | Feature unavailability | Any 429 (rate limit) or 500 |
| Database connection pool | Connection exhaustion | Pool utilization > 80% |
| Disk space (SQLite/uploads) | Storage full | < 500MB free |

### Infrastructure Metrics

| Metric | Why | Alert When |
|--------|-----|------------|
| CPU usage | Performance | Sustained > 80% |
| Memory usage | OOM risk | > 85% |
| Disk I/O | Bottleneck detection | Sustained high wait |
| Process alive (PM2) | Service down | Process restarts > 3/hour |

---

## Log Locations

| Service | Log Source |
|---------|-----------|
| Backend (dev) | stdout (terminal output) |
| Backend (PM2) | `~/.pm2/logs/dvtech-backend-out.log` |
| AI Service (PM2) | `~/.pm2/logs/dvtech-ai-out.log` |
| Nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| MySQL | `/var/log/mysql/error.log` |

### Viewing PM2 Logs

```bash
# Real-time logs
pm2 logs dvtech-backend --lines 100

# Error logs only
pm2 logs dvtech-backend --err

# Clear logs
pm2 flush
```

---

## Database Monitoring

### Check SQLite file size (dev)

```bash
ls -lh backend/database.sqlite
```

### MySQL status (production)

```sql
-- Active connections
SHOW PROCESSLIST;

-- Database size
SELECT table_schema AS 'Database',
       ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'dvtech_ai'
GROUP BY table_schema;

-- Slow queries
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
```

---

## OpenAI API Monitoring

Monitor costs and usage in the [OpenAI Dashboard](https://platform.openai.com/usage).

| Check | How Often | Action |
|-------|-----------|--------|
| Monthly spend | Weekly | Verify within budget |
| Rate limit errors in logs | Daily | Increase limits or add queuing |
| Model deprecation notices | Monthly | Plan migration before deadline |

---

## Uptime Monitoring (External)

For production, use an external uptime service to ping your health endpoints every 1-5 minutes:

- **Free options:** UptimeRobot, Better Stack (free tier), Freshping
- **What to monitor:**
  - `GET https://your-domain.com/api/health` → expect 200
  - `GET https://your-domain.com` → expect 200
- **Alert via:** Email, SMS, or Slack webhook

---

## Incident Response

### Service Down — Backend

1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs dvtech-backend --lines 50`
3. Restart: `pm2 restart dvtech-backend`
4. If restart fails, check disk space, memory, and `.env` file integrity

### Service Down — AI Service

1. Check PM2 status: `pm2 status`
2. Check if Python/uvicorn is running: `ps aux | grep uvicorn`
3. Restart: `pm2 restart dvtech-ai-service`
4. Common cause: OpenCV dependency missing after OS update

### Service Down — Database (MySQL)

1. Check MySQL status: `systemctl status mysql`
2. Restart: `sudo systemctl restart mysql`
3. Check disk space: `df -h`
4. Check error log: `sudo tail -50 /var/log/mysql/error.log`

### High Error Rate

1. Check backend logs for the specific error pattern
2. If OpenAI-related: Check API status at [status.openai.com](https://status.openai.com)
3. If database-related: Check connection pool and slow queries
4. If CORS-related: Verify `FRONTEND_URL` in `.env` matches the actual frontend domain
