import api from './api';
import type { BtuFactor, BtuFactorFormData } from '../types';

export async function getBtuFactors(): Promise<BtuFactor[]> {
  const response = await api.get<BtuFactor[]>('/btu-factors');
  return response.data;
}

export async function getBtuFactorById(id: number): Promise<BtuFactor> {
  const response = await api.get<BtuFactor>(`/btu-factors/${id}`);
  return response.data;
}

export async function createBtuFactor(data: BtuFactorFormData): Promise<BtuFactor> {
  const response = await api.post<BtuFactor>('/btu-factors', data);
  return response.data;
}

export async function updateBtuFactor(id: number, data: BtuFactorFormData): Promise<BtuFactor> {
  const response = await api.put<BtuFactor>(`/btu-factors/${id}`, data);
  return response.data;
}

export async function deleteBtuFactor(id: number): Promise<void> {
  await api.delete(`/btu-factors/${id}`);
}
