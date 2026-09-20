from pydantic import BaseModel, Field
from typing import Optional


class ImagePreprocessRequest(BaseModel):
    """Request model for image preprocessing options."""

    max_width: int = Field(default=1024, description="Maximum width in pixels")
    max_height: int = Field(default=1024, description="Maximum height in pixels")
    max_file_size_kb: int = Field(
        default=1024, description="Maximum file size in kilobytes"
    )
    quality: int = Field(
        default=85, ge=1, le=100, description="JPEG compression quality (1-100)"
    )
    enhance: bool = Field(
        default=False, description="Whether to apply image enhancement"
    )
