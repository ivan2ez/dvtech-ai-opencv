from fastapi import APIRouter

from app.models.responses import HealthCheckResponse

router = APIRouter()


@router.get("/", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """Health check endpoint to verify the AI service is running."""
    return HealthCheckResponse(
        status="healthy",
        service="dvtech-ai-service",
        version="1.0.0",
    )
