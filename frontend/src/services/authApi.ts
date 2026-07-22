import api from './api';
import type { LoginCredentials, RegisterData, User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function loginApi(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  return response.data;
}

export async function registerApi(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', data);
  return response.data;
}

export async function getProfileApi(): Promise<User> {
  const response = await api.get<{ user: User }>('/auth/profile');
  return response.data.user;
}
