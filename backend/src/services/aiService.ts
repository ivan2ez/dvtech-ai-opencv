import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';
import { Op } from 'sequelize';
import { RoomAssessment, BtuFactor, AirconProduct, AiRecommendation } from '../models';
import { preprocessImage } from './imageService';

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

// --- OpenAI Vision Integration ---

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder' });

export interface RoomImageAnalysis {
  windowCount: number;
  sunlightExposure: 'low' | 'medium' | 'high';
  heatSources: string[];
  insulationQuality: 'poor' | 'fair' | 'good';
}

const ROOM_ANALYSIS_PROMPT = `You are an expert HVAC analyst. Analyze the provided room image and return a JSON object with the following properties:

- "windowCount": integer, the estimated number of windows visible or likely present in the room
- "sunlightExposure": one of "low", "medium", or "high" based on visible natural light
- "heatSources": an array of strings identifying heat-generating sources (e.g. "kitchen appliances", "electronics", "lighting", "direct sunlight")
- "insulationQuality": one of "poor", "fair", or "good" based on visible indicators like window quality, wall condition, and gaps

Return ONLY valid JSON with these exact fields. Do not include any other text or explanation.`;

/**
 * Analyzes a room image using OpenAI Vision (gpt-4o) to extract
 * room characteristics relevant to HVAC assessment.
 */
export async function analyzeRoomImage(
  imageBuffer: Buffer,
  filename: string
): Promise<RoomImageAnalysis> {
  // 1. Preprocess the image via the AI microservice
  const { processedImage } = await preprocessImage(imageBuffer, filename);

  // 2. Convert processed JPEG to base64
  const base64Image = processedImage.toString('base64');

  // 3. Send to OpenAI gpt-4o with vision (with retry logic)
  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ROOM_ANALYSIS_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
    { maxRetries: 3, initialDelayMs: 1000, context: 'Image analysis' }
  );

  // 4. Parse and validate the JSON response
  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    const error = new Error(
      'OpenAI returned an empty response'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const error = new Error(
      'OpenAI returned invalid JSON'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // 5. Validate structure
  const result = parsed as Record<string, unknown>;

  const validSunlight = ['low', 'medium', 'high'];
  const validInsulation = ['poor', 'fair', 'good'];

  if (
    typeof result.windowCount !== 'number' ||
    !Number.isInteger(result.windowCount)
  ) {
    const error = new Error(
      'OpenAI response missing valid windowCount'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  if (!validSunlight.includes(result.sunlightExposure as string)) {
    const error = new Error(
      'OpenAI response missing valid sunlightExposure'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  if (!Array.isArray(result.heatSources)) {
    const error = new Error(
      'OpenAI response missing valid heatSources array'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  if (!validInsulation.includes(result.insulationQuality as string)) {
    const error = new Error(
      'OpenAI response missing valid insulationQuality'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  return {
    windowCount: result.windowCount as number,
    sunlightExposure: result.sunlightExposure as RoomImageAnalysis['sunlightExposure'],
    heatSources: result.heatSources as string[],
    insulationQuality: result.insulationQuality as RoomImageAnalysis['insulationQuality'],
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

interface OpenAIRecommendationResponse {
  total_btu: number;
  recommended_hp: number;
  unit_type: string;
  reasoning: string;
  troubleshooting_notes?: string | null;
}

// --- Recommendation Service ---

/**
 * Generates an AI-powered AC recommendation based on room assessment data,
 * BTU factors, optional image analysis, and the product catalog.
 */
export async function generateRecommendation(
  roomAssessmentId: number,
  imageAnalysis?: RoomImageAnalysis
): Promise<RecommendationResult> {
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
  const prompt = buildRecommendationPrompt(roomAssessment, btuFactors, products, imageAnalysis);

  // 5. Send to OpenAI gpt-4o (with retry logic)
  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert HVAC engineer. Analyze the provided room data and BTU factors to calculate the total BTU requirement and recommend an appropriate air conditioning unit. Return your response as valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    { maxRetries: 3, initialDelayMs: 1000, context: 'AI recommendation' }
  );

  // 6. Parse the response
  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('OpenAI returned an empty response') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  let parsed: OpenAIRecommendationResponse;
  try {
    parsed = JSON.parse(content) as OpenAIRecommendationResponse;
  } catch {
    const error = new Error('OpenAI returned invalid JSON for recommendation') as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // Validate parsed fields
  if (
    typeof parsed.total_btu !== 'number' ||
    typeof parsed.recommended_hp !== 'number' ||
    typeof parsed.unit_type !== 'string' ||
    typeof parsed.reasoning !== 'string'
  ) {
    const error = new Error('OpenAI response is missing required recommendation fields') as Error & { statusCode: number };
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
  const result: RecommendationResult = {
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

  return result;
}

// --- Prompt Builder ---

function buildRecommendationPrompt(
  roomAssessment: RoomAssessment,
  btuFactors: BtuFactor[],
  products: AirconProduct[],
  imageAnalysis?: RoomImageAnalysis
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

  // Image analysis section (optional)
  if (imageAnalysis) {
    sections.push(`## Room Image Analysis Results
- Windows Count: ${imageAnalysis.windowCount}
- Sunlight Exposure: ${imageAnalysis.sunlightExposure}
- Heat Sources: ${imageAnalysis.heatSources.length > 0 ? imageAnalysis.heatSources.join(', ') : 'None detected'}
- Insulation Quality: ${imageAnalysis.insulationQuality}`);
  }

  // Product catalog section
  const productList = products
    .map((p) => `- ${p.brand} ${p.model} | Type: ${p.type} | BTU: ${p.btuCapacity} | HP: ${p.horsepower}`)
    .join('\n');
  sections.push(`## Available Product Catalog\n${productList}`);

  // Instructions
  sections.push(`## Instructions
Using the room data, BTU factors, and image analysis (if provided), calculate the total BTU requirement for this room. Then recommend an appropriate AC unit.

Return a JSON object with the following fields:
- "total_btu": number — the calculated total BTU requirement
- "recommended_hp": number — recommended horsepower (0.5 to 5.0)
- "unit_type": string — one of "split-type", "window-type", or "floor-standing"
- "reasoning": string — detailed explanation of the calculation and recommendation
- "troubleshooting_notes": string or null — any observations or potential issues based on image analysis (null if no image was analyzed)

Consider all BTU factors in your calculation. Match the recommendation to the closest suitable product from the catalog.`);

  return sections.join('\n\n');
}
