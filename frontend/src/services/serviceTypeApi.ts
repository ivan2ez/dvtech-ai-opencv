import api from './api';
import type { ServiceType } from '../types';

export async function getServiceTypes(): Promise<ServiceType[]> {
  const response = await api.get<ServiceType[]>('/services');
  return response.data;
}
