import api from './api';
import type { ServiceType } from '../types';

export interface ServiceTypeFormData {
  name: string;
  description: string;
  price: number;
}

export async function getServiceTypes(): Promise<ServiceType[]> {
  const response = await api.get<ServiceType[]>('/services');
  return response.data;
}

export async function createServiceType(data: ServiceTypeFormData): Promise<ServiceType> {
  const response = await api.post<ServiceType>('/services', data);
  return response.data;
}

export async function updateServiceType(id: number, data: ServiceTypeFormData): Promise<ServiceType> {
  const response = await api.put<ServiceType>(`/services/${id}`, data);
  return response.data;
}

export async function deleteServiceType(id: number): Promise<void> {
  await api.delete(`/services/${id}`);
}
