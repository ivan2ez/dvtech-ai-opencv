import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Op } from 'sequelize';
import { RoomAssessment, BtuFactor, AirconProduct, AiRecommendation } from '../models';
import { preprocessImage, analyzeRoomWithOpenCV, RoomAnalysisResult } from './imageService';

// --- Types ---

export interface CreateRoomAssessmentInput {
  userId: number;
  serviceRequestId?: number | null;
  area: number;
  ceilingHeight: number;
  occupancy: number;
  sunlightLevel: string;
  image?: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const VALID_SUNLIGHT_LEVELS = ['low', 'moderate', 'high'];
const AREA_MIN = 1.0;
const AREA_MAX = 1000.0;
const CEILING_HEIGHT_MIN = 1.0;
const CEILING_HEIGHT_MAX = 10.0;
const OCCUPANCY_MIN = 1;
const OCCUPANCY_MAX = 500;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_IMAGE_MIMETYPES = ['image/jpeg', 'image/png'];
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/room-images');

// --- Validation Helpers ---

function validateRoomAssessmentInput(input: CreateRoomAssessmentInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate area
  if (input.area === undefined || input.area === null) {
    errors.push({ field: 'area', message: 'Area is required' });
  } else if (typeof input.area !== 'number' || isNaN(input.area)) {
    errors.push({ field: 'area', message: 'Area must be a valid number' });
  } else if (input.area < AREA_MIN || input.area > AREA_MAX) {
    errors.push({ field: 'area', message: `Area must be between ${AREA_MIN} and ${AREA_MAX} sq meters` });
  }

  // Validate ceiling height
  if (input.ceilingHeight === undefined || input.ceilingHeight === null) {
    errors.push({ field: 'ceilingHeight', message: 'Ceiling height is required' });
  } else if (typeof input.ceilingHeight !== 'number' || isNaN(input.ceilingHeight)) {
    errors.push({ field: 'ceilingHeight', message: 'Ceiling height must be a valid number' });
  } else if (input.ceilingHeight < CEILING_HEIGHT_MIN || input.ceilingHeight > CEILING_HEIGHT_MAX) {
    errors.push({
      field: 'ceilingHeight',
      message: `Ceiling height must be between ${CEILING_HEIGHT_MIN} and ${CEILING_HEIGHT_MAX} meters`,
    });
  }

  // Validate occupancy
  if (input.occupancy === undefined || input.occupancy === null) {
    errors.push({ field: 'occupancy', message: 'Occupancy is required' });
  } else if (typeof input.occupancy !== 'number' || isNaN(input.occupancy)) {
    errors.push({ field: 'occupancy', message: 'Occupancy must be a valid number' });
  } else if (!Number.isInteger(input.occupancy)) {
    errors.push({ field: 'occupancy', message: 'Occupancy must be an integer' });
  } else if (input.occupancy < OCCUPANCY_MIN || input.occupancy > OCCUPANCY_MAX) {
    errors.push({
      field: 'occupancy',
      message: `Occupancy must be between ${OCCUPANCY_MIN} and ${OCCUPANCY_MAX}`,
    });
  }

  // Validate sunlight level
  if (!input.sunlightLevel || input.sunlightLevel.trim().length === 0) {
    errors.push({ field: 'sunlightLevel', message: 'Sunlight level is required' });
  } else if (!VALID_SUNLIGHT_LEVELS.includes(input.sunlightLevel.trim().toLowerCase())) {
    errors.push({
      field: 'sunlightLevel',
      message: `Sunlight level must be one of: ${VALID_SUNLIGHT_LEVELS.join(', ')}`,
    });
  }

  return errors;
}

function validateImage(image: CreateRoomAssessmentInput['image']): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!image) return errors;

  if (!VALID_IMAGE_MIMETYPES.includes(image.mimetype)) {
    errors.push({
      field: 'image',
      message: 'Image must be a JPEG or PNG file',
    });
  }

  if (image.size > MAX_IMAGE_SIZE) {
    errors.push({
      field: 'image',
      message: 'Image must not exceed 10 MB',
    });
  }

  return errors;
}

