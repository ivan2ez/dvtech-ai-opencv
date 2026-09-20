import FormData from 'form-data';

// --- Types ---

export interface PreprocessMetadata {
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  originalSizeKb: number;
  processedSizeKb: number;
}

export interface PreprocessResult {
  processedImage: Buffer;
  metadata: PreprocessMetadata;
}

export interface PreprocessOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxFileSizeKb?: number;
  quality?: number;
  enhance?: boolean;
}

// --- Constants ---

const DEFAULT_AI_SERVICE_URL = 'http://localhost:8000';

// --- Service ---

/**
 * Sends an image buffer to the Python AI service for preprocessing.
 * The AI service resizes, compresses, and optionally enhances the image.
 */
export async function preprocessImage(
  imageBuffer: Buffer,
  filename: string,
  options?: PreprocessOptions
): Promise<PreprocessResult> {
  const baseUrl = process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL;
  const url = `${baseUrl}/api/preprocess`;

  // Build multipart form data
  const form = new FormData();
  form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });

  if (options?.maxWidth !== undefined) {
    form.append('max_width', String(options.maxWidth));
  }
  if (options?.maxHeight !== undefined) {
    form.append('max_height', String(options.maxHeight));
  }
  if (options?.maxFileSizeKb !== undefined) {
    form.append('max_file_size_kb', String(options.maxFileSizeKb));
  }
  if (options?.quality !== undefined) {
    form.append('quality', String(options.quality));
  }
  if (options?.enhance !== undefined) {
    form.append('enhance', String(options.enhance));
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form.getBuffer(),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error';
    const error = new Error(
      `AI service is unreachable at ${baseUrl}: ${message}`
    ) as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      detail = body ? `: ${body}` : '';
    } catch {
      // Ignore parse errors for the error body
    }

    const error = new Error(
      `AI service returned error ${response.status}${detail}`
    ) as Error & { statusCode: number };
    error.statusCode = response.status;
    throw error;
  }

  // Parse processed image from response body
  const arrayBuffer = await response.arrayBuffer();
  const processedImage = Buffer.from(arrayBuffer);

  // Extract metadata from response headers
  const metadata: PreprocessMetadata = {
    originalWidth: parseHeaderInt(response.headers, 'x-original-width'),
    originalHeight: parseHeaderInt(response.headers, 'x-original-height'),
    processedWidth: parseHeaderInt(response.headers, 'x-processed-width'),
    processedHeight: parseHeaderInt(response.headers, 'x-processed-height'),
    originalSizeKb: parseHeaderFloat(response.headers, 'x-original-size-kb'),
    processedSizeKb: parseHeaderFloat(response.headers, 'x-processed-size-kb'),
  };

  return { processedImage, metadata };
}

// --- Room Analysis Types ---

export interface RoomAnalysisResult {
  windowCount: number;
  sunlightExposure: 'low' | 'medium' | 'high';
  heatSources: string[];
  insulationQuality: 'poor' | 'fair' | 'good';
  brightnessScore: number;
  contrastScore: number;
  warmAreaRatio: number;
  details?: {
    windowRegions?: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      brightness: number;
      rectangularity: number;
    }>;
    insulationMetrics?: {
      edgeDensity: number;
      surfaceVarianceScore: number;
      brightAreaRatio: number;
      colorConsistency: number;
      insulationScore: number;
    };
  };
}

export interface RoomAnalysisOptions {
  maxWidth?: number;
  maxHeight?: number;
  includeDetails?: boolean;
}

// --- Room Analysis Service ---

/**
 * Sends an image buffer to the Python AI service for OpenCV-based room analysis.
 * The AI service analyzes the room to detect windows, sunlight exposure,
 * heat sources, and insulation quality — all relevant to BTU calculations.
 */
export async function analyzeRoomWithOpenCV(
  imageBuffer: Buffer,
  filename: string,
  options?: RoomAnalysisOptions
): Promise<RoomAnalysisResult> {
  const baseUrl = process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL;
  const url = `${baseUrl}/api/analyze-room`;

  // Build multipart form data
  const form = new FormData();
  form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });

  if (options?.maxWidth !== undefined) {
    form.append('max_width', String(options.maxWidth));
  }
  if (options?.maxHeight !== undefined) {
    form.append('max_height', String(options.maxHeight));
  }
  if (options?.includeDetails !== undefined) {
    form.append('include_details', String(options.includeDetails));
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form.getBuffer(),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error';
    const error = new Error(
      `AI service is unreachable at ${baseUrl}: ${message}`
    ) as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      detail = body ? `: ${body}` : '';
    } catch {
      // Ignore parse errors for the error body
    }

    const error = new Error(
      `AI service room analysis returned error ${response.status}${detail}`
    ) as Error & { statusCode: number };
    error.statusCode = response.status;
    throw error;
  }

  // Parse JSON response
  const data = await response.json() as Record<string, unknown>;

  if (!data.success) {
    const error = new Error(
      'AI service room analysis returned unsuccessful result'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // Map snake_case response to camelCase
  const result: RoomAnalysisResult = {
    windowCount: (data.window_count as number) ?? 0,
    sunlightExposure: (data.sunlight_exposure as RoomAnalysisResult['sunlightExposure']) ?? 'low',
    heatSources: (data.heat_sources as string[]) ?? [],
    insulationQuality: (data.insulation_quality as RoomAnalysisResult['insulationQuality']) ?? 'fair',
    brightnessScore: (data.brightness_score as number) ?? 0,
    contrastScore: (data.contrast_score as number) ?? 0,
    warmAreaRatio: (data.warm_area_ratio as number) ?? 0,
  };

  // Map details if present
  if (data.details && typeof data.details === 'object') {
    const details = data.details as Record<string, unknown>;
    result.details = {};

    if (Array.isArray(details.window_regions)) {
      result.details.windowRegions = details.window_regions as RoomAnalysisResult['details'] extends undefined ? never : NonNullable<RoomAnalysisResult['details']>['windowRegions'];
    }

    if (details.insulation_metrics && typeof details.insulation_metrics === 'object') {
      const metrics = details.insulation_metrics as Record<string, number>;
      result.details.insulationMetrics = {
        edgeDensity: metrics.edge_density ?? 0,
        surfaceVarianceScore: metrics.surface_variance_score ?? 0,
        brightAreaRatio: metrics.bright_area_ratio ?? 0,
        colorConsistency: metrics.color_consistency ?? 0,
        insulationScore: metrics.insulation_score ?? 0,
      };
    }
  }

  return result;
}

// --- Helpers ---

function parseHeaderInt(headers: Headers, name: string): number {
  const value = headers.get(name);
  if (value === null) return 0;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function parseHeaderFloat(headers: Headers, name: string): number {
  const value = headers.get(name);
  if (value === null) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}
