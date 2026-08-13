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
  serviceRequestId?: number;
  image?: File;
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
