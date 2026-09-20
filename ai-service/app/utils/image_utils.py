import cv2
import numpy as np
from typing import Optional, Tuple

# Supported image MIME types
SUPPORTED_CONTENT_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
]

# Maximum allowed upload size (10 MB)
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024


def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    """
    Decode raw image bytes into an OpenCV numpy array.

    Args:
        image_bytes: Raw image file bytes.

    Returns:
        Image as numpy array in BGR format.

    Raises:
        ValueError: If the image cannot be decoded.
    """
    np_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Unable to decode image. The file may be corrupted or unsupported.")

    return image


def validate_image_file(
    content_type: Optional[str], file_size: int
) -> Tuple[bool, str]:
    """
    Validate an uploaded image file.

    Args:
        content_type: MIME type of the uploaded file.
        file_size: Size of the file in bytes.

    Returns:
        Tuple of (is_valid, error_message). error_message is empty if valid.
    """
    if content_type and content_type not in SUPPORTED_CONTENT_TYPES:
        return False, f"Unsupported image type: {content_type}. Supported types: {', '.join(SUPPORTED_CONTENT_TYPES)}"

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        max_mb = MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        return False, f"File size exceeds maximum allowed size of {max_mb:.0f} MB."

    if file_size == 0:
        return False, "File is empty."

    return True, ""


def get_file_size_kb(data: bytes) -> float:
    """
    Get the size of bytes data in kilobytes.

    Args:
        data: Raw bytes.

    Returns:
        Size in kilobytes rounded to 2 decimal places.
    """
    return round(len(data) / 1024, 2)
