# OpenCV Image Processing — Testing Runbook

## Overview

This runbook covers how to test the OpenCV room analysis pipeline at every level:
1. **Python microservice standalone** (no backend needed)
2. **Backend integration** (Python + Node.js together)
3. **Full stack via the UI** (Python + Node.js + React frontend)

---

## Prerequisites

| Component | Location | Port |
|-----------|----------|------|
| Python AI Service | `ai-service/` | 8000 |
| Node.js Backend | `backend/` | 3000 |
| React Frontend | `frontend/` | 5173 |

### One-time setup (already done if you followed earlier steps)

```powershell
# Create Python venv and install deps (from ai-service/ folder)
cd ai-service
"C:\Users\Ivan Inocencio\AppData\Local\Programs\Python\Python312\python.exe" -m venv venv
.\venv\Scripts\pip.exe install -r requirements.txt
```

---

## Level 1 — Test OpenCV Standalone (Python Only)

This tests the OpenCV algorithms in isolation. No backend, no AI key, no database needed.

### Start the Python service

```powershell
cd ai-service
.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

Confirm it's running: open `http://localhost:8000/docs` in your browser — you'll see the Swagger UI.

### Test with curl

```powershell
curl.exe -s -X POST "http://localhost:8000/api/analyze-room" ^
  -F "file=@C:\Users\Ivan Inocencio\OneDrive\Desktop\DVTechV2\dvtech-ai\Documents\room.jpg;type=image/jpeg" ^
  -F "include_details=true"
```

### Expected response

```json
{
  "success": true,
  "window_count": 0,
  "sunlight_exposure": "medium",
  "heat_sources": ["lighting", "electronics", "direct sunlight", "kitchen appliances"],
  "insulation_quality": "poor",
  "brightness_score": 0.6858,
  "contrast_score": 0.781,
  "warm_area_ratio": 0.3779,
  "details": {
    "window_regions": [],
    "insulation_metrics": {
      "edge_density": 0.144,
      "surface_variance_score": 0.4441,
      "bright_area_ratio": 0.4739,
      "color_consistency": 0.6398,
      "insulation_score": 0.3047
    }
  }
}
```

### What to verify

| Field | What it means | Good result |
|-------|---------------|-------------|
| `success` | Pipeline didn't crash | Must be `true` |
| `window_count` | Bright rectangular regions detected | 0+ (depends on photo) |
| `sunlight_exposure` | Overall brightness classification | "low", "medium", or "high" |
| `heat_sources` | Categories of heat-emitting regions found | Array of strings |
| `insulation_quality` | Surface uniformity assessment | "poor", "fair", or "good" |
| `brightness_score` | Mean brightness 0.0–1.0 | 0.3–0.5 = normal indoor |
| `contrast_score` | Pixel std dev normalized 0.0–1.0 | Higher = more light variation |
| `warm_area_ratio` | % of warm-colored pixels | >0.3 = significant heat gain |

### Test the preprocessing endpoint too

```powershell
curl.exe -s -X POST "http://localhost:8000/api/preprocess" ^
  -F "file=@C:\Users\Ivan Inocencio\OneDrive\Desktop\DVTechV2\dvtech-ai\Documents\room.jpg;type=image/jpeg" ^
  -F "enhance=true" ^
  -o processed_output.jpg
```

This saves the preprocessed image. Check that it's a valid JPEG and smaller than the original.

---

## Level 2 — Test Backend Integration (Python + Node.js)

This tests that the Node.js backend correctly calls the Python microservice and maps the response.

### Start both services

**Terminal 1 — Python:**
```powershell
cd ai-service
.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

**Terminal 2 — Backend:**
```powershell
cd backend
npm run dev
```

### Get a customer JWT token

```powershell
curl.exe -s -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"customer@test.com\",\"password\":\"Password123\"}"
```

Copy the `token` from the response.

### Submit a room assessment with image

```powershell
curl.exe -s -X POST http://localhost:3000/api/ai/room-assessment ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -F "area=25" ^
  -F "ceilingHeight=2.8" ^
  -F "occupancy=3" ^
  -F "sunlightLevel=moderate" ^
  -F "image=@C:\Users\Ivan Inocencio\OneDrive\Desktop\DVTechV2\dvtech-ai\Documents\room.jpg;type=image/jpeg"
