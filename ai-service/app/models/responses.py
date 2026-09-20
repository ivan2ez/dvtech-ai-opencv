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


class RoomMetric(BaseModel):
    """
    A single discrete, labeled room metric line item.

    Each metric is a self-contained unit the backend can line-itemize directly
    into the BTU uplift breakdown, rather than having to interpret an opaque
    aggregate value. `key` is a stable machine identifier, `label` is a
    human-readable name, and `value` is the measured quantity/level.
    """

    key: str = Field(
        description="Stable machine identifier for the metric (e.g. 'window_count', 'insulation_quality', 'sunlight_level', 'heat_sources')"
    )
    label: str = Field(description="Human-readable label for the metric")
    value: Any = Field(
        description="Measured value for the metric (int, string level, or list)"
    )


class RoomAnalysisResponse(BaseModel):
    """Response model for OpenCV room analysis results."""

    success: bool = Field(description="Whether analysis was successful")

    # --- Discrete, labeled per-metric fields (consumed by the backend to
    # line-itemize the BTU uplift; each is a distinct labeled quantity rather
    # than an opaque appliance/aggregate count) ---
    window_count: int = Field(
        description="Discrete metric: estimated number of windows detected"
    )
    insulation_quality: str = Field(
        description="Discrete metric: insulation quality assessment — 'poor', 'fair', or 'good'"
    )
    sunlight_level: str = Field(
        description="Discrete metric: sunlight level — 'low', 'medium', or 'high'"
    )
    heat_sources: List[str] = Field(
        description="Discrete metric: labeled list of identified heat sources (e.g. 'lighting', 'electronics', 'direct sunlight'), each counted once — NOT lumped into a generic appliance count"
    )
    heat_source_count: int = Field(
        description="Discrete metric: number of distinct labeled heat sources detected"
    )

    # A flat list of the discrete metrics above, so the backend can iterate and
    # line-itemize each contribution without hardcoding field names.
    metrics: List[RoomMetric] = Field(
        default_factory=list,
        description="Flat list of the discrete labeled metrics (windows, insulation, sunlight, heat sources) for direct line-item consumption by the backend",
    )

    # --- Backward-compatible fields (retained so existing consumers keep working) ---
    sunlight_exposure: str = Field(
        description="Deprecated alias of sunlight_level, retained for backward compatibility: 'low', 'medium', or 'high'"
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
