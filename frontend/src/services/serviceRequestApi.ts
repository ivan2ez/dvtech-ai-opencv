import api from './api';
import type {
  ServiceRequest,
  ServiceRequestFormData,
  ServiceTimeSlot,
  PaginatedResponse,
  BackendPaginatedResponse,
} from '../types';

export async function createServiceRequest(data: ServiceRequestFormData): Promise<ServiceRequest> {
  const response = await api.post<ServiceRequest>('/service-requests', data);
  return response.data;
}

export async function getServiceRequests(params?: {
  page?: number;
  pageSize?: number;
  /** Customer recycle-bin scope: 'deleted' returns the bin; omit for active. */
  scope?: 'active' | 'deleted';
}): Promise<PaginatedResponse<ServiceRequest>> {
  const response = await api.get<BackendPaginatedResponse<ServiceRequest>>('/service-requests', { params });
  const raw = response.data;
  return {
    data: raw.data,
    pagination: {
      page: raw.page,
      pageSize: raw.pageSize,
      totalItems: raw.total,
      totalPages: raw.totalPages,
    },
  };
}

/** Moves the customer's own request to their recycle bin. */
export async function deleteOwnRequest(id: number): Promise<void> {
  await api.delete(`/service-requests/${id}`);
}

/** Restores the customer's request from the recycle bin. */
export async function restoreOwnRequest(id: number): Promise<void> {
  await api.post(`/service-requests/${id}/restore`);
}

/** Permanently deletes the customer's request (only from the recycle bin). */
export async function permanentlyDeleteOwnRequest(id: number): Promise<void> {
  await api.delete(`/service-requests/${id}/permanent`);
}

// --- Admin archive (soft delete → Archive view; distinct from the customer
// recycle bin above, which uses different endpoints) ---

/** Lists archived service requests (admin). */
export async function getArchivedServiceRequests(): Promise<ServiceRequest[]> {
  const response = await api.get<{ data: ServiceRequest[] }>('/service-requests/archived');
  return response.data.data;
}

/** Archives a service request (admin). */
export async function archiveServiceRequest(id: number): Promise<void> {
  await api.delete(`/service-requests/${id}/archive`);
}

/** Restores an archived service request (admin). */
export async function restoreServiceRequestAdmin(id: number): Promise<void> {
  await api.post(`/service-requests/${id}/admin-restore`);
}

/** Permanently deletes an archived service request (admin). */
export async function permanentlyDeleteServiceRequestAdmin(id: number): Promise<void> {
  await api.delete(`/service-requests/${id}/admin-permanent`);
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

// ─── Rescheduling ──────────────────────────────────────────────────────────────

export interface ProposeRescheduleData {
  proposedDate: string;
  proposedTime: ServiceTimeSlot;
  /** Optional — the admin may propose a date without picking a technician. */
  proposedTechnicianId?: number | null;
  reason?: string;
}

export interface ProposeRescheduleResult {
  serviceRequest: ServiceRequest;
  /** False when the server could not email the customer. */
  emailDelivered: boolean;
  expiresAt: string;
  message: string;
}

/**
 * Admin: proposes a new schedule when no technician is available on the
 * customer's chosen slot. Moves the request to "Needs Rescheduling" and starts
 * the customer's 48-hour response window.
 */
export async function proposeReschedule(
  id: number,
  data: ProposeRescheduleData
): Promise<ProposeRescheduleResult> {
  const response = await api.patch<ProposeRescheduleResult>(
    `/service-requests/${id}/reschedule`,
    data
  );
  return response.data;
}

/**
 * Customer: accepts (→ Assigned) or declines (→ Declined) the proposed
 * schedule. Notes are optional and only recorded when declining.
 */
export async function respondToReschedule(
  id: number,
  action: 'accept' | 'decline',
  notes?: string
): Promise<ServiceRequest> {
  const response = await api.patch<{ serviceRequest: ServiceRequest }>(
    `/service-requests/${id}/reschedule/respond`,
    { action, notes }
  );
  return response.data.serviceRequest;
}
