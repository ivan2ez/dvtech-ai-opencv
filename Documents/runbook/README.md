# DVTech AI — Runbook

Operational runbook for the DVTech AI-Powered Web-Based AC Recommendation, Service Request Management, and Technician Scheduling System.

## Table of Contents

| Document | Description |
|----------|-------------|
| [01 - Local Development Setup](./01-local-development-setup.md) | Getting the project running from scratch |
| [02 - Environment Variables](./02-environment-variables.md) | All env vars across services with descriptions |
| [03 - Database Operations](./03-database-operations.md) | Migrations, seeding, backups, and troubleshooting |
| [04 - Deployment](./04-deployment.md) | Production deployment steps and checklist |
| [05 - API Reference](./05-api-reference.md) | Backend endpoints overview and health checks |
| [06 - AI Service Operations](./06-ai-service-operations.md) | Python microservice management |
| [07 - Troubleshooting](./07-troubleshooting.md) | Common issues and resolutions (incl. WSL/platform) |
| [08 - User Accounts & Roles](./08-user-accounts-roles.md) | Default accounts, role management |
| [09 - Monitoring & Health Checks](./09-monitoring-health-checks.md) | Uptime monitoring, logs, incident response |
| [10 - Security Operations](./10-security-operations.md) | Auth flow, secret rotation, security checklist |
| [11 - Backup & Recovery](./11-backup-and-recovery.md) | Backup strategy, restore procedures, disaster recovery |

## Architecture Overview

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend (API)  │────▶│    MySQL     │
│  React + TS  │     │  Express + TS    │     │  (Sequelize) │
│  Port: 5173  │     │  Port: 3000      │     │  Port: 3306  │
└──────────────┘     └────────┬─────────┘     └──────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   AI Service     │
                     │  FastAPI + OpenCV│
                     │  Port: 8000      │
                     └──────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   OpenAI API     │
                     │  GPT-4o / Mini   │
                     └──────────────────┘
```

## Quick Start

```bash
# 1. Backend
cd backend
cp .env.example .env   # Fill in values
npm install
npm run seed           # Populate DB with test data
npm run dev            # Starts on :3000

# 2. Frontend
cd frontend
npm install
npm run dev            # Starts on :5173

# 3. AI Service (optional, for image analysis)
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