function generateUniqueFilename(originalname: string): string {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalname).toLowerCase() || '.jpg';
  return `${timestamp}-${randomStr}${ext}`;
}

function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- Service ---

export async function createRoomAssessment(
  input: CreateRoomAssessmentInput
): Promise<RoomAssessment> {
  // 1. Validate required fields
  const validationErrors = validateRoomAssessmentInput(input);

  // 2. Validate image if provided
  if (input.image) {
    const imageErrors = validateImage(input.image);
    validationErrors.push(...imageErrors);
  }

  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 3. Handle optional image upload
  let imagePath: string | null = null;

  if (input.image) {
    ensureUploadDir();
    const filename = generateUniqueFilename(input.image.originalname);
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, input.image.buffer);
    imagePath = `uploads/room-images/${filename}`;
  }

  // 4. Create RoomAssessment record
  const roomAssessment = await RoomAssessment.create({
    userId: input.userId,
    serviceRequestId: input.serviceRequestId || null,
    area: input.area,
    ceilingHeight: input.ceilingHeight,
    occupancy: input.occupancy,
    sunlightLevel: input.sunlightLevel.trim().toLowerCase(),
    imagePath,
  });

  return roomAssessment;
}


// --- Retry Utility ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isNonRetryableError(err: unknown): boolean {
  // Don't retry on 400/401/403/404 errors (client-side issues)
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    return status >= 400 && status < 500;
  }
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; initialDelayMs: number; context: string }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on non-retryable errors (4xx client errors)
      if (isNonRetryableError(err)) {
        throw lastError;
      }

      if (attempt < options.maxRetries) {
        const delay = options.initialDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  const error = new Error(
    `${options.context} could not be completed after ${options.maxRetries + 1} attempts. Please try again later.`
  ) as Error & { statusCode: number };
  error.statusCode = 503;
  throw error;
}

// --- Gemini Client ---

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    const error = new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key to the .env file and restart the server.'
    ) as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }
  return new GoogleGenerativeAI(apiKey);
}

export interface RoomImageAnalysis {
  windowCount: number;
  sunlightExposure: 'low' | 'medium' | 'high';
  heatSources: string[];
  insulationQuality: 'poor' | 'fair' | 'good';
}

export interface CombinedImageAnalysis {
  gemini: RoomImageAnalysis;
  opencv: RoomAnalysisResult;
}

const ROOM_ANALYSIS_PROMPT = `You are an expert HVAC analyst. Analyze the provided room image and return a JSON object with the following properties:

- "windowCount": integer, the estimated number of windows visible or likely present in the room
- "sunlightExposure": one of "low", "medium", or "high" based on visible natural light
- "heatSources": an array of strings identifying heat-generating sources (e.g. "kitchen appliances", "electronics", "lighting", "direct sunlight")
- "insulationQuality": one of "poor", "fair", or "good" based on visible indicators like window quality, wall condition, and gaps

Return ONLY valid JSON with these exact fields. Do not include any other text or explanation.`;

/**
 * Analyzes a room image using both OpenCV (deterministic metrics) and
 * Gemini Vision (semantic understanding) in parallel.
 *
 * OpenCV runs via the Python microservice to extract brightness,
 * contrast, warm area ratio, window regions, and insulation metrics.
 * Gemini Vision interprets the same preprocessed image for semantic labels.
 * Both results are returned together to feed the recommendation prompt.
 */
