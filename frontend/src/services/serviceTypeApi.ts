import api from './api';
import type { ServiceType } from '../types';

export interface ServiceTypeFormData {
  name: string;
  description: string;
  price: number;
  sortWeight?: number;
}

/**
 * Available services only — this is the customer-facing list, so services
 * marked Unavailable are already excluded by the server.
 */
export async function getServiceTypes(): Promise<ServiceType[]> {
  const response = await api.get<ServiceType[]>('/services');
  return response.data;
}

/**
 * Every service including Unavailable ones. Admin-only; needed so a service
 * that's been switched off can still be found and switched back on.
 */
export async function getAllServiceTypesForAdmin(): Promise<ServiceType[]> {
  const response = await api.get<ServiceType[]>('/services/manage');
  return response.data;
}

/** Marks a service Available or Unavailable. */
export async function setServiceTypeAvailability(
  id: number,
  isAvailable: boolean
): Promise<ServiceType> {
  const response = await api.patch<{ serviceType: ServiceType }>(
    `/services/${id}/availability`,
    { isAvailable }
  );
  return response.data.serviceType;
}

export async function createServiceType(data: ServiceTypeFormData): Promise<ServiceType> {
  const response = await api.post<ServiceType>('/services', data);
  return response.data;
}

export async function updateServiceType(id: number, data: ServiceTypeFormData): Promise<ServiceType> {
  const response = await api.put<ServiceType>(`/services/${id}`, data);
  return response.data;
}

/** Archives a service (moves it to the recycle bin). */
export async function deleteServiceType(id: number): Promise<void> {
  await api.delete(`/services/${id}`);
}

// --- Archive (soft delete → Archive view) ---

/** Lists archived services. */
export async function getArchivedServiceTypes(): Promise<ServiceType[]> {
  const response = await api.get<ServiceType[]>('/services/archived');
  return response.data;
}

/** Restores an archived service. */
export async function restoreServiceType(id: number): Promise<void> {
  await api.post(`/services/${id}/restore`);
}

/** Permanently deletes an archived service. */
export async function deleteServiceTypePermanently(id: number): Promise<void> {
  await api.delete(`/services/${id}/permanent`);
}
