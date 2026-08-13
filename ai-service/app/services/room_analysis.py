"""
Room Analysis Service — OpenCV Image Processing Algorithms

Analyzes room images to extract environmental characteristics relevant
to HVAC/BTU calculations:
- Window detection and counting
- Sunlight exposure level estimation
- Heat source identification
- Insulation quality assessment

These results supplement the AI (OpenAI) vision analysis with
deterministic, reproducible computer vision metrics.
"""

import cv2
import numpy as np
from typing import List, Tuple
from dataclasses import dataclass, field


@dataclass
class RoomAnalysisResult:
    """Structured result from OpenCV room image analysis."""

    window_count: int
    sunlight_exposure: str  # "low", "medium", "high"
    heat_sources: List[str]
    insulation_quality: str  # "poor", "fair", "good"
    brightness_score: float  # 0.0 - 1.0
    contrast_score: float  # 0.0 - 1.0
    warm_area_ratio: float  # 0.0 - 1.0 (ratio of warm-colored pixels)
    details: dict = field(default_factory=dict)


# --- Window Detection ---


def detect_windows(image: np.ndarray) -> Tuple[int, List[dict]]:
    """
    Detect windows in a room image using edge detection and contour analysis.

    Strategy:
    1. Convert to grayscale and apply adaptive thresholding to find
       bright rectangular regions (windows tend to be brighter than walls).
    2. Use Canny edge detection + contour finding to identify rectangular shapes.
    3. Filter contours by aspect ratio, area, and position (upper portion of image).

    Args:
        image: Input image in BGR format.

    Returns:
        Tuple of (window_count, list of window region dicts with x, y, w, h).
    """
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive threshold to isolate bright regions (windows are typically bright)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, -2
    )

    # Morphological operations to clean up the mask
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Minimum and maximum area thresholds (relative to image size)
    image_area = height * width
    min_area = image_area * 0.01  # At least 1% of image
    max_area = image_area * 0.40  # At most 40% of image

    window_regions: List[dict] = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue

        # Approximate the contour to a polygon
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)

        # Windows are typically rectangular (4 corners) or near-rectangular
        if len(approx) < 4 or len(approx) > 8:
            continue

        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)

        # Aspect ratio filter: windows are usually wider than tall or square-ish
        aspect_ratio = w / h if h > 0 else 0
        if aspect_ratio < 0.3 or aspect_ratio > 4.0:
            continue

        # Rectangularity: how much the contour fills its bounding rect
        rect_area = w * h
        rectangularity = area / rect_area if rect_area > 0 else 0
        if rectangularity < 0.5:
            continue

        # Check brightness inside the region — windows are bright
        roi = gray[y : y + h, x : x + w]
        mean_brightness = np.mean(roi)

        # The region should be significantly brighter than the overall image mean
        overall_mean = np.mean(gray)
        if mean_brightness < overall_mean * 1.1:
            continue

        # Position heuristic: windows are typically in upper 2/3 of image
        center_y = y + h / 2
        if center_y > height * 0.85:
            continue

        window_regions.append(
            {
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h),
                "brightness": float(mean_brightness),
                "rectangularity": float(rectangularity),
            }
        )

    # Remove overlapping detections (non-maximum suppression)
    window_regions = _nms_rectangles(window_regions, overlap_thresh=0.3)

    return len(window_regions), window_regions


def _nms_rectangles(regions: List[dict], overlap_thresh: float = 0.3) -> List[dict]:
    """Simple non-maximum suppression for rectangular regions."""
    if not regions:
        return []

    # Sort by brightness (higher first — more likely to be a real window)
    regions = sorted(regions, key=lambda r: r["brightness"], reverse=True)

    kept: List[dict] = []
    for region in regions:
        is_duplicate = False
        for existing in kept:
            overlap = _compute_overlap(region, existing)
            if overlap > overlap_thresh:
                is_duplicate = True
                break
        if not is_duplicate:
            kept.append(region)

    return kept


