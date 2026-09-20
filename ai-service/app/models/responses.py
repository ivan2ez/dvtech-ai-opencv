from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class HealthCheckResponse(BaseModel):
    """Response model for health check endpoint."""

    status: str = Field(description="Service health status")
    service: str = Field(description="Service name")
    version: str = Field(description="Service version")


class ImagePreprocessResponse(BaseModel):
    """Response model for preprocessed image results."""

    success: bool = Field(description="Whether preprocessing was successful")
    original_width: int = Field(description="Original image width in pixels")
    original_height: int = Field(description="Original image height in pixels")
    processed_width: int = Field(description="Processed image width in pixels")
    processed_height: int = Field(description="Processed image height in pixels")
    original_size_kb: float = Field(description="Original file size in kilobytes")
    processed_size_kb: float = Field(description="Processed file size in kilobytes")
    content_type: str = Field(description="MIME type of the processed image")
    message: str = Field(default="", description="Additional processing message")


class RoomAnalysisResponse(BaseModel):
    """Response model for OpenCV room analysis results."""

    success: bool = Field(description="Whether analysis was successful")
    window_count: int = Field(description="Estimated number of windows detected")
    sunlight_exposure: str = Field(
        description="Sunlight exposure level: 'low', 'medium', or 'high'"
    )
    heat_sources: List[str] = Field(
        description="List of identified heat source categories (e.g., 'lighting', 'electronics', 'direct sunlight')"
    )
    insulation_quality: str = Field(
        description="Insulation quality assessment: 'poor', 'fair', or 'good'"
    )
    brightness_score: float = Field(
        description="Overall image brightness score (0.0 to 1.0)"
    )
    contrast_score: float = Field(
        description="Image contrast metric (0.0 to 1.0)"
    )
    warm_area_ratio: float = Field(
        description="Ratio of warm-colored areas in the image (0.0 to 1.0)"
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Detailed analysis metrics (window regions, insulation breakdown) — only included when requested",
    )


class ErrorResponse(BaseModel):
    """Response model for error responses."""

    success: bool = Field(default=False, description="Always false for errors")
    error: str = Field(description="Error message")
    detail: Optional[str] = Field(
        default=None, description="Detailed error information"
    )
