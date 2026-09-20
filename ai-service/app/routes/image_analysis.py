from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import Response

from app.models.requests import ImagePreprocessRequest
from app.models.responses import ImagePreprocessResponse, ErrorResponse
from app.services.preprocessing import preprocess_image
from app.utils.image_utils import (
    decode_image_bytes,
    validate_image_file,
    get_file_size_kb,
)

router = APIRouter()


@router.post(
    "/preprocess",
    responses={
        200: {"description": "Preprocessed image returned as binary with metadata headers"},
        400: {"model": ErrorResponse, "description": "Invalid image input"},
        500: {"model": ErrorResponse, "description": "Internal processing error"},
    },
)
async def preprocess_image_endpoint(
    file: UploadFile = File(..., description="Image file to preprocess"),
    max_width: int = Form(default=1024, description="Maximum width in pixels"),
    max_height: int = Form(default=1024, description="Maximum height in pixels"),
    max_file_size_kb: int = Form(default=1024, description="Maximum file size in KB"),
    quality: int = Form(default=85, description="JPEG compression quality (1-100)"),
    enhance: bool = Form(default=False, description="Apply image enhancement"),
):
    """
    Preprocess an uploaded image for AI analysis.

    Accepts an image file and applies:
    - Resizing to fit within max dimensions (maintaining aspect ratio)
    - Optional enhancement (contrast adjustment)
    - Compression to target file size

    Returns the processed image as JPEG binary data.
    """
    # Validate file
    file_content = await file.read()
    is_valid, error_message = validate_image_file(file.content_type, len(file_content))

    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    try:
        # Decode image
        image = decode_image_bytes(file_content)

        # Run preprocessing pipeline
        processed_bytes, metadata = preprocess_image(
            image=image,
            max_width=max_width,
            max_height=max_height,
            max_size_kb=max_file_size_kb,
            quality=quality,
            enhance=enhance,
        )

        # Return processed image as binary response with metadata in headers
        return Response(
            content=processed_bytes,
            media_type="image/jpeg",
            headers={
                "X-Original-Width": str(metadata["original_width"]),
                "X-Original-Height": str(metadata["original_height"]),
                "X-Processed-Width": str(metadata["processed_width"]),
                "X-Processed-Height": str(metadata["processed_height"]),
                "X-Original-Size-KB": str(get_file_size_kb(file_content)),
                "X-Processed-Size-KB": str(metadata["processed_size_kb"]),
            },
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Image processing failed: {str(e)}"
        )