def _compute_overlap(r1: dict, r2: dict) -> float:
    """Compute IoU (Intersection over Union) between two rectangles."""
    x1 = max(r1["x"], r2["x"])
    y1 = max(r1["y"], r2["y"])
    x2 = min(r1["x"] + r1["w"], r2["x"] + r2["w"])
    y2 = min(r1["y"] + r1["h"], r2["y"] + r2["h"])

    if x2 <= x1 or y2 <= y1:
        return 0.0

    intersection = (x2 - x1) * (y2 - y1)
    area1 = r1["w"] * r1["h"]
    area2 = r2["w"] * r2["h"]
    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0.0


# --- Sunlight Exposure Analysis ---


def analyze_sunlight_exposure(image: np.ndarray) -> Tuple[str, float]:
    """
    Estimate the sunlight exposure level in a room image.

    Strategy:
    1. Convert to HSV color space and analyze the Value (brightness) channel.
    2. Compute brightness histogram distribution.
    3. Detect high-intensity regions that indicate direct sunlight.
    4. Analyze the warm color temperature (yellows/oranges indicate sunlight).

    Args:
        image: Input image in BGR format.

    Returns:
        Tuple of (exposure_level: "low"|"medium"|"high", brightness_score: 0.0-1.0)
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h_channel, s_channel, v_channel = cv2.split(hsv)

    # Overall brightness score (normalized mean of V channel)
    brightness_score = float(np.mean(v_channel)) / 255.0

    # Percentage of very bright pixels (potential direct sunlight)
    bright_thresh = 200
    bright_pixel_ratio = float(np.sum(v_channel > bright_thresh)) / v_channel.size

    # Detect warm sunlight tones (yellow/orange hues with high saturation and value)
    # In OpenCV HSV: H is 0-179, S is 0-255, V is 0-255
    # Yellow hues: ~20-40, Orange: ~10-20
    warm_mask = cv2.inRange(hsv, (10, 50, 150), (45, 255, 255))
    warm_ratio = float(np.sum(warm_mask > 0)) / warm_mask.size

    # Detect bright white areas (overexposed from direct sunlight)
    white_mask = cv2.inRange(hsv, (0, 0, 220), (179, 40, 255))
    white_ratio = float(np.sum(white_mask > 0)) / white_mask.size

    # Combined sunlight score
    sunlight_score = (
        brightness_score * 0.3
        + bright_pixel_ratio * 0.3
        + warm_ratio * 0.2
        + white_ratio * 0.2
    )

    # Classify exposure level
    if sunlight_score > 0.45:
        exposure_level = "high"
    elif sunlight_score > 0.25:
        exposure_level = "medium"
    else:
        exposure_level = "low"

    return exposure_level, brightness_score


# --- Heat Source Detection ---


def detect_heat_sources(image: np.ndarray) -> List[str]:
    """
    Identify potential heat sources in a room image using color analysis
    and region characteristics.

    Strategy:
    1. Detect warm/hot colored regions (reds, oranges, whites from lights).
    2. Identify bright artificial light sources (ceiling lights, lamps).
    3. Detect electronic device indicators (screens with blue glow).
    4. Look for sunlight patches on floors/surfaces.

    Args:
        image: Input image in BGR format.

    Returns:
        List of identified heat source categories.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    height, width = image.shape[:2]
    heat_sources: List[str] = []

    # 1. Detect artificial lighting (very bright, low-saturation spots)
    bright_mask = cv2.inRange(hsv, (0, 0, 230), (179, 60, 255))
    bright_ratio = float(np.sum(bright_mask > 0)) / bright_mask.size

    # Check if bright spots are concentrated in upper part (ceiling lights)
    upper_region = bright_mask[: height // 3, :]
    upper_bright_ratio = float(np.sum(upper_region > 0)) / upper_region.size

    if upper_bright_ratio > 0.02:
        heat_sources.append("lighting")

    # 2. Detect electronics / screens (blue-tinted glow regions)
    blue_screen_mask = cv2.inRange(hsv, (90, 30, 100), (130, 255, 255))
    blue_contours, _ = cv2.findContours(
        blue_screen_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    significant_blue_regions = [
        c for c in blue_contours if cv2.contourArea(c) > (height * width * 0.005)
    ]
    if significant_blue_regions:
        heat_sources.append("electronics")

    # 3. Detect direct sunlight patches (warm, bright patches typically on lower areas)
    # Sunlight on surfaces appears as warm, high-value patches
    sunlight_mask = cv2.inRange(hsv, (15, 40, 200), (50, 255, 255))
    lower_half = sunlight_mask[height // 2 :, :]
    sunlight_ratio = float(np.sum(lower_half > 0)) / lower_half.size

    if sunlight_ratio > 0.03:
        heat_sources.append("direct sunlight")

    # 4. Detect kitchen/cooking indicators (warm reds and oranges)
    # Strong red/orange areas might indicate kitchen appliances or heating elements
    warm_red_mask = cv2.inRange(hsv, (0, 100, 100), (10, 255, 255))
    warm_orange_mask = cv2.inRange(hsv, (10, 100, 100), (25, 255, 255))
    combined_warm = cv2.bitwise_or(warm_red_mask, warm_orange_mask)
    warm_heat_ratio = float(np.sum(combined_warm > 0)) / combined_warm.size

    if warm_heat_ratio > 0.02:
        heat_sources.append("kitchen appliances")

    # 5. Detect large glass areas (potential heat gain from outside)
    # Glass tends to show high contrast edges with bright exterior visible
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    # Large bright regions adjacent to edges may indicate glass
    bright_near_edges = cv2.dilate(edges, None, iterations=3)
    v_channel = hsv[:, :, 2]
    glass_indicator = cv2.bitwise_and(v_channel, v_channel, mask=bright_near_edges)
    glass_bright_ratio = float(np.sum(glass_indicator > 180)) / glass_indicator.size

    if glass_bright_ratio > 0.01 and bright_ratio > 0.05:
        if "direct sunlight" not in heat_sources:
            heat_sources.append("large windows/glass")

    return heat_sources


# --- Insulation Quality Assessment ---


def assess_insulation_quality(image: np.ndarray) -> Tuple[str, dict]:
    """
    Assess the insulation quality of a room based on visual indicators.

    Strategy:
    1. Edge density analysis — more edges may indicate gaps, cracks, or rough surfaces
       (poor insulation has visible gaps and uneven surfaces).
    2. Uniformity of wall regions — well-insulated rooms have smoother, more uniform walls.
    3. Window-to-wall ratio — more glass area means lower thermal insulation.
    4. Color temperature consistency — drafty rooms may show uneven lighting.

    Args:
        image: Input image in BGR format.

    Returns:
        Tuple of (quality_level: "poor"|"fair"|"good", detail_metrics dict)
    """
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 1. Edge density — indicator of surface quality
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0)) / edges.size

    # 2. Surface uniformity (using standard deviation of local regions)
    # Lower std dev in wall areas suggests smoother, better-maintained surfaces
    # Divide image into a grid and check variance
    block_size = 32
    variances = []
    for y in range(0, height - block_size, block_size):
        for x in range(0, width - block_size, block_size):
            block = gray[y : y + block_size, x : x + block_size]
            variances.append(np.var(block))

    mean_variance = float(np.mean(variances)) if variances else 0.0
    # Normalize variance to 0-1 range (higher is less uniform)
    variance_score = min(mean_variance / 2000.0, 1.0)

    # 3. Window-to-wall ratio (using brightness-based window detection)
    # More windows = more heat loss potential
    v_channel = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)[:, :, 2]
    very_bright = float(np.sum(v_channel > 200)) / v_channel.size

    # 4. Color temperature consistency
    # Convert to LAB and check uniformity of the A and B channels
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    color_consistency = 1.0 - min(float(np.std(b_channel)) / 40.0, 1.0)

    # Compute insulation score (0.0 = poor, 1.0 = good)
    # Lower edge density, lower variance, less window area, and more color consistency = better
    insulation_score = (
        (1.0 - min(edge_density / 0.15, 1.0)) * 0.25
        + (1.0 - variance_score) * 0.30
        + (1.0 - min(very_bright / 0.20, 1.0)) * 0.25
        + color_consistency * 0.20
    )

    # Classify
    if insulation_score > 0.65:
        quality_level = "good"
    elif insulation_score > 0.40:
        quality_level = "fair"
    else:
        quality_level = "poor"

    details = {
        "edge_density": round(edge_density, 4),
        "surface_variance_score": round(variance_score, 4),
        "bright_area_ratio": round(very_bright, 4),
        "color_consistency": round(color_consistency, 4),
        "insulation_score": round(insulation_score, 4),
    }

    return quality_level, details


