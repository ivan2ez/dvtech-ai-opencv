import api from './api';

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
