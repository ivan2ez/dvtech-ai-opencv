import numpy as np
from typing import Tuple

from app.services.opencv_service import (
    resize_image,
    compress_image,
    enhance_image,
    get_image_dimensions,
)


def preprocess_image(
    image: np.ndarray,
    max_width: int = 1024,
    max_height: int = 1024,
    max_size_kb: int = 1024,
    quality: int = 85,
    enhance: bool = False,
) -> Tuple[bytes, dict]:
    """
    Run the full image preprocessing pipeline.

    Steps:
    1. Get original dimensions
    2. Resize to fit within max dimensions
    3. Optionally enhance the image
    4. Compress to target file size

    Args:
        image: Input image as numpy array (BGR format from OpenCV).
        max_width: Maximum width in pixels.
        max_height: Maximum height in pixels.
        max_size_kb: Maximum file size in kilobytes.
        quality: JPEG compression quality (1-100).
        enhance: Whether to apply image enhancement.

    Returns:
        Tuple of (processed image bytes, metadata dict).
    """
    original_width, original_height = get_image_dimensions(image)

    # Step 1: Resize
    resized = resize_image(image, max_width, max_height)

    # Step 2: Enhance (optional)
    if enhance:
        resized = enhance_image(resized)

    # Step 3: Compress
    processed_bytes = compress_image(resized, quality, max_size_kb)

    processed_width, processed_height = get_image_dimensions(resized)

    metadata = {
        "original_width": original_width,
        "original_height": original_height,
        "processed_width": processed_width,
        "processed_height": processed_height,
        "processed_size_kb": round(len(processed_bytes) / 1024, 2),
    }

    return processed_bytes, metadata
