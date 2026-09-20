# 03 — Database Operations

## Overview

- **ORM:** Sequelize with sequelize-typescript decorators
- **Dev database:** SQLite (file: `backend/database.sqlite`)
- **Production database:** MySQL 8.0+
- **Models location:** `backend/src/models/`
- **Migrations:** `backend/src/database/migrations/`
- **Seeders:** `backend/src/database/seeders/`

---

## Database Schema

| Table | Description |
|-------|-------------|
| `Users` | All user accounts (admin, technician, customer) |
| `ServiceRequests` | Customer service booking requests |
| `RoomAssessments` | Room data for AI recommendations |
| `AiRecommendations` | AI-generated AC recommendations |
| `AirconProducts` | AC product catalog |
| `ProductImages` | Multiple images per product |
| `Brands` | AC brand management |
| `TechnicianDetails` | Technician specialization and availability |
| `TechnicianSchedules` | Task assignments and scheduling |
| `BtuFactors` | Configurable BTU calculation factors |
| `Reports` | Generated system reports |
| `ServiceTypes` | Available service types and pricing |

---

## Seeding (Development)

The seed script wipes all tables and repopulates with realistic test data.

```bash
cd backend
npm run seed
```

**What it does:**
1. Runs `sequelize.sync({ force: true })` — drops and recreates all tables
2. Creates 10 users (1 admin, 5 technicians, 4 customers)
3. Creates 10 service types, 10 brands, 10 products with images
4. Creates technician details, BTU factors, service requests, schedules, reports

> **Warning:** `npm run seed` destroys all existing data. Never run in production.

---

## Migrations

### Run All Pending Migrations

```bash
npm run db:migrate
```

### Undo Last Migration

```bash
npm run db:migrate:undo
```

### Undo All Migrations

```bash
npm run db:migrate:undo:all
```

### Creating a New Migration

```bash
npx sequelize-cli migration:generate --name describe-your-change
```

Migration files go in `src/database/migrations/` with timestamp-based naming.

---

## MySQL Production Setup

### Create Database

```sql
CREATE DATABASE dvtech_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dvtech_app'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON dvtech_ai.* TO 'dvtech_app'@'localhost';
FLUSH PRIVILEGES;
```

### Connection Configuration

Update `backend/.env`:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=dvtech_app
DB_PASSWORD=strong_password_here
DB_NAME=dvtech_ai
```

> The `connection.ts` currently defaults to SQLite. Switch the dialect to `mysql` and update the connection config for production.

---

## Backup & Restore

### SQLite (Development)

```bash
# Backup
copy backend\database.sqlite backend\database.sqlite.bak

# Restore
copy backend\database.sqlite.bak backend\database.sqlite
```

### MySQL (Production)

```bash
# Backup
mysqldump -u dvtech_app -p dvtech_ai > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
mysql -u dvtech_app -p dvtech_ai < backup_20260801_120000.sql
```

---

## Troubleshooting

### "SequelizeConnectionError: SQLITE_CANTOPEN"

The SQLite file is missing or the path is wrong. Run `npm run seed` to recreate it.

### "Table doesn't exist"

Migrations haven't run. Either:
- Run `npm run db:migrate`
- Or run `npm run seed` (which does `sync({ force: true })`)

### "ECONNREFUSED" (MySQL)

- Verify MySQL is running: `mysqladmin ping -u root`
- Check host/port in `.env` match your MySQL instance
- Ensure the database user has proper privileges
