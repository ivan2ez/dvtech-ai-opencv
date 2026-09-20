# DVTech AI — Quick Start Guide

## 🚀 Daily Startup (After Initial Setup)

Open **3 terminals** and run:

### Terminal 1: Backend
```bash
cd backend
npm run dev
```
Wait for: `Server is running on port 3000`

### Terminal 2: AI Service
```bash
cd ai-service
uvicorn app.main:app --reload --port 8000
```
Wait for: `Uvicorn running on http://127.0.0.1:8000`

### Terminal 3: Frontend
```bash
cd frontend
npm run dev
```
Wait for: `Local: http://localhost:5173/`

---

## 🌐 Access Application

Open browser: **http://localhost:5173**

---

## 🔑 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dvtech.com | Password123 |
| Tech | juan@dvtech.com | Password123 |
| Customer | customer1@email.com | Password123 |

---

## 🛠️ First Time Setup

See full instructions in `Documents/RUNBOOK.md`

**Quick version:**

1. **Install dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   cd ../ai-service && pip install -r requirements.txt
   ```

2. **Setup database:**
   - Create MySQL database: `dvtech_ai`
   - Configure `backend/.env` with MySQL credentials
   - Run: `cd backend && npm run db:migrate && npm run seed`

3. **Configure API keys:**
   - Add OpenAI API key to `backend/.env` and `ai-service/.env`

---

## ⚡ Common Commands

```bash
# Backend
npm run dev          # Start development server
npm run db:migrate   # Run database migrations
npm run seed         # Seed test data (includes 15 products with multi-brand recommendations)
npm test            # Run tests

# Frontend
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build

# AI Service
uvicorn app.main:app --reload --port 8000   # Start server
python test_opencv.py                        # Test OpenCV installation and image processing
```

---

## 🩺 Health Check

```bash
# Backend
curl http://localhost:3000/api/health

# AI Service
curl http://localhost:8000/health

# Frontend
start http://localhost:5173
```

---

## 🐛 Quick Troubleshooting

**Backend won't start:**
- Check MySQL is running
- Verify `.env` database credentials
- Run `npm install`

**Login fails:**
- Use password: `Password123` (capital P)
- Run `npm run seed` to reset users

**No products showing:**
- Run `npm run seed` in backend folder
- New seed includes 15 products with multiple brands per BTU range

**AI Service fails:**
- Check `ai-service/.env` has OpenAI/Gemini API key
- Run `pip install -r requirements.txt`
- Test OpenCV: `python test_opencv.py`

**Chatbot not responding:**
- Verify `GEMINI_API_KEY` in `backend/.env`
- Chatbot only responds to AC-related topics (will politely redirect off-topic questions)

**AI Recommendation returns only 1 product:**
- Reseed database: `npm run seed` (updated seed has multiple products per BTU range)

---

## 📚 Full Documentation

See `Documents/RUNBOOK.md` for detailed setup and troubleshooting.
