import api from './api';

export interface Brand {
  id: number;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  /** Set when the brand has been archived. */
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Live brands. Archived ones are excluded by the server. */
export async function getBrands(): Promise<Brand[]> {
  const response = await api.get<Brand[]>('/brands');
  return response.data;
}

/** Archived brands, available for restore or permanent deletion. */
export async function getArchivedBrands(): Promise<Brand[]> {
  const response = await api.get<Brand[]>('/brands/archived');
  return response.data;
}

export async function createBrand(name: string, logo?: File): Promise<Brand> {
  const formData = new FormData();
  formData.append('name', name);
  if (logo) formData.append('logo', logo);
  const response = await api.post<Brand>('/brands', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateBrand(id: number, name: string, logo?: File): Promise<Brand> {
  const formData = new FormData();
  formData.append('name', name);
  if (logo) formData.append('logo', logo);
  const response = await api.put<Brand>(`/brands/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** Soft delete: moves the brand to the archive. */
export async function deleteBrand(id: number): Promise<void> {
  await api.delete(`/brands/${id}`);
}

export async function restoreBrand(id: number): Promise<void> {
  await api.post(`/brands/${id}/restore`);
}

/** Irreversible. Only allowed for brands already in the archive. */
export async function deleteBrandPermanently(id: number): Promise<void> {
  await api.delete(`/brands/${id}/permanent`);
}
