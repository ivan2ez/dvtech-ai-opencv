"""
Quick manual test for the OpenCV room analysis pipeline.

Usage:
  python test_opencv.py <path-to-room-image.jpg>

  Or run without arguments to generate a synthetic test image.
"""

import sys
import json
import cv2
import numpy as np

# Make sure the app package is on the path
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.services.room_analysis import (
    analyze_room,
    detect_windows,
    analyze_sunlight_exposure,
    detect_heat_sources,
    assess_insulation_quality,
    compute_warm_area_ratio,
    compute_contrast_score,
)
from app.services.opencv_service import resize_image


def create_synthetic_room_image() -> np.ndarray:
    """
    Generate a simple synthetic room image with:
    - A gray wall background
    - Two bright rectangular windows
    - A ceiling light (bright spot at top center)
    - A warm sunlight patch on the floor
    """
    height, width = 600, 800
    image = np.ones((height, width, 3), dtype=np.uint8) * 160  # Gray wall

    # Draw two windows (bright rectangles, upper area)
    cv2.rectangle(image, (80, 80), (230, 280), (240, 245, 255), -1)   # Left window
    cv2.rectangle(image, (570, 80), (720, 280), (240, 245, 255), -1)  # Right window

    # Draw window frames
    cv2.rectangle(image, (80, 80), (230, 280), (100, 100, 100), 3)
    cv2.rectangle(image, (570, 80), (720, 280), (100, 100, 100), 3)

    # Ceiling light (bright white spot at top center)
    cv2.circle(image, (400, 30), 40, (255, 255, 240), -1)

    # Floor area (slightly darker)
    image[450:, :] = 130

    # Warm sunlight patch on floor (from right window)
    sunlight_overlay = image.copy()
    cv2.rectangle(sunlight_overlay, (520, 460), (750, 590), (80, 190, 250), -1)
    cv2.addWeighted(sunlight_overlay, 0.4, image, 0.6, 0, image)

    return image


def run_tests(image: np.ndarray) -> None:
    """Run each analysis function individually and print results."""
    print("=" * 60)
    print("DVTech OpenCV Room Analysis — Test Run")
    print("=" * 60)
    print(f"Image size: {image.shape[1]}x{image.shape[0]} px\n")

    # --- Window Detection ---
    window_count, window_regions = detect_windows(image)
    print(f"[Window Detection]")
    print(f"  Windows detected: {window_count}")
    for i, r in enumerate(window_regions):
        print(f"  Window {i+1}: x={r['x']}, y={r['y']}, w={r['w']}, h={r['h']}, "
              f"brightness={r['brightness']:.1f}, rectangularity={r['rectangularity']:.2f}")
    print()

    # --- Sunlight Exposure ---
    exposure, brightness = analyze_sunlight_exposure(image)
    print(f"[Sunlight Exposure]")
    print(f"  Level: {exposure}")
    print(f"  Brightness score: {brightness:.4f}")
    print()

    # --- Heat Sources ---
    heat_sources = detect_heat_sources(image)
    print(f"[Heat Sources]")
    print(f"  Detected: {heat_sources if heat_sources else 'none'}")
    print()

    # --- Insulation Quality ---
    quality, metrics = assess_insulation_quality(image)
    print(f"[Insulation Quality]")
    print(f"  Quality: {quality}")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
    print()

    # --- Additional Metrics ---
    warm_ratio = compute_warm_area_ratio(image)
    contrast = compute_contrast_score(image)
    print(f"[Additional Metrics]")
    print(f"  Warm area ratio: {warm_ratio:.4f}")
    print(f"  Contrast score:  {contrast:.4f}")
    print()

    # --- Full Pipeline ---
    result = analyze_room(image)
    print("=" * 60)
    print("[Full Pipeline Result — JSON]")
    print("=" * 60)
    output = {
        "window_count": result.window_count,
        "sunlight_exposure": result.sunlight_exposure,
        "heat_sources": result.heat_sources,
        "insulation_quality": result.insulation_quality,
        "brightness_score": result.brightness_score,
        "contrast_score": result.contrast_score,
        "warm_area_ratio": result.warm_area_ratio,
    }
    print(json.dumps(output, indent=2))
    print()

    # --- Optionally save annotated image ---
    annotated = image.copy()
    for region in result.details.get("window_regions", []):
        x, y, w, h = region["x"], region["y"], region["w"], region["h"]
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(
            annotated, "window",
            (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1
        )

    out_path = "test_output_annotated.jpg"
    cv2.imwrite(out_path, annotated)
    print(f"Annotated image saved to: {out_path}")
    print("(Green boxes = detected windows)")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if not os.path.exists(image_path):
            print(f"Error: file not found: {image_path}")
            sys.exit(1)
        print(f"Loading image: {image_path}")
        image = cv2.imread(image_path)
        if image is None:
            print("Error: could not decode image. Check that it's a valid JPEG or PNG.")
            sys.exit(1)
    else:
        print("No image path provided — using synthetic test image.\n")
        image = create_synthetic_room_image()

    # Resize to standard analysis size
    image = resize_image(image, max_width=1280, max_height=1280)

    run_tests(image)