# --- Warm Area Analysis ---


def compute_warm_area_ratio(image: np.ndarray) -> float:
    """
    Compute the ratio of warm-colored areas in the image.
    Warm colors (reds, oranges, yellows) indicate heat-generating areas
    or areas receiving direct sunlight, which affects BTU requirements.

    Args:
        image: Input image in BGR format.

    Returns:
        Ratio of warm-colored pixels (0.0 to 1.0).
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # Warm colors: reds (0-20, 160-179) + oranges (10-25) + yellows (20-40)
    # with decent saturation and value
    mask1 = cv2.inRange(hsv, (0, 50, 80), (40, 255, 255))  # Red to Yellow
    mask2 = cv2.inRange(hsv, (160, 50, 80), (179, 255, 255))  # Red wrap-around

    warm_mask = cv2.bitwise_or(mask1, mask2)
    warm_ratio = float(np.sum(warm_mask > 0)) / warm_mask.size

    return warm_ratio


# --- Contrast Analysis ---


def compute_contrast_score(image: np.ndarray) -> float:
    """
    Compute a contrast score for the image.
    Higher contrast often indicates more distinct features like windows
    (bright) against walls (darker), multiple light sources, etc.

    Args:
        image: Input image in BGR format.

    Returns:
        Contrast score normalized to 0.0 - 1.0.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Use Michelson contrast: (max - min) / (max + min)
    # But localized — use standard deviation as a more robust metric
    std_dev = float(np.std(gray))
    # Normalize: typical std dev range for indoor photos is 30-80
    contrast_score = min(std_dev / 80.0, 1.0)

    return contrast_score


