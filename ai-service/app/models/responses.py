from pydantic import BaseModel, Field
from typing import Optional


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


class ErrorResponse(BaseModel):
    """Response model for error responses."""

    success: bool = Field(default=False, description="Always false for errors")
    error: str = Field(description="Error message")
    detail: Optional[str] = Field(
        default=None, description="Detailed error information"
    )
