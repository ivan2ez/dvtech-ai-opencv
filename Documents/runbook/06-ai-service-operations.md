# 06 — AI Service Operations

## Overview

The AI Service is a Python/FastAPI microservice responsible for:
- Image preprocessing using OpenCV (resize, enhance, normalize)
- Preparing images before sending to OpenAI GPT-4o for analysis
- Providing a health check endpoint

The Node.js backend calls this service when the AI recommendation module needs to process room images.

---

## Service Details

| Property | Value |
|----------|-------|
| Framework | FastAPI |
| Language | Python 3.10+ |
| Port | 8000 (default) |
| Image processing | OpenCV |
| Entry point | `ai-service/app/main.py` |

---

## Endpoints

### Health Check

```
GET /health
```

### Image Analysis (Preprocessing)

```
POST /api/analyze-image
Content-Type: multipart/form-data

Form fields:
  - image: <file> (JPEG, PNG)
```

The service preprocesses the image (resize, contrast enhancement) and returns processed data ready for OpenAI API consumption.

---

## Starting the Service

### Development

```bash
cd ai-service
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Production

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Or with PM2:
```bash
pm2 start "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4" --name dvtech-ai-service
```

---

## Dependencies

```
fastapi==0.115.0
uvicorn==0.30.6
opencv-python==4.10.0.84
pydantic==2.9.2
python-multipart==0.0.12
```

### System Requirements for OpenCV

**Windows:** Usually works out of the box with pip.

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0
```

**Docker:**
```dockerfile
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0
```

---

## OpenAI Integration (Backend Side)

The AI intelligence layer lives in the Node.js backend, not this microservice. Key points:

| Feature | Model | Max Tokens |
|---------|-------|------------|
| Image Analysis & Recommendations | `gpt-4o` | 1000 |
| Chatbot | `gpt-4o-mini` | 500 |
| Troubleshooting | `gpt-4o-mini` / Gemini | 500 |

### Cost Control

- Set spending limits in OpenAI dashboard
- Images are compressed/resized before sending (via AI Service)
- Use `gpt-4o-mini` for non-vision tasks
- Implement retry with exponential backoff for rate limits

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'cv2'"

OpenCV not installed:
```bash
pip install opencv-python
```

### "ImportError: libGL.so.1"

Missing system library (Linux):
```bash
sudo apt-get install libgl1-mesa-glx
```

### Service unreachable from backend

1. Verify the AI service is running: `curl http://localhost:8000/health`
2. Check `AI_SERVICE_URL` in backend `.env` matches the actual host/port
3. If using Docker, services must be on the same network or use host networking
