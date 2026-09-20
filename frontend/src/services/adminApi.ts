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
    availabilityStatus: 'available' | 'unavailable';
    street?: string | null;
    barangay?: string | null;
    city?: string | null;
    province?: string | null;
  };
}

export interface CreateTechnicianData {
  name: string;
  email: string;
  password: string;
  specialization: string;
  contactNumber: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
}

export interface UpdateTechnicianData {
  name?: string;
  email?: string;
  specialization?: string;
  contactNumber?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
}

// --- Customer Endpoints ---

export async function getCustomers(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<CustomerAccount>> {
  const response = await api.get<PaginatedResponse<CustomerAccount>>('/admin/customers', { params });
  return response.data;
}

// --- Technician Endpoints ---

export async function getTechnicians(): Promise<TechnicianAccount[]> {
  const response = await api.get<{ data: TechnicianAccount[] }>('/admin/technicians');
  return response.data.data;
}

export async function createTechnician(data: CreateTechnicianData): Promise<TechnicianAccount> {
  const response = await api.post<TechnicianAccount>('/admin/technicians', data);
  return response.data;
}

export async function updateTechnician(id: number, data: UpdateTechnicianData): Promise<TechnicianAccount> {
  const response = await api.put<TechnicianAccount>(`/admin/technicians/${id}`, data);
  return response.data;
}

// --- Activation & Archive (shared shape for both roles) ---

/** Which account collection an archive/activation call targets. */
export type AccountRole = 'customer' | 'technician';

export interface ArchivedAccount {
  id: number;
  name: string;
  email: string;
  role: AccountRole;
  createdAt: string;
  deletedAt: string | null;
}

/** Records a permanent delete would remove along with the account. */
export interface AccountDeletionImpact {
  serviceRequests: number;
  schedules: number;
}

function accountPath(role: AccountRole): string {
  return role === 'customer' ? 'customers' : 'technicians';
}

/**
 * Activate/Deactivate toggle.
 *
 * `skipErrorToast` is set so the caller (ManageAccounts) can render the
 * backend's reason inline in the confirm dialog — e.g. the 409 raised when
 * deactivating a technician who still has an active job — without also getting
 * a duplicate toast from the global interceptor.
 */
export async function setAccountActive(
  role: AccountRole,
  id: number,
  isActive: boolean,
  /**
   * Optional auto-reactivation span in days (1–4) when deactivating. Omit or
   * pass null for an indefinite ("forever") deactivation. Ignored when
   * activating.
   */
  durationDays?: number | null
): Promise<void> {
  await api.patch(
    `/admin/${accountPath(role)}/${id}/status`,
    { isActive, durationDays: isActive ? null : durationDays ?? null },
    { skipErrorToast: true }
  );
}

/**
 * Soft-deletes the account into the archive.
 * The backend rejects this while the account is still active.
 */
export async function archiveAccount(role: AccountRole, id: number): Promise<void> {
  await api.delete(`/admin/${accountPath(role)}/${id}`);
}

export async function getArchivedAccounts(role: AccountRole): Promise<ArchivedAccount[]> {
  const response = await api.get<{ data: ArchivedAccount[] }>(
    `/admin/${accountPath(role)}/archived`
  );
  return response.data.data;
}

export async function restoreAccount(role: AccountRole, id: number): Promise<void> {
  await api.post(`/admin/${accountPath(role)}/${id}/restore`);
}

export async function getAccountDeletionImpact(
  role: AccountRole,
  id: number
): Promise<AccountDeletionImpact> {
  const response = await api.get<AccountDeletionImpact>(
    `/admin/${accountPath(role)}/${id}/deletion-impact`
  );
  return response.data;
}

/** Irreversible. Only allowed for accounts already in the archive. */
export async function deleteAccountPermanently(role: AccountRole, id: number): Promise<void> {
  await api.delete(`/admin/${accountPath(role)}/${id}/permanent`);
}
