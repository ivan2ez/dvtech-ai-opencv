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

/** Archives a BTU factor (moves it to the recycle bin). */
export async function deleteBtuFactor(id: number): Promise<void> {
  await api.delete(`/btu-factors/${id}`);
}

// --- Archive (soft delete → Archive view) ---

/** Lists archived BTU factors. */
export async function getArchivedBtuFactors(): Promise<BtuFactor[]> {
  const response = await api.get<BtuFactor[]>('/btu-factors/archived');
  return response.data;
}

/** Restores an archived BTU factor. */
export async function restoreBtuFactor(id: number): Promise<void> {
  await api.post(`/btu-factors/${id}/restore`);
}

/** Permanently deletes an archived BTU factor. */
export async function deleteBtuFactorPermanently(id: number): Promise<void> {
  await api.delete(`/btu-factors/${id}/permanent`);
}
