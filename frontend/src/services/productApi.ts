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

// --- Product Images ---

export interface ProductImageData {
  id: number;
  productId: number;
  imageUrl: string;
  isCover: boolean;
  sortOrder: number;
  createdAt: string;
}

export async function getProductImages(productId: number): Promise<ProductImageData[]> {
  const response = await api.get<{ images: ProductImageData[] }>(`/products/${productId}/images`);
  return response.data.images;
}

export async function uploadProductImages(productId: number, files: File[]): Promise<ProductImageData[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const response = await api.post<{ images: ProductImageData[] }>(`/products/${productId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.images;
}

export async function setCoverImage(productId: number, imageId: number): Promise<void> {
  await api.patch(`/products/${productId}/images/${imageId}/cover`);
}

export async function deleteProductImage(productId: number, imageId: number): Promise<void> {
  await api.delete(`/products/${productId}/images/${imageId}`);
}