# --- Main Analysis Pipeline ---


def analyze_room(image: np.ndarray) -> RoomAnalysisResult:
    """
    Run the complete room analysis pipeline on an image.

    This function orchestrates all the individual analysis algorithms
    and returns a consolidated result.

    Args:
        image: Input image in BGR format (from OpenCV imread or decoded bytes).

    Returns:
        RoomAnalysisResult with all extracted metrics.
    """
    # 1. Detect windows
    window_count, window_regions = detect_windows(image)

    # 2. Analyze sunlight exposure
    sunlight_exposure, brightness_score = analyze_sunlight_exposure(image)

    # 3. Detect heat sources
    heat_sources = detect_heat_sources(image)

    # 4. Assess insulation quality
    insulation_quality, insulation_details = assess_insulation_quality(image)

    # 5. Compute warm area ratio
    warm_area_ratio = compute_warm_area_ratio(image)

    # 6. Compute contrast score
    contrast_score = compute_contrast_score(image)

    return RoomAnalysisResult(
        window_count=window_count,
        sunlight_exposure=sunlight_exposure,
        heat_sources=heat_sources,
        insulation_quality=insulation_quality,
        brightness_score=round(brightness_score, 4),
        contrast_score=round(contrast_score, 4),
        warm_area_ratio=round(warm_area_ratio, 4),
        details={
            "window_regions": window_regions,
            "insulation_metrics": insulation_details,
        },
    )
