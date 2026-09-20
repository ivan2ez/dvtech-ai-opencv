import api from './api';

// --- OpenCV Analysis Types ---

export interface OpenCVInsulationMetrics {
  edgeDensity: number;
  surfaceVarianceScore: number;
  brightAreaRatio: number;
  colorConsistency: number;
  insulationScore: number;
}

export interface OpenCVWindowRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  brightness: number;
  rectangularity: number;
}

export interface OpenCVAnalysis {
  windowCount: number;
  sunlightExposure: 'low' | 'medium' | 'high';
  heatSources: string[];
  insulationQuality: 'poor' | 'fair' | 'good';
  brightnessScore: number;
  contrastScore: number;
  warmAreaRatio: number;
  details?: {
    windowRegions?: OpenCVWindowRegion[];
    insulationMetrics?: OpenCVInsulationMetrics;
  };
}

export interface RoomAssessmentInput {
  area: number;
  ceilingHeight: number;
  occupancy: number;
  sunlightLevel: string;
  /** Hours per day the AC runs (0-24). */
  dailyUsage?: number;
  serviceRequestId?: number;
  image?: File;
}

/** One line of the BTU computation breakdown (table-style display). */
export interface BtuBreakdownLine {
  label: string;
  formula: string;
  btu: number;
}

export type ProductTier = 'entry' | 'mid' | 'premium';

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

export interface TieredProductInfo extends RecommendedProductInfo {
  tier: ProductTier;
  unitType: string;
}

export interface MultiUnitAlternative {
  productId: number;
  brand: string;
  model: string;
  horsepower: number;
  btuCapacity: number;
  price: number;
  quantity: number;
  combinedBtu: number;
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
  computationBreakdown: BtuBreakdownLine[];
  electricalTips: string[];
  breakerTips: string[];
  unitTypeRationale: string;
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
  tieredProducts: TieredProductInfo[];
  multiUnitAlternatives: MultiUnitAlternative[];
  requiresMultiUnit: boolean;
}

export interface RoomAssessmentResponse {
  roomAssessment: {
    id: number;
    serviceRequestId: number;
    area: number;
    ceilingHeight: number;
    occupancy: number;
    sunlightLevel: string;
    imagePath: string | null;
  };
  recommendation: RecommendationResult;
  opencvAnalysis: OpenCVAnalysis | null;
}

export async function submitRoomAssessment(input: RoomAssessmentInput): Promise<RoomAssessmentResponse> {
  const formData = new FormData();
  formData.append('area', String(input.area));
  formData.append('ceilingHeight', String(input.ceilingHeight));
  formData.append('occupancy', String(input.occupancy));
  formData.append('sunlightLevel', input.sunlightLevel);
  if (input.dailyUsage !== undefined && input.dailyUsage !== null) {
    formData.append('dailyUsage', String(input.dailyUsage));
  }
  if (input.serviceRequestId) {
    formData.append('serviceRequestId', String(input.serviceRequestId));
  }
  if (input.image) {
    formData.append('image', input.image);
  }
  const response = await api.post('/ai/room-assessment', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getRecommendation(roomAssessmentId: number): Promise<{ recommendation: RecommendationResult }> {
  const response = await api.get(`/ai/recommendations/${roomAssessmentId}`);
  return response.data;
}

// --- Troubleshooting (Gemini) ---

export interface TroubleshootingInput {
  issue: string;
  acType?: string;
  brand?: string;
  model?: string;
  symptoms?: string[];
  image?: File;
}

export interface TroubleshootingResult {
  diagnosis: string;
  possibleCauses: string[];
  suggestedFixes: string[];
  severity: 'low' | 'moderate' | 'high' | 'critical';
  requiresTechnician: boolean;
  additionalNotes: string | null;
}

export async function submitTroubleshooting(input: TroubleshootingInput): Promise<TroubleshootingResult> {
  const formData = new FormData();
  formData.append('issue', input.issue);
  if (input.acType) formData.append('acType', input.acType);
  if (input.brand) formData.append('brand', input.brand);
  if (input.model) formData.append('model', input.model);
  if (input.symptoms && input.symptoms.length > 0) {
    input.symptoms.forEach((s) => formData.append('symptoms[]', s));
  }
  if (input.image) {
    formData.append('image', input.image);
  }
  const response = await api.post('/ai/troubleshoot', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
