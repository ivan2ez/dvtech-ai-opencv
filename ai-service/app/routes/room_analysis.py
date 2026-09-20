"""
Room Analysis API Route

Exposes the OpenCV room analysis pipeline as a REST endpoint.
Accepts an uploaded room image and returns structured analysis results
including window count, sunlight exposure, heat sources, and insulation quality.
"""

from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

from app.models.responses import RoomAnalysisResponse, ErrorResponse
from app.services.room_analysis import analyze_room
from app.services.opencv_service import resize_image
from app.utils.image_utils import decode_image_bytes, validate_image_file

router = APIRouter()


@router.post(
    "/analyze-room",
    response_model=RoomAnalysisResponse,
    responses={
        200: {"model": RoomAnalysisResponse, "description": "Room analysis results"},
        400: {"model": ErrorResponse, "description": "Invalid image input"},
        500: {"model": ErrorResponse, "description": "Internal processing error"},
    },
)
async def analyze_room_endpoint(
    file: UploadFile = File(..., description="Room image file to analyze"),
    max_width: int = Form(default=1280, description="Max width for preprocessing"),
    max_height: int = Form(default=1280, description="Max height for preprocessing"),
    include_details: bool = Form(
        default=False, description="Include detailed analysis metrics"
    ),
):
    """
    Analyze a room image using OpenCV algorithms to extract environmental
    characteristics relevant to HVAC/BTU calculations.

    Returns structured data including:
    - **window_count**: Estimated number of windows detected
    - **sunlight_exposure**: "low", "medium", or "high"
    - **heat_sources**: List of identified heat source categories
    - **insulation_quality**: "poor", "fair", or "good"
    - **brightness_score**: Overall brightness (0.0-1.0)
    - **contrast_score**: Image contrast metric (0.0-1.0)
    - **warm_area_ratio**: Ratio of warm-colored areas (0.0-1.0)
    """
    # Validate the uploaded file
    file_content = await file.read()
    is_valid, error_message = validate_image_file(file.content_type, len(file_content))

    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    try:
        # Decode the image bytes into an OpenCV array
        image = decode_image_bytes(file_content)

        # Resize for consistent analysis (maintain aspect ratio)
        image = resize_image(image, max_width=max_width, max_height=max_height)

        # Run the full room analysis pipeline
        result = analyze_room(image)

        # Build response
        response_data = {
            "success": True,
            "window_count": result.window_count,
            "sunlight_exposure": result.sunlight_exposure,
            "heat_sources": result.heat_sources,
            "insulation_quality": result.insulation_quality,
            "brightness_score": result.brightness_score,
            "contrast_score": result.contrast_score,
            "warm_area_ratio": result.warm_area_ratio,
        }

        if include_details:
            response_data["details"] = result.details

        return JSONResponse(content=response_data)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Room analysis failed: {str(e)}"
        )
