import cv2
import numpy as np
from typing import Tuple


def resize_image(
    image: np.ndarray, max_width: int = 1024, max_height: int = 1024
) -> np.ndarray:
    """
    Resize an image while maintaining aspect ratio.
    The image will be scaled down if it exceeds max_width or max_height.

    Args:
        image: Input image as numpy array (BGR format).
        max_width: Maximum width in pixels.
        max_height: Maximum height in pixels.

    Returns:
        Resized image as numpy array.
    """
    height, width = image.shape[:2]

    if width <= max_width and height <= max_height:
        return image

    scale_w = max_width / width
    scale_h = max_height / height
    scale = min(scale_w, scale_h)

    new_width = int(width * scale)
    new_height = int(height * scale)

    resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    return resized


def compress_image(
    image: np.ndarray, quality: int = 85, max_size_kb: int = 1024
) -> bytes:
    """
    Compress an image to JPEG format with the specified quality.
    If the result exceeds max_size_kb, iteratively reduce quality.

    Args:
        image: Input image as numpy array (BGR format).
        quality: Initial JPEG compression quality (1-100).
        max_size_kb: Maximum file size in kilobytes.

    Returns:
        Compressed image as bytes.
    """
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    _, buffer = cv2.imencode(".jpg", image, encode_params)
    result = buffer.tobytes()

    # Iteratively reduce quality if size exceeds limit
    while len(result) > max_size_kb * 1024 and quality > 10:
        quality -= 5
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        _, buffer = cv2.imencode(".jpg", image, encode_params)
        result = buffer.tobytes()

    return result


def enhance_image(image: np.ndarray) -> np.ndarray:
    """
    Apply basic image enhancement for better AI analysis.
    Includes contrast adjustment and slight sharpening.

    Args:
        image: Input image as numpy array (BGR format).

    Returns:
        Enhanced image as numpy array.
    """
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)

    enhanced_lab = cv2.merge([l_channel, a_channel, b_channel])
    enhanced = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

    return enhanced


def get_image_dimensions(image: np.ndarray) -> Tuple[int, int]:
    """
    Get the width and height of an image.

    Args:
        image: Input image as numpy array.

    Returns:
        Tuple of (width, height).
    """
    height, width = image.shape[:2]
    return width, height
