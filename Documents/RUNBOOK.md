# DVTech AI System — Application Runbook

**Last Updated:** September 2, 2026  
**Author:** DVTech Development Team

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup (First Time Only)](#initial-setup-first-time-only)
4. [Database Setup](#database-setup)
5. [Backend Setup](#backend-setup)
6. [AI Service Setup (Python/OpenCV)](#ai-service-setup-pythonopencv)
7. [Frontend Setup](#frontend-setup)
8. [Running the Complete Application](#running-the-complete-application)
9. [Testing the System](#testing-the-system)
10. [Troubleshooting](#troubleshooting)
11. [Stopping the Application](#stopping-the-application)

---

## System Overview

The DVTech AI system consists of four main components:

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| **Frontend** | React.js + TypeScript | 5173 | User interface |
| **Backend API** | Node.js + Express | 3000 | Business logic & REST API |
| **AI Service** | Python + FastAPI + OpenCV | 8000 | Image processing & OpenAI integration |
| **Database** | MySQL | 3306 | Data persistence |

---

## Prerequisites

### Required Software

1. **Node.js** v18+ and npm
   - Download: https://nodejs.org/
   - Verify: `node --version` and `npm --version`

2. **Python** 3.9+ and pip
   - Download: https://www.python.org/downloads/
   - Verify: `python --version` and `pip --version`

3. **MySQL** 5.7+ or 8.0+
   - Download: https://dev.mysql.com/downloads/installer/
   - Alternative: MySQL Workbench for GUI management
   - Verify: MySQL service is running

4. **Git** (for version control)
   - Download: https://git-scm.com/downloads

### Required API Keys

- **OpenAI API Key** — Get from https://platform.openai.com/api-keys
- **Google Gemini API Key** (optional) — Get from https://makersuite.google.com/app/apikey

---

## Initial Setup (First Time Only)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd dvtech-ai
```

### 2. Install Dependencies

#### Backend Dependencies
```bash
cd backend
npm install
```

#### Frontend Dependencies
```bash
cd ../frontend
npm install
```

#### AI Service Dependencies
```bash
cd ../ai-service
pip install -r requirements.txt
```

---

## Database Setup

### Step 1: Start MySQL Server

**Windows:**
- Open Services (`services.msc`)
- Find "MySQL" service and start it
- Or use MySQL Workbench to start the server

**macOS/Linux:**
```bash
# macOS (with Homebrew)
brew services start mysql

# Linux
sudo systemctl start mysql
```

### Step 2: Create Database

**Option A: Using MySQL Workbench (Recommended)**

1. Open MySQL Workbench
2. Connect to your MySQL instance (Local instance MySQL97 or similar)
3. Open a new SQL tab
4. Run:
   ```sql
   CREATE DATABASE IF NOT EXISTS dvtech_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
5. Verify the database appears in the left sidebar

**Option B: Using MySQL Command Line**

```bash
mysql -u root -p
```

Then in MySQL prompt:
```sql
CREATE DATABASE IF NOT EXISTS dvtech_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
EXIT;
```

### Step 3: Configure Database Connection

1. Navigate to backend folder:
   ```bash
   cd backend
   ```

2. Copy environment template:
   ```bash
   copy .env.example .env
   ```

3. Edit `.env` file with your MySQL credentials:
   ```env
   # Database (MySQL)
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USERNAME=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=dvtech_ai
   DB_NAME_TEST=dvtech_ai_test
   ```

4. Add your API keys:
   ```env
   # JWT Authentication
   JWT_SECRET=your_random_secret_key_here
   
   # OpenAI API
   OPENAI_API_KEY=sk-your-openai-api-key-here
   
   # Google Gemini API (optional)
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

### Step 4: Run Database Migrations

```bash
npm run db:migrate
```

**Expected Output:**
```
✓ All migrations executed successfully
```

### Step 5: Seed Database with Test Data

```bash
npm run seed
```

**Expected Output:**
```
✅ All mock data seeded successfully!
─────────────────────────────────────
Login credentials (all users):
  Password: Password123
  Admin:    admin@dvtech.com
  Tech:     juan@dvtech.com, pedro@dvtech.com, ...
  Customer: customer1@email.com ... customer4@email.com
─────────────────────────────────────
```

**Important:** Save these credentials! You'll need them to log in.

**What's Seeded:**
- 10 users (1 admin, 5 technicians, 4 customers)
- 10 service types (Installation, Maintenance, Repair, etc.)
- 10 brands (Carrier, Panasonic, Samsung, LG, Daikin, etc.)
- **15 AC products** including multiple options in the 18000 BTU range for diverse recommendations
- BTU factors for room assessment calculations
- Sample service requests and room assessments
- Sample AI recommendations with **multiple product options** (3+ brands per recommendation)

---

## Backend Setup

### Step 1: Configure Environment

The `.env` file should already be configured from the Database Setup step. Verify all required variables are set:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (MySQL)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=dvtech_ai

# JWT Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# AI Microservice
AI_SERVICE_URL=http://localhost:8000

# CORS
FRONTEND_URL=http://localhost:5173
```

### Step 2: Test Backend Connection

```bash
npm run dev
```

**Expected Output:**
```
Database connection established.
Server is running on port 3000
```

If you see this, the backend is ready! Press `Ctrl+C` to stop for now.

---

## AI Service Setup (Python/OpenCV)

### Step 1: Navigate to AI Service Directory

```bash
cd ai-service
```

### Step 2: Create Virtual Environment (Recommended)

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Python Dependencies

```bash
pip install -r requirements.txt
```

**Expected Packages:**
- fastapi
- uvicorn
- opencv-python
- pillow
- numpy
- python-multipart
- openai

### Step 4: Configure Environment

Create `.env` file in `ai-service` folder:

```bash
copy .env.example .env
```

Edit the `.env` file:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
PORT=8000
```

### Step 5: Test AI Service

```bash
uvicorn app.main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

**Test the health endpoint:**

Open a browser and go to: http://localhost:8000/health

You should see:
```json
{
  "status": "healthy",
  "service": "DVTech AI Image Analysis Service"
}
```

### Step 6: Test OpenCV Setup (Optional)

Run the OpenCV test script to verify image processing is working:

```bash
python test_opencv.py
```

**Expected Output:**
```
Testing OpenCV installation...
✓ OpenCV version: 4.x.x
✓ NumPy version: 1.x.x
✓ Successfully loaded test image
✓ Image shape: (height, width, 3)
✓ OpenCV is properly configured
All tests passed!
```

**What this tests:**
- OpenCV installation and imports
- Image loading capabilities
- NumPy integration
- Basic image processing operations

**If you see errors:** Reinstall OpenCV with `pip install opencv-python --upgrade`

Press `Ctrl+C` to stop the server for now.

---

## Frontend Setup

### Step 1: Navigate to Frontend Directory

```bash
cd frontend
```

### Step 2: Configure Environment

Create `.env` file:

```bash
copy .env.example .env
```

Edit the `.env` file:

```env
VITE_API_URL=http://localhost:3000/api
```

### Step 3: Test Frontend

```bash
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Open browser to http://localhost:5173 — you should see the DVTech homepage.

Press `Ctrl+C` to stop for now.

---

## Running the Complete Application

You need **4 terminal windows** to run all services simultaneously.

### Terminal 1: Database

**Ensure MySQL is running:**

- **Windows:** Check Services or MySQL Workbench
- **macOS:** `brew services list` should show MySQL as "started"
- **Linux:** `sudo systemctl status mysql`

No terminal needed if MySQL is running as a service.

### Terminal 2: Backend API

```bash
cd backend
npm run dev
```

**Wait for:**
```
Database connection established.
Server is running on port 3000
```

### Terminal 3: AI Service (Python)

```bash
cd ai-service
# Activate virtual environment if you created one
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

uvicorn app.main:app --reload --port 8000
```

**Wait for:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Terminal 4: Frontend

```bash
cd frontend
npm run dev
```

**Wait for:**
```
➜  Local:   http://localhost:5173/
```

---

## Testing the System

### Automated Test Scripts

The system includes several PowerShell test scripts for automated testing:

#### 1. Test AI Recommendation (Multi-Product)
**File:** `backend/test-simple.ps1`

Tests the AI recommendation system with a sample room assessment:
```powershell
cd backend
.\test-simple.ps1
```

**What it tests:**
- User authentication
- Room assessment submission
- AI recommendation generation
- Multiple product recommendations (3+ distinct brands)
- BTU calculation accuracy

**Expected Result:** Displays recommendation with 3+ product options from different brands

#### 2. Test Chatbot (Gemini-Powered)
**File:** `backend/test-chatbot.ps1`

Tests the conversational AI chatbot with multiple scenarios:
```powershell
cd backend
.\test-chatbot.ps1
```

**What it tests:**
- AC-related questions (should work)
- Room recommendation flow (should work)
- Off-topic questions - refrigerator, weather (should redirect to AC topics)
- Topic guard functionality

**Expected Result:** 
- AC questions answered correctly
- Non-AC topics politely redirected with AC-focused message

#### 3. Test OpenCV Setup
**File:** `ai-service/test_opencv.py`

Tests Python OpenCV installation and image processing:
```bash
cd ai-service
python test_opencv.py
```

**What it tests:**
- OpenCV module import
- NumPy integration
- Image loading capabilities
- Basic image operations

**Expected Result:** All checks pass with version information displayed

### 1. Access the Application

Open your browser to: **http://localhost:5173**

### 2. Test User Login

Click **"Login"** and use these credentials:

**Admin User:**
- Email: `admin@dvtech.com`
- Password: `Password123`

**Technician:**
- Email: `juan@dvtech.com`
- Password: `Password123`

**Customer:**
- Email: `customer1@email.com`
- Password: `Password123`

### 3. Test Core Features

#### As Customer:
1. **Browse Products** — Navigate to Products page, verify AC units display (15 products including multiple 18000 BTU options)
2. **Browse Services** — Navigate to Services page, verify service types display
3. **AI Recommendation** — Submit room details (area, ceiling height, occupancy, sunlight level)
   - **Verify multiple product recommendations** — System should return 3+ distinct brand options matching your requirements
4. **Upload Image** — Test image analysis feature with a room photo
5. **Service Request** — Book a service and verify it appears in your requests
6. **AI Chatbot** — Test the conversational AI assistant (AC-related topics only)
   - Try asking: "What services does DVTech offer?"
   - Try room detail collection: "I need help choosing an AC for my bedroom"
   - Try off-topic question: "What's the weather?" (should be redirected)

#### As Admin:
1. **Approve Requests** — View pending service requests and approve them
2. **Assign Technicians** — Assign approved requests to technicians
3. **Manage Products** — Add/edit/delete AC products
4. **Manage Services** — Add/edit/delete service types
5. **View Reports** — Generate and view service reports
6. **Manage BTU Factors** — Configure BTU calculation parameters

#### As Technician:
1. **View Assigned Tasks** — See tasks assigned to you
2. **Accept/Reject Tasks** — Accept or reject task assignments
3. **Update Status** — Change task status (in-progress, completed)
4. **Submit Reports** — Complete tasks and submit completion reports

### 4. Verify Backend Logs

Check Terminal 2 (Backend) for SQL queries executing successfully without errors.

### 5. Verify AI Service

Upload a room image in the AI recommendation feature — check Terminal 3 (AI Service) for processing logs.

---

## Troubleshooting

### Problem: "Cannot find module 'reflect-metadata'"

**Solution:**
```bash
cd backend
npm install
```

### Problem: "Unknown column 'logo_url' in field list"

**Solution:**
```bash
cd backend
npm run db:migrate
npm run seed
```

### Problem: OpenCV test fails or "cv2 module not found"

**Solution:**
```bash
cd ai-service
pip uninstall opencv-python opencv-python-headless
pip install opencv-python
python test_opencv.py
```

### Problem: Chatbot returns errors or doesn't respond

**Solution:**
1. Verify Gemini API key in `backend/.env`:
   ```env
   GEMINI_API_KEY=your-gemini-api-key-here
   ```
2. Check backend logs for API errors
3. The chatbot only responds to AC-related topics - off-topic questions are redirected

### Problem: AI Recommendation returns only 1 product instead of 3+

**Solution:**
1. Reseed the database to get the updated product catalog:
   ```bash
   cd backend
   npm run seed
   ```
2. The new seed includes 15 products with multiple options in each BTU range for diverse recommendations

### Problem: "Access denied for user 'root'@'localhost'"

**Solution:**
1. Verify MySQL password in `backend/.env`
2. Test MySQL connection:
   ```bash
   mysql -u root -p
   ```
3. If password is wrong, reset it in MySQL Workbench or via command line

### Problem: "Port 3000 is already in use"

**Solution:**
1. Find and kill the process using port 3000:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # macOS/Linux
   lsof -ti:3000 | xargs kill
   ```
2. Or change the port in `backend/.env`

### Problem: Frontend shows "Network Error" or cannot connect to API

**Solution:**
1. Verify backend is running on port 3000
2. Check `frontend/.env` has `VITE_API_URL=http://localhost:3000/api`
3. Check browser console for CORS errors
4. Verify `FRONTEND_URL=http://localhost:5173` in `backend/.env`

### Problem: AI Service fails to start

**Solution:**
1. Verify Python 3.9+ is installed: `python --version`
2. Reinstall dependencies:
   ```bash
   cd ai-service
   pip install -r requirements.txt
   ```
3. Verify OpenAI API key in `ai-service/.env`

### Problem: Database connection fails

**Solution:**
1. Verify MySQL service is running
2. Verify database `dvtech_ai` exists:
   ```sql
   SHOW DATABASES;
   ```
3. Verify credentials in `backend/.env` match MySQL
4. Check MySQL logs for errors

### Problem: Login shows "Invalid credentials"

**Solution:**
1. Verify you ran the seed script: `npm run seed`
2. Use password `Password123` (with capital P)
3. Check backend logs for authentication errors
4. Verify users exist in database:
   ```sql
   SELECT email FROM users;
   ```

### Problem: No products or services showing

**Solution:**
1. Reseed the database:
   ```bash
   cd backend
   npm run seed
   ```
2. Check browser Network tab for API errors
3. Verify backend SQL queries are executing (check Terminal 2 logs)

---

## Stopping the Application

### Stop Individual Services

1. **Frontend:** Press `Ctrl+C` in Terminal 4
2. **AI Service:** Press `Ctrl+C` in Terminal 3
3. **Backend:** Press `Ctrl+C` in Terminal 2
4. **Database:** (Optional) Stop MySQL service if not needed

### Stop All at Once

Close all terminal windows or press `Ctrl+C` in each.

### Stop MySQL Service (Optional)

**Windows:**
- Services → MySQL → Right-click → Stop

**macOS:**
```bash
brew services stop mysql
```

**Linux:**
```bash
sudo systemctl stop mysql
```

---

## Quick Start Commands (After Initial Setup)

Once everything is configured, use these commands to start the system:

**Terminal 1 (Backend):**
```bash
cd backend && npm run dev
```

**Terminal 2 (AI Service):**
```bash
cd ai-service && uvicorn app.main:app --reload --port 8000
```

**Terminal 3 (Frontend):**
```bash
cd frontend && npm run dev
```

Then open: **http://localhost:5173**

---

## System Health Check

Run these commands to verify all components are running:

```bash
# Backend Health
curl http://localhost:3000/api/health

# AI Service Health
curl http://localhost:8000/health

# Frontend (open in browser)
start http://localhost:5173

# Database Connection Test
mysql -u root -p -e "SELECT 1"
```

---

## Default Test Credentials

After seeding, use these credentials for testing:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dvtech.com | Password123 |
| Technician | juan@dvtech.com | Password123 |
| Technician | pedro@dvtech.com | Password123 |
| Customer | customer1@email.com | Password123 |
| Customer | customer2@email.com | Password123 |

---

## Production Deployment Notes

Before deploying to production:

1. ✅ Change all default passwords and JWT secrets
2. ✅ Use environment-specific `.env` files
3. ✅ Enable SSL/HTTPS for all services
4. ✅ Set `NODE_ENV=production`
5. ✅ Configure proper CORS origins (not `*`)
6. ✅ Set up proper logging and monitoring
7. ✅ Configure database backups
8. ✅ Use production-grade MySQL configuration
9. ✅ Set up API rate limiting
10. ✅ Review and harden security settings

---

## Support & Contact

For issues or questions:
- **Email:** support@dvtech.com
- **Documentation:** `/Documents` folder
- **Issue Tracker:** [Project Repository Issues]

---

**End of Runbook**
