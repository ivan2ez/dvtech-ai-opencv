from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health, image_analysis, room_analysis

app = FastAPI(
    title="DVTech AI Service",
    description="Image preprocessing microservice for DVTech AI-Powered AC Recommendation System",
    version="1.0.0",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to backend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health.router, tags=["Health"])
app.include_router(image_analysis.router, prefix="/api", tags=["Image Analysis"])
app.include_router(room_analysis.router, prefix="/api", tags=["Room Analysis"])
