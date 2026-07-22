import api from './api';
import type { ServiceRequest, ServiceRequestFormData, PaginatedResponse } from '../types';

export async function createServiceRequest(data: ServiceRequestFormData): Promise<ServiceRequest> {
  const response = await api.post<ServiceRequest>('/service-requests', data);
  return response.data;
}

export async function getServiceRequests(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<ServiceRequest>> {
  const response = await api.get<PaginatedResponse<ServiceRequest>>('/service-requests', { params });
  return response.data;
}

export async function getServiceRequestById(id: number): Promise<ServiceRequest> {
  const response = await api.get<ServiceRequest>(`/service-requests/${id}`);
  return response.data;
}

export async function approveServiceRequest(id: number): Promise<ServiceRequest> {
  const response = await api.patch<{ serviceRequest: ServiceRequest }>(`/service-requests/${id}/approve`);
  return response.data.serviceRequest;
}

export async function rejectServiceRequest(id: number, reason: string): Promise<ServiceRequest> {
  const response = await api.patch<{ serviceRequest: ServiceRequest }>(`/service-requests/${id}/reject`, { reason });
  return response.data.serviceRequest;
}