```

### Expected response

```json
{
  "roomAssessment": {
    "id": 1,
    "area": 25,
    "ceilingHeight": 2.8,
    "occupancy": 3,
    "sunlightLevel": "moderate",
    "imagePath": "uploads/room-images/..."
  },
  "recommendation": {
    "totalBtu": 12000,
    "recommendedHp": 1.5,
    "unitType": "split-type",
    "reasoning": "Based on room area of 25 sqm... OpenCV detected warm area ratio of 0.38...",
    "troubleshootingNotes": "...",
    "product": { ... }
  },
  "opencvAnalysis": {
    "windowCount": 0,
    "sunlightExposure": "medium",
    "heatSources": ["lighting", "electronics", "direct sunlight"],
    "insulationQuality": "poor",
    "brightnessScore": 0.6858,
    "contrastScore": 0.781,
    "warmAreaRatio": 0.3779,
    "details": { ... }
  }
}
```

### What to verify

1. **`opencvAnalysis` is NOT null** — confirms the Python service was called
2. **`recommendation.reasoning` references OpenCV data** — mentions brightness, warm area, or insulation
3. **Check Terminal 1 (Python) logs** — you should see two incoming requests:
   ```
   INFO: POST /api/preprocess    → 200
   INFO: POST /api/analyze-room  → 200
   ```
4. **Without an image** — submit the same request without the `-F "image=..."` line; `opencvAnalysis` should be `null`

### Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| 503 "AI service is unreachable" | Python service not running | Start uvicorn on port 8000 |
| 503 "GEMINI_API_KEY not configured" | Missing API key in .env | Add your key to `backend/.env` |
| 422 "No BTU factors configured" | Empty BTU_FACTORS table | Add BTU factors via admin panel |
| 422 "No active products available" | Empty AIRCON_PRODUCTS table | Add products via admin panel |
| 429 "quota exceeded" | Gemini rate limit hit | Wait 1-2 minutes and retry |

---

## Level 3 — Test via the Frontend UI

### Start all three services

**Terminal 1 — Python:**
```powershell
cd ai-service
.\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

**Terminal 2 — Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 3 — Frontend:**
```powershell
cd frontend
npm run dev
```

### Steps

1. Open `http://localhost:5173` in your browser
2. Log in as a **customer** account
3. Navigate to **AI Recommendation** (`/ai-recommendation`)
4. Fill in the form:
   - Area: `25`
   - Ceiling Height: `2.8`
   - Occupancy: `4`
   - Sunlight Level: `Moderate`
   - Image: select `Documents/room.jpg`
5. Click **"Get AI Recommendation"**
6. Wait 10–30 seconds (Gemini + OpenCV processing)

### What you should see in the result

1. **Top stats row** — Total BTU, Recommended HP, Unit Type
2. **OpenCV Image Analysis panel** (bordered section with "Computer Vision" badge):
   - Windows Detected: number
   - Sunlight: colored badge (low/medium/high)
   - Insulation: colored badge (poor/fair/good)
   - Heat Sources: count + tag pills
   - Score bars: Brightness, Contrast, Warm Area Ratio
   - Blue info box: "How this affects your recommendation"
3. **Reasoning** — text explanation from Gemini mentioning OpenCV metrics
4. **Matched Product** — brand, model, BTU, HP, price

### What if the OpenCV panel doesn't appear?

- The panel only shows when `opencvAnalysis` is not null (i.e., an image was uploaded)
- Check the browser DevTools Network tab — look at the response body for the POST request
- If `opencvAnalysis` is null despite uploading an image, the Python service is likely not running

---

## Level 4 — Test OpenCV Algorithms Directly (Python Script)

For debugging individual algorithms without the HTTP layer:

```powershell
cd ai-service
.\venv\Scripts\python.exe test_opencv.py "C:\Users\Ivan Inocencio\OneDrive\Desktop\DVTechV2\dvtech-ai\Documents\room.jpg"
```

Or without an image (uses synthetic test image):
```powershell
.\venv\Scripts\python.exe test_opencv.py
```

This prints each algorithm's output individually and saves `test_output_annotated.jpg` with green boxes around detected windows.

---

## Quick Smoke Test Checklist

Run through this every time you make changes to the OpenCV code:

- [ ] Python service starts without errors (`uvicorn` shows "Application startup complete")
- [ ] `POST /api/analyze-room` returns `"success": true` with valid metrics
- [ ] `POST /api/preprocess` returns a valid JPEG smaller than the input
- [ ] Backend `POST /api/ai/room-assessment` returns `opencvAnalysis` not null when image is attached
- [ ] Frontend shows the OpenCV metrics panel after submitting with an image
- [ ] Frontend shows NO OpenCV panel when submitting without an image
- [ ] `recommendation.reasoning` text references image analysis data

---

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React)  :5173                                        │
│  /ai-recommendation page                                        │
│  → POST /api/ai/room-assessment (multipart form + image)        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Node.js/Express)  :3000                               │
│  aiController.ts → aiService.ts                                 │
│                                                                 │
│  1. createRoomAssessment() — saves to DB                        │
│  2. analyzeRoomImage() — Promise.all([                          │
│       preprocessImage()      → Python :8000/api/preprocess      │
│       analyzeRoomWithOpenCV()→ Python :8000/api/analyze-room    │
│     ])                                                          │
│  3. Gemini Vision — sends preprocessed image for semantic labels│
│  4. generateRecommendation() — Gemini text with both results    │
│  5. Returns { roomAssessment, recommendation, opencvAnalysis }  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Python AI Service (FastAPI)  :8000                              │
│                                                                 │
│  POST /api/preprocess     — resize, compress, enhance (OpenCV)  │
│  POST /api/analyze-room   — full OpenCV analysis pipeline:      │
│    • detect_windows()          — contour + threshold analysis   │
│    • analyze_sunlight_exposure() — HSV brightness scoring       │
│    • detect_heat_sources()     — color range detection          │
│    • assess_insulation_quality() — edge density + variance      │
│    • compute_warm_area_ratio() — warm pixel counting            │
│    • compute_contrast_score()  — std dev normalization          │
│                                                                 │
│  NO AI, NO API KEYS, NO INTERNET — pure local math on pixels   │
└─────────────────────────────────────────────────────────────────┘
```
