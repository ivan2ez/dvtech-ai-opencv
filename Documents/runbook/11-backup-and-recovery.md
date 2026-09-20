# 11 — Backup & Recovery

## What to Back Up

| Item | Location | Frequency | Priority |
|------|----------|-----------|----------|
| MySQL database | MySQL server | Daily | Critical |
| Uploaded files | `backend/uploads/` | Daily | High |
| Environment files | `.env` (all services) | On change | Critical |
| Nginx config | `/etc/nginx/` | On change | Medium |
| PM2 config | `~/.pm2/` | On change | Low |

---

## Database Backup

### SQLite (Development Only)

```bash
# Simple file copy
copy backend\database.sqlite backend\database.sqlite.bak

# With timestamp
copy backend\database.sqlite "backend\backups\db_%DATE:~-4%%DATE:~3,2%%DATE:~0,2%.sqlite"
```

### MySQL (Production)

#### Manual Backup

```bash
# Full backup
mysqldump -u dvtech_app -p dvtech_ai > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
mysqldump -u dvtech_app -p dvtech_ai | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Specific tables only
mysqldump -u dvtech_app -p dvtech_ai Users ServiceRequests > partial_backup.sql
```

#### Automated Daily Backup (cron)

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2:00 AM)
0 2 * * * /usr/local/bin/backup-dvtech.sh >> /var/log/dvtech-backup.log 2>&1
```

**Backup script** (`/usr/local/bin/backup-dvtech.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/dvtech"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
mysqldump -u dvtech_app -p'your_password' dvtech_ai | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup uploaded files
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /var/www/dvtech/backend uploads/

# Remove backups older than retention period
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "[$DATE] Backup completed successfully"
```

Make executable:
```bash
chmod +x /usr/local/bin/backup-dvtech.sh
```

---

## Restore Procedures

### Restore MySQL Database

```bash
# From uncompressed backup
mysql -u dvtech_app -p dvtech_ai < backup_20260801_120000.sql

# From compressed backup
gunzip < backup_20260801_120000.sql.gz | mysql -u dvtech_app -p dvtech_ai
```

> **Warning:** This overwrites all current data. Take a backup of the current state first.

### Restore Uploaded Files

```bash
# Stop the backend first
pm2 stop dvtech-backend

# Restore files
tar -xzf uploads_20260801_020000.tar.gz -C /var/www/dvtech/backend/

# Restart
pm2 start dvtech-backend
```

---

## Disaster Recovery Plan

### Scenario: Complete Server Loss

**Recovery time objective (RTO):** 2-4 hours  
**Recovery point objective (RPO):** 24 hours (last backup)

**Steps:**

1. Provision new server with same OS and specs
2. Install prerequisites (Node.js 18+, Python 3.10+, MySQL 8, nginx, PM2)
3. Clone repository from Git
4. Restore `.env` files from secure storage (password manager, secrets vault)
5. Install dependencies:
   ```bash
   cd backend && npm ci --omit=dev
   cd ../frontend && npm ci && npm run build
   cd ../ai-service && pip install -r requirements.txt
   ```
6. Create MySQL database and user (see [03-database-operations.md](./03-database-operations.md))
7. Restore database from latest backup
8. Restore uploaded files from latest backup
9. Configure nginx (see [04-deployment.md](./04-deployment.md))
10. Start services with PM2
11. Verify health endpoints
12. Update DNS if server IP changed

### Scenario: Database Corruption

1. Stop the backend: `pm2 stop dvtech-backend`
2. Drop and recreate the database:
   ```sql
   DROP DATABASE dvtech_ai;
   CREATE DATABASE dvtech_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Restore from latest backup
4. Restart backend: `pm2 start dvtech-backend`
5. Check for data gaps (compare backup timestamp with incident time)

### Scenario: Accidental Data Deletion

1. Identify what was deleted and when
2. Stop write operations if possible (maintenance mode)
3. Restore from the most recent backup before the deletion
4. If partial restore needed, import to a temp database and selectively copy data

---

## Backup Verification

Test restores monthly to ensure backups are valid:

```bash
# Create test database
mysql -u root -p -e "CREATE DATABASE dvtech_ai_restore_test;"

# Restore to test database
gunzip < latest_backup.sql.gz | mysql -u root -p dvtech_ai_restore_test

# Verify data
mysql -u root -p dvtech_ai_restore_test -e "SELECT COUNT(*) FROM Users;"

# Clean up
mysql -u root -p -e "DROP DATABASE dvtech_ai_restore_test;"
```

---

## Off-Site Backup Storage

For production, store backups in at least one off-site location:

| Option | Cost | Setup |
|--------|------|-------|
| AWS S3 | ~$0.02/GB/month | `aws s3 cp backup.sql.gz s3://dvtech-backups/` |
| Google Drive | Free up to 15GB | rclone or gdrive CLI |
| External HDD | One-time | Manual periodic copy |

### S3 Upload Example

```bash
# Install AWS CLI, configure credentials
aws s3 cp "$BACKUP_DIR/db_$DATE.sql.gz" s3://dvtech-backups/database/
aws s3 cp "$BACKUP_DIR/uploads_$DATE.tar.gz" s3://dvtech-backups/uploads/
```
