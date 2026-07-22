import api from './api';
import type { PaginatedResponse } from '../types';

// --- Customer Types ---

export interface CustomerAccount {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

// --- Technician Types ---

export interface TechnicianAccount {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  technicianDetail?: {
    specialization: string;
    contactNumber: string;
    availabilityStatus: 'available' | 'busy' | 'unavailable';
  };
}

export interface CreateTechnicianData {
  name: string;
  email: string;
  password: string;
  specialization: string;
  contactNumber: string;
}

export interface UpdateTechnicianData {
  name?: string;
  email?: string;
  specialization?: string;
  contactNumber?: string;
}

// --- Customer Endpoints ---

export async function getCustomers(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<CustomerAccount>> {
  const response = await api.get<PaginatedResponse<CustomerAccount>>('/admin/customers', { params });
  return response.data;
}

export async function deactivateCustomer(id: number): Promise<void> {
  await api.patch(`/admin/customers/${id}/deactivate`);
}

// --- Technician Endpoints ---

export async function getTechnicians(): Promise<TechnicianAccount[]> {
  const response = await api.get<TechnicianAccount[]>('/admin/technicians');
  return response.data;
}

export async function createTechnician(data: CreateTechnicianData): Promise<TechnicianAccount> {
  const response = await api.post<TechnicianAccount>('/admin/technicians', data);
  return response.data;
}

export async function updateTechnician(id: number, data: UpdateTechnicianData): Promise<TechnicianAccount> {
  const response = await api.put<TechnicianAccount>(`/admin/technicians/${id}`, data);
  return response.data;
}

export async function deactivateTechnician(id: number): Promise<void> {
  await api.patch(`/admin/technicians/${id}/deactivate`);
}