export async function analyzeRoomImage(
  imageBuffer: Buffer,
  filename: string
): Promise<CombinedImageAnalysis> {
  const genAI = getGeminiClient();

  // Run preprocessing and OpenCV analysis in parallel — both hit the Python
  // microservice independently with no ordering dependency between them.
  const [{ processedImage }, opencvResult] = await Promise.all([
    preprocessImage(imageBuffer, filename),
    analyzeRoomWithOpenCV(imageBuffer, filename),
  ]);

  // Use gemini-1.5-flash — supports vision and is cost-effective
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Send preprocessed image as inlineData (same pattern as troubleshootingService)
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: ROOM_ANALYSIS_PROMPT },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: processedImage.toString('base64'),
      },
    },
  ];

  let rawContent: string;
  try {
    const result = await model.generateContent(parts);
    rawContent = result.response.text();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[analyzeRoomImage] Gemini API error:', message);

    if (message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
      const rateLimitError = new Error(
        'AI service quota exceeded. Please wait a few minutes and try again.'
      ) as Error & { statusCode: number };
      rateLimitError.statusCode = 429;
      throw rateLimitError;
    }

    const error = new Error(
      'Room image analysis failed. Please try again later.'
    ) as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }

  if (!rawContent) {
    const error = new Error('Gemini returned an empty response for image analysis') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // Strip markdown code fences if Gemini wraps the JSON
  let jsonString = rawContent.trim();
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    const error = new Error('Gemini returned invalid JSON for image analysis') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  const result = parsed as Record<string, unknown>;
  const validSunlight = ['low', 'medium', 'high'];
  const validInsulation = ['poor', 'fair', 'good'];

  if (typeof result.windowCount !== 'number' || !Number.isInteger(result.windowCount)) {
    const error = new Error('Gemini response missing valid windowCount') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }
  if (!validSunlight.includes(result.sunlightExposure as string)) {
    const error = new Error('Gemini response missing valid sunlightExposure') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }
  if (!Array.isArray(result.heatSources)) {
    const error = new Error('Gemini response missing valid heatSources array') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }
  if (!validInsulation.includes(result.insulationQuality as string)) {
    const error = new Error('Gemini response missing valid insulationQuality') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  return {
    gemini: {
      windowCount: result.windowCount as number,
      sunlightExposure: result.sunlightExposure as RoomImageAnalysis['sunlightExposure'],
      heatSources: result.heatSources as string[],
      insulationQuality: result.insulationQuality as RoomImageAnalysis['insulationQuality'],
    },
    opencv: opencvResult,
  };
}


// --- Recommendation Types ---

export interface RecommendationResult {
  id: number;
  roomAssessmentId: number;
  totalBtu: number;
  recommendedHp: number;
  unitType: string;
  productId: number | null;
  troubleshootingNotes: string | null;
  reasoning: string;
  product: {
    id: number;
    brand: string;
    model: string;
    type: string;
    horsepower: number;
    btuCapacity: number;
    price: number;
    description: string | null;
  } | null;
}

interface GeminiRecommendationResponse {
  total_btu: number;
  recommended_hp: number;
  unit_type: string;
  reasoning: string;
  troubleshooting_notes?: string | null;
}

// --- Recommendation Service ---

/**
 * Generates an AI-powered AC recommendation using Gemini based on room
 * assessment data, BTU factors, optional image analysis, and the product catalog.
 */
export async function generateRecommendation(
  roomAssessmentId: number,
  imageAnalysis?: RoomImageAnalysis,
  opencvAnalysis?: RoomAnalysisResult
): Promise<RecommendationResult> {
  const genAI = getGeminiClient();

  // 1. Fetch RoomAssessment by ID
  const roomAssessment = await RoomAssessment.findByPk(roomAssessmentId);
  if (!roomAssessment) {
    const error = new Error('Room assessment not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch all BTU factors
  const btuFactors = await BtuFactor.findAll();
  if (btuFactors.length === 0) {
    const error = new Error('No BTU factors configured. Please contact an administrator.') as Error & { statusCode: number };
    error.statusCode = 422;
    throw error;
  }

  // 3. Fetch all active aircon products
  const products = await AirconProduct.findAll({
    where: { isActive: true },
  });
  if (products.length === 0) {
    const error = new Error('No active products available in the catalog.') as Error & { statusCode: number };
    error.statusCode = 422;
    throw error;
  }

  // 4. Build the recommendation prompt
  const prompt = buildRecommendationPrompt(roomAssessment, btuFactors, products, imageAnalysis, opencvAnalysis);

  // 5. Send to Gemini (gemini-1.5-flash — text only, no image needed here)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const systemInstruction = 'You are an expert HVAC engineer. Analyze the provided room data and BTU factors to calculate the total BTU requirement and recommend an appropriate air conditioning unit. Return your response as valid JSON only — no markdown, no explanation outside the JSON object.';

  let rawContent: string;
  try {
    const result = await model.generateContent(`${systemInstruction}\n\n${prompt}`);
    rawContent = result.response.text();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generateRecommendation] Gemini API error:', message);

    if (message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
      const rateLimitError = new Error(
        'AI service quota exceeded. Please wait a few minutes and try again.'
      ) as Error & { statusCode: number };
      rateLimitError.statusCode = 429;
      throw rateLimitError;
    }

    // Retry once with backoff
    try {
      await sleep(2000);
      const retryResult = await model.generateContent(`${systemInstruction}\n\n${prompt}`);
      rawContent = retryResult.response.text();
    } catch (retryErr: unknown) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error('[generateRecommendation] Gemini retry failed:', retryMsg);
      const error = new Error(
        'AI recommendation could not be completed. Please try again later.'
      ) as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    }
  }

  if (!rawContent) {
    const error = new Error('Gemini returned an empty response for recommendation') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // Strip markdown code fences if Gemini wraps the JSON
  let jsonString = rawContent.trim();
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }

  let parsed: GeminiRecommendationResponse;
  try {
    parsed = JSON.parse(jsonString) as GeminiRecommendationResponse;
  } catch {
    const error = new Error('Gemini returned invalid JSON for recommendation') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // Validate required fields
  if (
    typeof parsed.total_btu !== 'number' ||
    typeof parsed.recommended_hp !== 'number' ||
    typeof parsed.unit_type !== 'string' ||
    typeof parsed.reasoning !== 'string'
  ) {
    const error = new Error('Gemini response is missing required recommendation fields') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // 7. Match recommendation to a product
  const matchedProduct = await AirconProduct.findOne({
    where: {
      type: parsed.unit_type,
      btuCapacity: { [Op.gte]: parsed.total_btu },
      isActive: true,
    },
    order: [['btu_capacity', 'ASC']],
  });

  // 8. Save AiRecommendation record
  const recommendation = await AiRecommendation.create({
    roomAssessmentId,
    totalBtu: parsed.total_btu,
    recommendedHp: parsed.recommended_hp,
    unitType: parsed.unit_type,
    productId: matchedProduct ? matchedProduct.id : null,
    troubleshootingNotes: parsed.troubleshooting_notes || null,
    reasoning: parsed.reasoning,
  });

  // 9. Build and return the result
  return {
    id: recommendation.id,
    roomAssessmentId: recommendation.roomAssessmentId,
    totalBtu: recommendation.totalBtu,
    recommendedHp: recommendation.recommendedHp,
    unitType: recommendation.unitType,
    productId: recommendation.productId,
    troubleshootingNotes: recommendation.troubleshootingNotes,
    reasoning: recommendation.reasoning,
    product: matchedProduct
      ? {
          id: matchedProduct.id,
          brand: matchedProduct.brand,
          model: matchedProduct.model,
          type: matchedProduct.type,
          horsepower: matchedProduct.horsepower,
          btuCapacity: matchedProduct.btuCapacity,
          price: Number(matchedProduct.price),
          description: matchedProduct.description,
        }
      : null,
  };
}

// --- Prompt Builder ---

function buildRecommendationPrompt(
  roomAssessment: RoomAssessment,
  btuFactors: BtuFactor[],
  products: AirconProduct[],
  imageAnalysis?: RoomImageAnalysis,
  opencvAnalysis?: RoomAnalysisResult
): string {
  const sections: string[] = [];

  // Room data section
  sections.push(`## Room Data
- Area: ${roomAssessment.area} sq meters
- Ceiling Height: ${roomAssessment.ceilingHeight} meters
- Occupancy: ${roomAssessment.occupancy} persons
- Sunlight Level: ${roomAssessment.sunlightLevel}`);

  // BTU factors section
  const factorsList = btuFactors
    .map((f) => `- ${f.factorName}: ${f.factorValue}${f.description ? ` (${f.description})` : ''}`)
    .join('\n');
  sections.push(`## BTU Calculation Factors\n${factorsList}`);

  // Gemini Vision analysis section (semantic labels)
  if (imageAnalysis) {
    sections.push(`## Room Image Analysis — Gemini Vision (Semantic)
- Windows Count: ${imageAnalysis.windowCount}
- Sunlight Exposure: ${imageAnalysis.sunlightExposure}
- Heat Sources: ${imageAnalysis.heatSources.length > 0 ? imageAnalysis.heatSources.join(', ') : 'None detected'}
- Insulation Quality: ${imageAnalysis.insulationQuality}`);
  }

  // OpenCV analysis section (objective measurements)
  if (opencvAnalysis) {
    const heatSourcesList = opencvAnalysis.heatSources.length > 0
      ? opencvAnalysis.heatSources.join(', ')
      : 'None detected';

    sections.push(`## Room Image Analysis — OpenCV (Objective Measurements)
- Windows Detected: ${opencvAnalysis.windowCount}
- Sunlight Exposure Level: ${opencvAnalysis.sunlightExposure}
- Detected Heat Sources: ${heatSourcesList}
- Insulation Quality: ${opencvAnalysis.insulationQuality}
- Brightness Score: ${opencvAnalysis.brightnessScore} (0=dark, 1=very bright)
- Contrast Score: ${opencvAnalysis.contrastScore} (0=low contrast, 1=high contrast)
- Warm Area Ratio: ${opencvAnalysis.warmAreaRatio} (proportion of warm-colored pixels — higher = more heat gain)
${opencvAnalysis.details?.insulationMetrics ? `- Edge Density: ${opencvAnalysis.details.insulationMetrics.edgeDensity} (higher = rougher surfaces/more gaps)
- Surface Variance: ${opencvAnalysis.details.insulationMetrics.surfaceVarianceScore} (higher = less uniform walls)
- Bright Area Ratio: ${opencvAnalysis.details.insulationMetrics.brightAreaRatio} (proportion of very bright pixels)
- Color Consistency: ${opencvAnalysis.details.insulationMetrics.colorConsistency} (higher = more uniform lighting)` : ''}`);
  }

  // Product catalog section
  const productList = products
    .map((p) => `- ${p.brand} ${p.model} | Type: ${p.type} | BTU: ${p.btuCapacity} | HP: ${p.horsepower}`)
    .join('\n');
  sections.push(`## Available Product Catalog\n${productList}`);

  // Instructions
  sections.push(`## Instructions
Using the room data, BTU factors, and image analysis results (if provided), calculate the total BTU requirement for this room. Then recommend an appropriate AC unit.

When image analysis data is available, use the OpenCV objective measurements to adjust your BTU estimate:
- High warm area ratio (>0.3) or high brightness score (>0.6) → add heat gain factor
- Poor insulation quality or high edge density → increase BTU estimate by 10-15%
- Multiple detected heat sources → account for additional internal heat load
- High window count → factor in solar heat gain

Return a JSON object with the following fields:
- "total_btu": number — the calculated total BTU requirement
- "recommended_hp": number — recommended horsepower (0.5 to 5.0)
- "unit_type": string — one of "split-type", "window-type", or "floor-standing"
- "reasoning": string — detailed explanation of the calculation and recommendation, including how image data influenced the result
- "troubleshooting_notes": string or null — any observations or potential issues based on image analysis (null if no image was analyzed)

Consider all BTU factors in your calculation. Match the recommendation to the closest suitable product from the catalog.`);

  return sections.join('\n\n');
}
