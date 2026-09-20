# 01 — Local Development Setup

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Backend & Frontend runtime |
| npm | 9+ | Package management |
| Python | 3.10+ | AI microservice |
| MySQL | 8.0+ | Production database |
| Git | 2.x | Version control |

> **Note:** The backend currently uses SQLite for local development. MySQL is required for production.

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd dvtech-ai
```

---

## 2. Backend Setup

```bash
cd backend
```

### Install Dependencies

```bash
npm install
```

> If you encounter peer dependency conflicts with TypeScript 7 and ts-jest, use the recommended alias approach:
> ```bash
> npm install --save-dev "@typescript/native@npm:typescript@^7.0.2" "typescript@npm:@typescript/typescript6@^6.0.2"
> ```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values (see [02-environment-variables.md](./02-environment-variables.md) for details).

### Initialize Database

```bash
# Run migrations (for MySQL setup)
npm run db:migrate

# OR seed with test data (uses sync + force, recreates all tables)
npm run seed
```

### Start Development Server

```bash
npm run dev
```

Backend runs at `http://localhost:3000`. Verify with:
```bash
curl http://localhost:3000/api/health
```

---

## 3. Frontend Setup

```bash
cd frontend
```

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## 4. AI Service Setup (Optional)

The AI microservice handles image preprocessing with OpenCV before sending to OpenAI. It's optional for basic development.

```bash
cd ai-service
```

### Create Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Configure Environment

```bash
cp .env.example .env
```

### Start Service

```bash
uvicorn app.main:app --reload --port 8000
```

AI service runs at `http://localhost:8000`. Health check:
```bash
curl http://localhost:8000/health
```

---

## 5. Verify Full Stack

| Service | URL | Expected |
|---------|-----|----------|
| Frontend | http://localhost:5173 | Login page loads |
| Backend API | http://localhost:3000/api/health | `{"status": "ok"}` |
| AI Service | http://localhost:8000/health | Health response |

---

## Common Development Commands

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run lint` | Type-check without emit |
| `npm run test` | Run Jest tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run seed` | Reset DB and populate with test data |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:migrate:undo` | Undo last migration |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build |
| `npm run test:e2e` | Run Playwright E2E tests |
