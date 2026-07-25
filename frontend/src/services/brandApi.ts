import api from './api';

export interface Brand {
  id: number;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getBrands(): Promise<Brand[]> {
  const response = await api.get<Brand[]>('/brands');
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

export async function deleteBrand(id: number): Promise<void> {
  await api.delete(`/brands/${id}`);
}
