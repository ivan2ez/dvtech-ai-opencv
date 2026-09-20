import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Op } from 'sequelize';
import { RoomAssessment, BtuFactor, AirconProduct, AiRecommendation, RecommendedProduct } from '../models';
import { preprocessImage, analyzeRoomWithOpenCV, RoomAnalysisResult } from './imageService';
import {
  computeBtu,
  computeOpenCvUplift,
  deriveHpFromTiers,
  buildHpTiersFromCatalog,
  BtuBreakdownLine,
  UpliftLineItem,
  NarrativeFacts,
  HpDerivation,
  InsulationQuality,
  SunlightLevel,
} from './btuCalculationService';

// --- Types ---

export interface CreateRoomAssessmentInput {
  userId: number;
  serviceRequestId?: number | null;
  area: number;
  ceilingHeight: number;
  occupancy: number;
  sunlightLevel: string;
  /** Hours per day the AC runs (0-24). Optional. */
  dailyUsage?: number | null;
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

// Sunlight accepts 'medium' and 'moderate' as synonyms for the middle tier.
const VALID_SUNLIGHT_LEVELS = ['low', 'medium', 'moderate', 'high'];
// Per the revisions, area / ceiling / occupancy have NO upper cap — reject only
// non-numbers (letters) and non-positive values.
const DAILY_USAGE_MAX_HOURS = 24;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_IMAGE_MIMETYPES = ['image/jpeg', 'image/png'];
const UPLOAD_DIR = process.env.VERCEL === '1'
  ? '/tmp/uploads/room-images'
  : path.resolve(__dirname, '../../uploads/room-images');

// --- Validation Helpers ---

function validateRoomAssessmentInput(input: CreateRoomAssessmentInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Area — any positive number, no upper cap.
  if (input.area === undefined || input.area === null) {
    errors.push({ field: 'area', message: 'Area is required' });
  } else if (typeof input.area !== 'number' || isNaN(input.area)) {
    errors.push({ field: 'area', message: 'Area must be a valid number' });
  } else if (input.area <= 0) {
    errors.push({ field: 'area', message: 'Area must be greater than 0' });
  }

  // Ceiling height — any positive number, no upper cap.
  if (input.ceilingHeight === undefined || input.ceilingHeight === null) {
    errors.push({ field: 'ceilingHeight', message: 'Ceiling height is required' });
  } else if (typeof input.ceilingHeight !== 'number' || isNaN(input.ceilingHeight)) {
    errors.push({ field: 'ceilingHeight', message: 'Ceiling height must be a valid number' });
  } else if (input.ceilingHeight <= 0) {
    errors.push({ field: 'ceilingHeight', message: 'Ceiling height must be greater than 0' });
  }

  // Occupancy — any positive whole number, no upper cap.
  if (input.occupancy === undefined || input.occupancy === null) {
    errors.push({ field: 'occupancy', message: 'Occupancy is required' });
  } else if (typeof input.occupancy !== 'number' || isNaN(input.occupancy)) {
    errors.push({ field: 'occupancy', message: 'Occupancy must be a valid number' });
  } else if (!Number.isInteger(input.occupancy)) {
    errors.push({ field: 'occupancy', message: 'Occupancy must be a whole number' });
  } else if (input.occupancy <= 0) {
    errors.push({ field: 'occupancy', message: 'Occupancy must be greater than 0' });
  }

  // Sunlight level
  if (!input.sunlightLevel || input.sunlightLevel.trim().length === 0) {
    errors.push({ field: 'sunlightLevel', message: 'Sunlight level is required' });
  } else if (!VALID_SUNLIGHT_LEVELS.includes(input.sunlightLevel.trim().toLowerCase())) {
    errors.push({
      field: 'sunlightLevel',
      message: `Sunlight level must be one of: ${VALID_SUNLIGHT_LEVELS.join(', ')}`,
    });
  }

  // Daily usage (optional) — 0 to 24 hours, since a day has only 24 hours.
  if (input.dailyUsage !== undefined && input.dailyUsage !== null) {
    if (typeof input.dailyUsage !== 'number' || isNaN(input.dailyUsage)) {
      errors.push({ field: 'dailyUsage', message: 'Daily usage must be a valid number' });
    } else if (input.dailyUsage < 0) {
      errors.push({ field: 'dailyUsage', message: 'Daily usage cannot be negative' });
    } else if (input.dailyUsage > DAILY_USAGE_MAX_HOURS) {
      errors.push({ field: 'dailyUsage', message: `Daily usage cannot exceed ${DAILY_USAGE_MAX_HOURS} hours` });
    }
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
    dailyUsage: input.dailyUsage ?? null,
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

  // Use gemini-3.6-flash — supports vision and is cost-effective
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

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

/**
 * Graceful-degradation wrapper around {@link analyzeRoomImage} (C3, Req 3.11).
 *
 * Image analysis reaches out to the Python/OpenCV microservice and the vision
 * model, either of which can be unavailable or return unusable output. When
 * that happens the recommendation must NOT fail — it degrades to a form-only
 * result. This wrapper never throws: on any failure (or empty/unusable output)
 * it returns `null`, and the caller then generates the recommendation from the
 * form inputs alone with zero OpenCV uplift and `photoAnalysisApplied: false`.
 *
 * Returns the combined analysis on success, or `null` when photo-based
 * analysis could not be applied.
 */
export async function analyzeRoomImageSafe(
  imageBuffer: Buffer,
  filename: string
): Promise<CombinedImageAnalysis | null> {
  try {
    const analysis = await analyzeRoomImage(imageBuffer, filename);
    // Guard against an unusable (empty) result even if no error was thrown.
    if (!analysis || !analysis.gemini) {
      console.warn('[analyzeRoomImageSafe] Image analysis returned no usable output; degrading to form-only.');
      return null;
    }
    return analysis;
  } catch (err: unknown) {
    console.error(
      '[analyzeRoomImageSafe] Image analysis failed; degrading to form-only recommendation:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}


// --- Recommendation Types ---

export interface RecommendedProductInfo {
  id: number;
  brand: string;
  model: string;
  type: string;
  horsepower: number;
  btuCapacity: number;
  price: number;
  description: string | null;
  rank: number;
  isPrimary: boolean;
}

/** Pricing tier assigned to a recommended product for the Entry/Mid/Premium UI. */
export type ProductTier = 'entry' | 'mid' | 'premium';

export interface TieredProductInfo extends RecommendedProductInfo {
  tier: ProductTier;
  unitType: string;
}

/** A multi-unit alternative for high-BTU needs no single unit can cover (#19). */
export interface MultiUnitAlternative {
  productId: number;
  brand: string;
  model: string;
  horsepower: number;
  btuCapacity: number;
  price: number;
  /** How many of this unit to cover the requirement. */
  quantity: number;
  /** quantity * unit BTU. */
  combinedBtu: number;
  /** quantity * unit price. */
  combinedPrice: number;
  description: string;
}

export interface RecommendationResult {
  id: number;
  roomAssessmentId: number;
  totalBtu: number;
  recommendedHp: number;
  unitType: string;
  productId: number | null;
  troubleshootingNotes: string | null;
  reasoning: string;
  /** BTU from the customer's form inputs only, before any image-derived uplift (C3). */
  baseLoadBtu: number;
  /** The capped, line-itemized OpenCV uplift applied on top of the Base_Load (C3, Req 3.4). */
  cappedUpliftBtu: number;
  /** Each image-derived adjustment as a separate labeled line item (C3, Req 3.1). */
  openCvUpliftLineItems: UpliftLineItem[];
  /**
   * Whether photo-based analysis was applied. False when no image was supplied
   * or when the Image_Analysis_Service was unavailable / returned nothing
   * usable, in which case the recommendation is form-only with zero uplift
   * (C3, Req 3.11).
   */
  photoAnalysisApplied: boolean;
  /** Facts derived only from measured room values, backing the narrative (C3, Req 3.5–3.7). */
  narrativeFacts: NarrativeFacts;
  /** Step-by-step BTU computation for the table-style breakdown (#16). */
  computationBreakdown: BtuBreakdownLine[];
  /** Electrical & breaker guidance plus inverter/unit-type rationale (#17). */
  electricalTips: string[];
  breakerTips: string[];
  unitTypeRationale: string;
  /** Whether the recommended unit type is an inverter. */
  isInverterRecommended: boolean;
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
  recommendedProducts: RecommendedProductInfo[];
  /** Products grouped into Entry/Mid/Premium tiers (#18). */
  tieredProducts: TieredProductInfo[];
  /** Populated only when no single unit meets the BTU need (#19). */
  multiUnitAlternatives: MultiUnitAlternative[];
  /** True when the commercial multi-unit path was used. */
  requiresMultiUnit: boolean;
  /**
   * True when the computed BTU load exceeds the largest catalog HP tier
   * (Req 1.9). The unit card then shows the largest available tier alongside
   * `capacityMessage`.
   */
  exceedsLargestTier: boolean;
  /**
   * A site-survey-or-multiple-units message when the load exceeds the largest
   * tier (Req 1.9), a "no matching unit" message when no tier qualifies
   * (Req 1.13), or null on the normal matched path.
   */
  capacityMessage: string | null;
}

interface GeminiAdvisoryResponse {
  unit_type: string;
  is_inverter: boolean;
  reasoning: string;
  unit_type_rationale: string;
  electrical_tips: string[];
  breaker_tips: string[];
  troubleshooting_notes?: string | null;
}

// --- Unit-type sanitization & floor-term stripping (C1, Req 1.1, 1.2) ---

/** The only unit types the Recommendation_Engine is permitted to output (Req 1.1). */
export const PERMITTED_UNIT_TYPES = ['Window Type', 'Split Type'] as const;
export type PermittedUnitType = (typeof PERMITTED_UNIT_TYPES)[number];

/**
 * Coerces any unit-type string (from a product row, the LLM, or a fallback) to
 * exactly one of the permitted display types: "Window Type" or "Split Type"
 * (Req 1.1). Anything containing "window" maps to Window Type; anything
 * containing "split" maps to Split Type. Everything ambiguous — including
 * floor-standing / cassette / ceiling — defaults to "Split Type" (design C1).
 */
export function sanitizeUnitType(raw: string | null | undefined): PermittedUnitType {
  const value = (raw ?? '').toLowerCase();
  if (value.includes('window')) return 'Window Type';
  if (value.includes('split')) return 'Split Type';
  // Ambiguous or forbidden (floor-standing, cassette, ceiling, etc.) → default.
  return 'Split Type';
}

/**
 * Removes the case-insensitive word "floor" — and floor-mounted phrasings such
 * as "floor-standing", "floor standing", "floor mounted", "floor type" — from
 * any output string, then cleans up the leftover whitespace and dangling
 * punctuation so the text still reads naturally (Req 1.2).
 */
export function stripFloorTerm(text: string | null | undefined): string {
  if (!text) return '';

  let result = text;

  // 1. Drop common floor-mounted unit-type phrases first (longest match wins).
  result = result.replace(
    /\bfloor[\s-]*(?:standing|mounted|mount|type|unit|units)\b/gi,
    ''
  );

  // 2. Drop any remaining standalone occurrence of the word "floor"
  //    (including hyphenated forms like "floor-").
  result = result.replace(/\bfloor\b-?/gi, '');

  // 3. Clean up leftover artifacts: collapse repeated whitespace, remove spaces
  //    before punctuation, and collapse doubled/dangling separators.
  result = result
    .replace(/[ \t]{2,}/g, ' ')          // collapse runs of spaces/tabs
    .replace(/\s+([.,;:!?])/g, '$1')     // remove space before punctuation
    .replace(/\(\s*\)/g, '')             // empty parens
    .replace(/\s+-\s+/g, ' ')            // dangling hyphen separators
    .replace(/,\s*,/g, ',')              // doubled commas
    .replace(/[ \t]*\n[ \t]*/g, '\n')    // trim around newlines
    .replace(/[ \t]{2,}/g, ' ');

  return result.trim();
}

/** Applies stripFloorTerm across every string in an array. */
function stripFloorTermList(items: string[]): string[] {
  return items.map((item) => stripFloorTerm(item));
}

// --- HP-class electrical & breaker tips (C1, Req 1.8) ---

/**
 * One horsepower class: electrical + breaker guidance selected purely by the
 * computed HP, not by the language model's opinion (Req 1.8). The recommended
 * HP is matched to the class with the largest `maxHp` boundary it does not
 * exceed, so every possible HP resolves to exactly one class.
 */
interface HpClassTips {
  /** Upper HP bound (inclusive) this class covers. Infinity for the top class. */
  maxHp: number;
  electricalTips: string[];
  breakerTips: string[];
}

/**
 * Electrical/breaker tips keyed on the computed HP class (Req 1.8). Values are
 * for the Philippine 230V single-phase supply DVTech sells into. The classes
 * are ordered ascending by `maxHp`; `selectTipsByHpClass` picks the first class
 * whose `maxHp` is >= the computed HP. Centralized here so the guidance can be
 * tuned in one place without touching the recommendation flow.
 */
const TIPS_BY_HP_CLASS: HpClassTips[] = [
  {
    // <= 1.0 HP (e.g. 0.75, 1.0)
    maxHp: 1.0,
    electricalTips: [
      'Run the unit on a dedicated 230V circuit; a 1.0HP class unit draws roughly 4-6A.',
      'Use at least 2.0mm2 copper wiring and confirm the outlet is properly grounded.',
    ],
    breakerTips: [
      'A dedicated 15A breaker is appropriate for a unit in this HP class.',
      'Do not share the circuit with other heavy appliances.',
    ],
  },
  {
    // <= 1.5 HP
    maxHp: 1.5,
    electricalTips: [
      'Provide a dedicated 230V circuit; a 1.5HP class unit draws roughly 6-8A.',
      'Use at least 2.0mm2 copper wiring and verify a solid ground connection.',
    ],
    breakerTips: [
      'A dedicated 15A-20A breaker suits a unit in this HP class.',
      'Keep the AC on its own circuit, separate from other large loads.',
    ],
  },
  {
    // <= 2.0 HP
    maxHp: 2.0,
    electricalTips: [
      'Install a dedicated 230V circuit; a 2.0HP class unit draws roughly 9-12A.',
      'Use at least 3.5mm2 copper wiring and have a licensed electrician confirm the ground.',
    ],
    breakerTips: [
      'A dedicated 20A breaker is appropriate for a unit in this HP class.',
      'Never share this circuit with other appliances.',
    ],
  },
  {
    // <= 2.5 HP
    maxHp: 2.5,
    electricalTips: [
      'Provide a dedicated 230V circuit; a 2.5HP class unit draws roughly 12-15A.',
      'Use at least 3.5mm2 copper wiring and confirm the breaker panel has spare capacity.',
    ],
    breakerTips: [
      'A dedicated 25A breaker suits a unit in this HP class.',
      'Have a licensed electrician verify the panel and grounding before installation.',
    ],
  },
  {
    // > 2.5 HP (top class)
    maxHp: Infinity,
    electricalTips: [
      'Provide a dedicated 230V circuit sized by a licensed electrician; units above 2.5HP draw 15A or more.',
      'Use 5.5mm2 or larger copper wiring and confirm the supply and grounding can carry the load.',
    ],
    breakerTips: [
      'A dedicated 30A (or larger) breaker is typically required for a unit in this HP class.',
      'Have a licensed electrician size the breaker and wiring for the exact unit.',
    ],
  },
];

/**
 * Selects the electrical + breaker tips for the computed HP class (Req 1.8).
 * Returns the first class whose `maxHp` boundary is >= the computed HP, so the
 * tips always match the deterministically-computed horsepower rather than the
 * language model's opinion.
 */
function selectTipsByHpClass(recommendedHp: number): { electricalTips: string[]; breakerTips: string[] } {
  const hp = Number.isFinite(recommendedHp) && recommendedHp > 0 ? recommendedHp : 0;
  const cls = TIPS_BY_HP_CLASS.find((c) => hp <= c.maxHp) ?? TIPS_BY_HP_CLASS[TIPS_BY_HP_CLASS.length - 1];
  return { electricalTips: [...cls.electricalTips], breakerTips: [...cls.breakerTips] };
}

// --- HP-number reconciliation (C1, Req 1.6, 1.7) ---

/**
 * Formats a HP number the way it appears in prose (e.g. `2`, `1.5`). `String`
 * already renders `2` (not `2.0`) and `1.5` correctly for the values used here.
 */
function formatHp(hp: number): string {
  return String(hp);
}

/**
 * Replaces any horsepower figure appearing in advisory prose that differs from
 * the computed HP with the computed value, so the "Why this recommendation"
 * text uses one HP consistently (Req 1.6, 1.7). Matches numbers immediately
 * followed by an HP unit token ("HP", "hp", "horsepower", with optional space
 * or hyphen), e.g. "1.5 HP", "2HP", "3-hp", "2.0 horsepower".
 */
function reconcileHpInText(text: string | null | undefined, computedHp: number): string {
  if (!text) return '';
  const replacement = `${formatHp(computedHp)}HP`;
  return text.replace(
    /\b\d+(?:\.\d+)?\s*-?\s*(?:hp|horsepower)\b/gi,
    replacement
  );
}

/** Applies reconcileHpInText across every string in an array. */
function reconcileHpInList(items: string[], computedHp: number): string[] {
  return items.map((item) => reconcileHpInText(item, computedHp));
}

// --- Recommendation Service ---

/** Assigns Entry/Mid/Premium tiers to a price-sorted list of products. */
function assignTiers(sortedByPrice: AirconProduct[]): Map<number, ProductTier> {
  const tiers = new Map<number, ProductTier>();
  const n = sortedByPrice.length;
  if (n === 0) return tiers;
  if (n === 1) {
    tiers.set(sortedByPrice[0].id, 'mid');
    return tiers;
  }
  if (n === 2) {
    tiers.set(sortedByPrice[0].id, 'entry');
    tiers.set(sortedByPrice[1].id, 'premium');
    return tiers;
  }
  // 3+ products: cheapest = entry, most expensive = premium, middle band = mid.
  sortedByPrice.forEach((p, i) => {
    if (i === 0) tiers.set(p.id, 'entry');
    else if (i === n - 1) tiers.set(p.id, 'premium');
    else tiers.set(p.id, 'mid');
  });
  return tiers;
}

/**
 * Builds multi-unit alternatives for a high BTU requirement no single catalog
 * unit can satisfy (#19). E.g. a 10HP need becomes "5x 2HP" so DVTech can still
 * sell lower-HP products for large/commercial spaces.
 */
function buildMultiUnitAlternatives(
  totalBtu: number,
  products: AirconProduct[]
): MultiUnitAlternative[] {
  const alternatives: MultiUnitAlternative[] = [];

  // Consider the largest few distinct-capacity units as building blocks.
  const byCapacityDesc = [...products].sort((a, b) => b.btuCapacity - a.btuCapacity);
  const seenCapacity = new Set<number>();

  for (const product of byCapacityDesc) {
    if (seenCapacity.has(product.btuCapacity)) continue;
    seenCapacity.add(product.btuCapacity);
    if (product.btuCapacity <= 0) continue;

    const quantity = Math.ceil(totalBtu / product.btuCapacity);
    // Only meaningful as a "multi-unit" alternative when more than one is needed.
    if (quantity < 2) continue;

    alternatives.push({
      productId: product.id,
      brand: product.brand,
      model: product.model,
      horsepower: product.horsepower,
      btuCapacity: product.btuCapacity,
      price: Number(product.price),
      quantity,
      combinedBtu: quantity * product.btuCapacity,
      combinedPrice: quantity * Number(product.price),
      description:
        `${quantity} units of ${product.brand} ${product.model} ` +
        `(${product.horsepower}HP each) provide ${(quantity * product.btuCapacity).toLocaleString()} BTU combined.`,
    });

    if (alternatives.length >= 3) break;
  }

  // Fewest total units first, then cheapest.
  return alternatives.sort(
    (a, b) => a.quantity - b.quantity || a.combinedPrice - b.combinedPrice
  );
}

/**
 * Generates an AC recommendation.
 *
 * The BTU/HP math is computed DETERMINISTICALLY from the admin-managed BTU
 * factor rows (btuCalculationService) — editing a factor changes the result
 * immediately. Gemini is used only for advisory content: reasoning, unit-type
 * rationale, and electrical/breaker tips. If Gemini is unavailable, a sensible
 * rule-based fallback keeps the recommendation working.
 */
export async function generateRecommendation(
  roomAssessmentId: number,
  imageAnalysis?: RoomImageAnalysis,
  opencvAnalysis?: RoomAnalysisResult
): Promise<RecommendationResult> {
  // 1. Fetch RoomAssessment
  const roomAssessment = await RoomAssessment.findByPk(roomAssessmentId);
  if (!roomAssessment) {
    const error = new Error('Room assessment not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch BTU factors
  const btuFactors = await BtuFactor.findAll();
  if (btuFactors.length === 0) {
    const error = new Error('No BTU factors configured. Please contact an administrator.') as Error & { statusCode: number };
    error.statusCode = 422;
    throw error;
  }

  // 3. Fetch active products
  const products = await AirconProduct.findAll({ where: { isActive: true } });
  if (products.length === 0) {
    const error = new Error('No active products available in the catalog.') as Error & { statusCode: number };
    error.statusCode = 422;
    throw error;
  }

  // 4. DETERMINISTIC BTU computation from the factor rows.
  //
  // The Base_Load is computed from the customer's FORM INPUTS ONLY (no image
  // hints folded in), so the with-photo and without-photo paths share the same
  // base and can only differ by the capped OpenCV uplift (Req 3.8).
  const computation = computeBtu(
    {
      area: roomAssessment.area,
      ceilingHeight: roomAssessment.ceilingHeight,
      occupancy: roomAssessment.occupancy,
      sunlightLevel: roomAssessment.sunlightLevel,
    },
    btuFactors
  );

  const baseLoadBtu = computation.totalBtu;

  // 4b. Capped, line-itemized OpenCV uplift on top of the Base_Load (C3).
  //
  // Each image-derived contribution (windows, insulation, sunlight, heat
  // sources) is a separate labeled line item; the combined uplift is clamped to
  // `capFraction * baseLoadBtu` (default 0.15). The final total is derived AS
  // baseLoad + capped uplift so the displayed line items reconcile to the total
  // within ±1 BTU (Req 3.1, 3.2, 3.4). Heat sources declared on the form and
  // detected in the image are unioned so each distinct source counts once
  // (Req 3.3). When no image analysis is present, the uplift is empty and the
  // total equals the Base_Load.
  const uplift = computeOpenCvUplift(
    buildUpliftInput(baseLoadBtu, imageAnalysis, opencvAnalysis)
  );

  const totalBtu = uplift.totalBtu;

  // Photo-based analysis is applied only when image analysis is actually
  // present. On the graceful-degradation path (no image, or the
  // Image_Analysis_Service was unavailable) the uplift is empty and the total
  // equals the Base_Load, so we surface `photoAnalysisApplied: false` to the
  // customer (C3, Req 3.11).
  const photoAnalysisApplied = Boolean(imageAnalysis || opencvAnalysis);

  // 4d. DETERMINISTIC, table-driven HP derivation (C1, Req 1.3, 1.4). This runs
  // identically on the form-only and the OpenCV-assisted paths (Req 3.9): the
  // recommended HP is the smallest catalog tier whose rated BTU covers the
  // computed load, with a lowest-HP tie-break. When no tier qualifies or the
  // catalog has no tiers, fall back to the preliminary estimate so the flow
  // still returns a plausible unit size.
  const hpTiers = await buildHpTiersFromCatalog();
  const hpDerivation: HpDerivation = deriveHpFromTiers(totalBtu, hpTiers);
  const recommendedHp =
    hpDerivation.recommendedHp !== null
      ? hpDerivation.recommendedHp
      : computation.recommendedHp;

  // C1 exceeds-largest handling (Req 1.9): when the computed load is above every
  // catalog tier, we still return the LARGEST tier's unit card, but paired with
  // a site-survey-or-multiple-units message. `no-tier` (Req 1.13) yields a
  // "no matching unit" message; `no-catalog` (Req 1.14) is handled earlier by
  // the empty-products guard above. On both no-* paths `recommendedHp` falls
  // back to the preliminary estimate so the flow still returns a plausible size.
  const exceedsLargestTier = hpDerivation.kind === 'exceeds-largest';
  let capacityMessage: string | null = null;
  if (exceedsLargestTier) {
    capacityMessage =
      'This room needs more cooling than our largest single unit provides. ' +
      'We recommend an on-site survey, or installing multiple units to cover the load. ' +
      'The largest available unit is shown below as a reference.';
  } else if (hpDerivation.kind === 'no-tier') {
    capacityMessage =
      'No single unit in our catalog matches this cooling requirement. ' +
      'Please contact us for an on-site assessment.';
  }

  // 4c. Combined breakdown = base-load line items + each OpenCV uplift line
  // item. The sum of these lines equals `totalBtu` within ±1 BTU because the
  // total is derived as baseLoad + the (capped) sum of the uplift items
  // (Req 3.1, 3.2). When the raw uplift was clamped by the cap, a reconciling
  // "OpenCV adjustment (capped)" line carries the difference so the displayed
  // line items still sum to the displayed total.
  const combinedBreakdown: BtuBreakdownLine[] = [...computation.breakdown];
  if (uplift.capApplied) {
    // Cap clamped the raw uplift; show a single capped adjustment line so the
    // breakdown reconciles to the total (Req 3.2, 3.4).
    combinedBreakdown.push({
      label: `OpenCV adjustment (capped at ${Math.round(uplift.capFraction * 100)}% of base load)`,
      formula: `min(${uplift.rawUpliftBtu}, ${uplift.capBtu})`,
      btu: uplift.cappedUpliftBtu,
    });
  } else {
    // Uplift within the cap; show each image-derived contribution as its own line.
    for (const item of uplift.lineItems) {
      combinedBreakdown.push({ label: item.label, formula: 'image analysis', btu: item.btu });
    }
  }

  // 4e. DETERMINISTIC unit type (Req 1.1, 1.5). The permitted unit type is
  // decided by the code, not the language model: it is taken from the catalog
  // tier row backing the recommended HP (via `tierProductId`) when available,
  // otherwise coerced with `sanitizeUnitType`. This computed value is passed to
  // the advisory as a FIXED input and is what the final response reports, so
  // the model can never change the unit type (Req 1.5, 1.6).
  let computedUnitType: PermittedUnitType = 'Split Type';
  if (hpDerivation.tierProductId !== null) {
    const tierProduct = products.find((p) => p.id === hpDerivation.tierProductId);
    if (tierProduct) {
      computedUnitType = sanitizeUnitType(tierProduct.type);
    }
  }

  // 5. Advisory content from Gemini (reasoning + rationale). The computed HP and
  // unit type are passed as fixed inputs (Req 1.5); tips are NOT taken from the
  // model — they are selected by HP class below (Req 1.8).
  const advisory = await getAdvisory(
    roomAssessment,
    totalBtu,
    recommendedHp,
    computedUnitType,
    combinedBreakdown,
    photoAnalysisApplied ? uplift.narrativeFacts : undefined,
    roomAssessment.dailyUsage
  );

  // The unit type is the deterministically-computed value, overwriting anything
  // the model returned (Req 1.6). Products in the catalog store a free-form
  // `type` (e.g. "window-type" / "split-type"), so match case-insensitively on
  // the computed token rather than the exact display string.
  const sanitizedUnitType = computedUnitType;
  const unitTypeMatchToken = sanitizedUnitType === 'Window Type' ? 'window' : 'split';

  // Electrical + breaker tips are selected by the computed HP class (Req 1.8),
  // not by the model. HP figures in the reasoning/rationale that differ from the
  // computed HP are reconciled to the computed value (Req 1.6, 1.7).
  const hpClassTips = selectTipsByHpClass(recommendedHp);
  const reconciledReasoning = reconcileHpInText(advisory.reasoning, recommendedHp);
  const reconciledRationale = reconcileHpInText(advisory.unitTypeRationale, recommendedHp);
  const reconciledElectricalTips = reconcileHpInList(hpClassTips.electricalTips, recommendedHp);
  const reconciledBreakerTips = reconcileHpInList(hpClassTips.breakerTips, recommendedHp);

  // 6. Match products to the computed spec.
  //
  // Exceeds-largest path (Req 1.9): the load is above every catalog tier, so no
  // single unit "covers" it. Rather than fall through to the multi-unit path,
  // we return the LARGEST available unit as a reference card alongside the
  // site-survey message. The largest tier's product id is `tierProductId`.
  let candidateProducts: AirconProduct[] = [];
  if (exceedsLargestTier) {
    const largestTierProduct = hpDerivation.tierProductId !== null
      ? products.find((p) => p.id === hpDerivation.tierProductId)
      : undefined;
    if (largestTierProduct) {
      candidateProducts = [largestTierProduct];
    } else {
      // Fallback: pick the highest-capacity active product as the reference.
      candidateProducts = [...products]
        .filter((p) => p.btuCapacity > 0)
        .sort((a, b) => b.btuCapacity - a.btuCapacity)
        .slice(0, 1);
    }
  } else {
    // Prefer the computed unit type but fall back to any type so the customer
    // always gets options.
    candidateProducts = await AirconProduct.findAll({
      where: {
        type: { [Op.like]: `%${unitTypeMatchToken}%` },
        btuCapacity: { [Op.gte]: totalBtu * 0.9 },
        isActive: true,
      },
      order: [['btu_capacity', 'ASC'], ['price', 'ASC']],
    });

    if (candidateProducts.length === 0) {
      candidateProducts = await AirconProduct.findAll({
        where: { btuCapacity: { [Op.gte]: totalBtu * 0.9 }, isActive: true },
        order: [['btu_capacity', 'ASC'], ['price', 'ASC']],
      });
    }
  }

  // 7. If no single unit can cover the requirement, switch to the multi-unit
  // commercial path (#19). The exceeds-largest reference card above already
  // populated `candidateProducts`, so this only triggers for the ordinary
  // no-match case.
  const requiresMultiUnit = candidateProducts.length === 0;
  let multiUnitAlternatives: MultiUnitAlternative[] = [];
  let selectedProducts: AirconProduct[] = [];

  if (requiresMultiUnit) {
    multiUnitAlternatives = buildMultiUnitAlternatives(totalBtu, products);
    if (multiUnitAlternatives.length === 0) {
      const error = new Error(
        'No products in the catalog can meet this cooling requirement, even in combination.'
      ) as Error & { statusCode: number };
      error.statusCode = 422;
      throw error;
    }
    // Present the building-block units themselves as the product options.
    const altIds = multiUnitAlternatives.map((a) => a.productId);
    selectedProducts = products.filter((p) => altIds.includes(p.id));
  } else {
    // Pick up to 3 distinct-brand options closest to the requirement.
    const selectedBrands = new Set<string>();
    for (const product of candidateProducts) {
      if (!selectedBrands.has(product.brand)) {
        selectedProducts.push(product);
        selectedBrands.add(product.brand);
        if (selectedProducts.length >= 3) break;
      }
    }
    if (selectedProducts.length < 3) {
      for (const product of candidateProducts) {
        if (!selectedProducts.some((p) => p.id === product.id)) {
          selectedProducts.push(product);
          if (selectedProducts.length >= 3) break;
        }
      }
    }
  }

  const primaryProduct = selectedProducts[0] ?? null;

  // 8. Persist the recommendation (deterministic totals + Gemini reasoning).
  const recommendation = await AiRecommendation.create({
    roomAssessmentId,
    totalBtu,
    recommendedHp,
    unitType: sanitizedUnitType,
    productId: primaryProduct ? primaryProduct.id : null,
    troubleshootingNotes: advisory.troubleshootingNotes ? stripFloorTerm(advisory.troubleshootingNotes) : null,
    reasoning: stripFloorTerm(reconciledReasoning),
  });

  // 9. Persist the recommended products.
  await Promise.all(
    selectedProducts.map((product, index) =>
      RecommendedProduct.create({
        aiRecommendationId: recommendation.id,
        productId: product.id,
        rank: index + 1,
        isPrimary: index === 0,
      })
    )
  );

  // 10. Build the response payload.
  const recommendedProducts: RecommendedProductInfo[] = selectedProducts.map((product, index) => ({
    id: product.id,
    brand: product.brand,
    model: product.model,
    type: product.type,
    horsepower: product.horsepower,
    btuCapacity: product.btuCapacity,
    price: Number(product.price),
    description: product.description,
    rank: index + 1,
    isPrimary: index === 0,
  }));

  // Tier assignment is by price across the selected options.
  const byPrice = [...selectedProducts].sort((a, b) => Number(a.price) - Number(b.price));
  const tierMap = assignTiers(byPrice);
  const tieredProducts: TieredProductInfo[] = selectedProducts.map((product, index) => ({
    id: product.id,
    brand: product.brand,
    model: product.model,
    type: product.type,
    horsepower: product.horsepower,
    btuCapacity: product.btuCapacity,
    price: Number(product.price),
    description: product.description,
    rank: index + 1,
    isPrimary: index === 0,
    tier: tierMap.get(product.id) ?? 'mid',
    unitType: (product as unknown as { unitType?: string }).unitType ?? 'non-inverter',
  }));

  return {
    id: recommendation.id,
    roomAssessmentId: recommendation.roomAssessmentId,
    totalBtu: recommendation.totalBtu,
    recommendedHp: recommendation.recommendedHp,
    unitType: recommendation.unitType,
    productId: recommendation.productId,
    troubleshootingNotes: recommendation.troubleshootingNotes,
    reasoning: recommendation.reasoning,
    baseLoadBtu,
    cappedUpliftBtu: uplift.cappedUpliftBtu,
    openCvUpliftLineItems: uplift.lineItems,
    photoAnalysisApplied,
    narrativeFacts: uplift.narrativeFacts,
    computationBreakdown: combinedBreakdown,
    // Tips are selected by the computed HP class (Req 1.8) and HP-reconciled
    // (Req 1.7), then floor-term stripped (Req 1.2) — never taken from the model.
    electricalTips: stripFloorTermList(reconciledElectricalTips),
    breakerTips: stripFloorTermList(reconciledBreakerTips),
    unitTypeRationale: stripFloorTerm(reconciledRationale),
    // Inverter/non-inverter designation comes from the matched product row
    // (Req 1.10), falling back to the advisory only when there is no card.
    isInverterRecommended: primaryProduct
      ? primaryProduct.unitType === 'inverter'
      : advisory.isInverter,
    product: primaryProduct
      ? {
          id: primaryProduct.id,
          brand: primaryProduct.brand,
          model: primaryProduct.model,
          type: primaryProduct.type,
          horsepower: primaryProduct.horsepower,
          btuCapacity: primaryProduct.btuCapacity,
          price: Number(primaryProduct.price),
          description: primaryProduct.description,
        }
      : null,
    recommendedProducts,
    tieredProducts,
    multiUnitAlternatives,
    requiresMultiUnit,
    exceedsLargestTier,
    capacityMessage,
  };
}

// --- OpenCV uplift input assembly ---

/** Sunlight levels the uplift calculator understands. */
const UPLIFT_SUNLIGHT_LEVELS: readonly SunlightLevel[] = ['low', 'medium', 'high'];
/** Insulation qualities the uplift calculator understands. */
const UPLIFT_INSULATION_QUALITIES: readonly InsulationQuality[] = ['poor', 'fair', 'good'];

/** Coerces an arbitrary sunlight string to a permitted level, defaulting to 'low'. */
function toSunlightLevel(value: string | undefined | null): SunlightLevel {
  const v = (value ?? '').toLowerCase();
  return (UPLIFT_SUNLIGHT_LEVELS as readonly string[]).includes(v) ? (v as SunlightLevel) : 'low';
}

/** Coerces an arbitrary insulation string to a permitted quality, defaulting to 'fair'. */
function toInsulationQuality(value: string | undefined | null): InsulationQuality {
  const v = (value ?? '').toLowerCase();
  return (UPLIFT_INSULATION_QUALITIES as readonly string[]).includes(v)
    ? (v as InsulationQuality)
    : 'fair';
}

/**
 * Assembles the {@link computeOpenCvUplift} input from the base load and the
 * available image analysis. The Gemini (semantic) and OpenCV (objective)
 * results describe the same photo, so their metrics are combined: the higher
 * window count is used and the heat-source lists are passed through as the
 * image side (they are de-duplicated against each other and the form inside
 * `computeOpenCvUplift`). When neither analysis is present, every image-derived
 * field is empty/neutral so the uplift is zero and the total equals the
 * Base_Load (the graceful-degradation path is completed in Task 8.3).
 *
 * The current room form has no free-form heat-source field, so
 * `formHeatSources` is empty today; keeping it as a distinct input preserves
 * the form-vs-image union semantics (Req 3.3) for when the form gains one.
 */
function buildUpliftInput(
  baseLoadBtu: number,
  imageAnalysis?: RoomImageAnalysis,
  opencvAnalysis?: RoomAnalysisResult
) {
  const windowCount = Math.max(
    imageAnalysis?.windowCount ?? 0,
    opencvAnalysis?.windowCount ?? 0
  );

  // Prefer the OpenCV objective insulation/sunlight reading, falling back to
  // the Gemini semantic reading, then to a neutral default.
  const insulationQuality = toInsulationQuality(
    opencvAnalysis?.insulationQuality ?? imageAnalysis?.insulationQuality
  );
  const sunlightLevel = toSunlightLevel(
    opencvAnalysis?.sunlightExposure ?? imageAnalysis?.sunlightExposure
  );

  const imageHeatSources = [
    ...(imageAnalysis?.heatSources ?? []),
    ...(opencvAnalysis?.heatSources ?? []),
  ];

  return {
    baseLoadBtu,
    windowCount,
    insulationQuality,
    sunlightLevel,
    formHeatSources: [] as string[],
    imageHeatSources,
  };
}

// --- Gemini advisory ---

interface AdvisoryResult {
  unitType: string;
  isInverter: boolean;
  reasoning: string;
  unitTypeRationale: string;
  electricalTips: string[];
  breakerTips: string[];
  troubleshootingNotes: string | null;
}

/** Rule-based advisory used when Gemini is unavailable, so the flow never breaks. */
function fallbackAdvisory(
  totalBtu: number,
  recommendedHp: number,
  dailyUsage?: number | null
): AdvisoryResult {
  // Small rooms → window-type is economical; larger loads → split-type inverter.
  const unitType = recommendedHp <= 1.0 ? 'window-type' : 'split-type';
  // Heavy daily use (>=8h) tips the balance to an inverter for running-cost
  // savings even on smaller loads.
  const heavyUsage = typeof dailyUsage === 'number' && dailyUsage >= 8;
  const isInverter = recommendedHp >= 1.0 || heavyUsage;
  const amps = Math.ceil((recommendedHp * 746) / 230 / 0.9);
  // Coerce to a permitted display type (Req 1.1) and strip any "floor" term
  // (Req 1.2) so the rule-based fallback obeys the same guardrails as the LLM path.
  const displayUnitType = sanitizeUnitType(unitType);
  return {
    unitType: displayUnitType,
    isInverter,
    reasoning: stripFloorTerm(
      `Based on a calculated ${totalBtu.toLocaleString()} BTU requirement, a ${recommendedHp}HP ${displayUnitType} unit is recommended.`
    ),
    unitTypeRationale: stripFloorTerm(
      isInverter
        ? `An inverter ${displayUnitType} is recommended because it modulates compressor speed, cutting electricity use for a load of this size.`
        : `A ${displayUnitType} unit is a cost-effective match for this smaller cooling load.`
    ),
    electricalTips: stripFloorTermList([
      `Use a dedicated circuit for the unit; expect roughly ${amps}A running current at ${recommendedHp}HP.`,
      'Have a licensed electrician confirm wiring gauge and outlet rating before installation.',
    ]),
    breakerTips: stripFloorTermList([
      `A dedicated ${Math.max(15, Math.ceil(amps / 5) * 5)}A breaker is typically appropriate for this unit.`,
      'Do not share the AC circuit with other heavy appliances.',
    ]),
    troubleshootingNotes: null,
  };
}

/**
 * Asks Gemini for advisory content around the already-computed BTU/HP.
 * Never throws — falls back to rule-based advice on any failure.
 */
async function getAdvisory(
  roomAssessment: RoomAssessment,
  totalBtu: number,
  recommendedHp: number,
  computedUnitType: PermittedUnitType,
  breakdown: BtuBreakdownLine[],
  narrativeFacts?: NarrativeFacts,
  dailyUsage?: number | null
): Promise<AdvisoryResult> {
  let genAI: GoogleGenerativeAI;
  try {
    genAI = getGeminiClient();
  } catch {
    return fallbackAdvisory(totalBtu, recommendedHp, dailyUsage);
  }

  // Strip the term "floor" (case-insensitive) from the advisory prompt before
  // it is sent to the model (Req 1.2 — the prompt is explicitly named). This
  // also drops any floor-mounted unit type from the model's allowed `unit_type`
  // list so the advisory prompt cannot request "floor-standing". stripFloorTerm
  // preserves newlines, so the structured prompt sections remain intact.
  const prompt = stripFloorTerm(
    buildAdvisoryPrompt(
      roomAssessment,
      totalBtu,
      recommendedHp,
      computedUnitType,
      breakdown,
      narrativeFacts,
      dailyUsage
    )
  );
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const systemInstruction = stripFloorTerm(
    'You are an expert HVAC engineer advising a Philippine AC retailer (DVTech). The total BTU and recommended HP have ALREADY been calculated for you — do NOT recalculate them. Provide advisory content only. Return valid JSON only, no markdown.'
  );

  let rawContent = '';
  try {
    const result = await model.generateContent(`${systemInstruction}\n\n${prompt}`);
    rawContent = result.response.text();
  } catch (err: unknown) {
    console.error('[getAdvisory] Gemini failed, using fallback:', err instanceof Error ? err.message : err);
    return fallbackAdvisory(totalBtu, recommendedHp, dailyUsage);
  }

  let jsonString = rawContent.trim();
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonString = jsonMatch[1].trim();

  let parsed: GeminiAdvisoryResponse;
  try {
    parsed = JSON.parse(jsonString) as GeminiAdvisoryResponse;
  } catch {
    return fallbackAdvisory(totalBtu, recommendedHp, dailyUsage);
  }

  // The unit type is FIXED to the deterministically-computed value passed in
  // (Req 1.5, 1.6) — the model's `unit_type` is ignored so it can never change
  // the recommended unit type.
  const unitType = computedUnitType;

  const rawReasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0
    ? parsed.reasoning
    : fallbackAdvisory(totalBtu, recommendedHp, dailyUsage).reasoning;
  const rawRationale = typeof parsed.unit_type_rationale === 'string' ? parsed.unit_type_rationale : '';
  const rawElectricalTips = Array.isArray(parsed.electrical_tips) ? parsed.electrical_tips.filter((t) => typeof t === 'string') : [];
  const rawBreakerTips = Array.isArray(parsed.breaker_tips) ? parsed.breaker_tips.filter((t) => typeof t === 'string') : [];
  const rawTroubleshooting = typeof parsed.troubleshooting_notes === 'string' ? parsed.troubleshooting_notes : null;

  // Strip the term "floor" (case-insensitive) from every advisory string the
  // customer sees before it leaves the service (Req 1.2).
  return {
    unitType,
    isInverter: typeof parsed.is_inverter === 'boolean' ? parsed.is_inverter : recommendedHp >= 1.0,
    reasoning: stripFloorTerm(rawReasoning),
    unitTypeRationale: stripFloorTerm(rawRationale),
    electricalTips: stripFloorTermList(rawElectricalTips),
    breakerTips: stripFloorTermList(rawBreakerTips),
    troubleshootingNotes: rawTroubleshooting !== null ? stripFloorTerm(rawTroubleshooting) : null,
  };
}

// --- Advisory Prompt Builder ---

function buildAdvisoryPrompt(
  roomAssessment: RoomAssessment,
  totalBtu: number,
  recommendedHp: number,
  computedUnitType: PermittedUnitType,
  breakdown: BtuBreakdownLine[],
  narrativeFacts?: NarrativeFacts,
  dailyUsage?: number | null
): string {
  const sections: string[] = [];

  const usageLine =
    typeof dailyUsage === 'number'
      ? `\n- Daily Usage: ${dailyUsage} hours/day`
      : '';
  sections.push(`## Room Data
- Area: ${roomAssessment.area} sq meters
- Ceiling Height: ${roomAssessment.ceilingHeight} meters
- Occupancy: ${roomAssessment.occupancy} persons
- Sunlight Level: ${roomAssessment.sunlightLevel}${usageLine}`);

  const breakdownList = breakdown.map((b) => `- ${b.label}: ${b.formula} = ${b.btu} BTU`).join('\n');
  sections.push(`## Pre-Calculated BTU Breakdown (authoritative — do not change)
${breakdownList}
- TOTAL: ${totalBtu} BTU
- Recommended HP: ${recommendedHp}
- Recommended Unit Type: ${computedUnitType} (FIXED — do not change or suggest any other unit type)`);

  // The narrative is derived ONLY from measured room values (Req 3.5). We pass
  // the model just the facts the measurements support: a multi-window statement
  // only when more than one window was measured (Req 3.6), and a poor-insulation
  // statement only when insulation measured `poor` (Req 3.7). Anything not
  // backed by a measured value is deliberately omitted so the model cannot
  // invent it.
  if (narrativeFacts) {
    const factLines: string[] = [
      `- Windows measured: ${narrativeFacts.windows}`,
      `- Multiple windows present: ${narrativeFacts.multipleWindows ? 'yes' : 'no'}`,
      `- Poor insulation: ${narrativeFacts.poorInsulation ? 'yes' : 'no'}`,
      `- Sunlight level: ${narrativeFacts.sunlight}`,
      `- Heat sources: ${
        narrativeFacts.heatSources.length > 0 ? narrativeFacts.heatSources.join(', ') : 'None'
      }`,
    ];
    sections.push(`## Measured Room Facts (the ONLY facts you may reference in prose)
${factLines.join('\n')}
Do NOT claim multiple windows unless "Multiple windows present" is yes. Do NOT claim poor insulation unless "Poor insulation" is yes. Do NOT mention any room condition not listed above.`);
  }

  sections.push(`## Instructions
The BTU total (${totalBtu}), HP (${recommendedHp}), and unit type (${computedUnitType}) are already final. Do NOT recompute or change them, and use exactly "${recommendedHp}HP" and "${computedUnitType}" in your prose.
Provide advisory content for the customer. Return a JSON object:
- "unit_type": must be exactly "${computedUnitType}" (this value is fixed; it will be enforced regardless of what you return).
- "is_inverter": boolean — whether an inverter unit is recommended. Prefer an inverter when daily usage is high (>= 8 hours/day) or the load is large, since it lowers running cost; a non-inverter can be fine for light, occasional use.
- "reasoning": string — a concise, customer-friendly explanation of why this HP and unit type suit the room
- "unit_type_rationale": string — specifically explain WHY this unit type AND why inverter vs non-inverter
- "troubleshooting_notes": string or null — any concerns from the image analysis (null if no image)
Keep every string concise and non-technical where possible.`);

  return sections.join('\n\n');
}


