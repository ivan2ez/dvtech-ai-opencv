import api from './api';
import type { AirconProduct, PaginatedResponse, ProductFormData } from '../types';

export async function getProducts(params?: {
  page?: number;
  pageSize?: number;
  type?: string;
  sortByPrice?: 'asc' | 'desc';
}): Promise<PaginatedResponse<AirconProduct>> {
  const response = await api.get<PaginatedResponse<AirconProduct>>('/products', { params });
  return response.data;
}

export async function getProductById(id: number): Promise<AirconProduct> {
  const response = await api.get<AirconProduct>(`/products/${id}`);
  return response.data;
}

export async function createProduct(data: ProductFormData): Promise<AirconProduct> {
  const response = await api.post<AirconProduct>('/products', data);
  return response.data;
}

export async function updateProduct(id: number, data: ProductFormData): Promise<AirconProduct> {
  const response = await api.put<AirconProduct>(`/products/${id}`, data);
  return response.data;
}

export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`/products/${id}`);
}
