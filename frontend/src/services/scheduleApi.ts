import api from './api';
import type {
  TechnicianSchedule,
  TechnicianInfo,
  AssignTechnicianData,
  PaginatedResponse,
} from '../types';

export async function getSchedules(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<TechnicianSchedule>> {
  const response = await api.get<PaginatedResponse<TechnicianSchedule>>('/schedules', { params });
  return response.data;
}

export async function getScheduleById(id: number): Promise<TechnicianSchedule> {
  const response = await api.get<TechnicianSchedule>(`/schedules/${id}`);
  return response.data;
}

export async function assignTechnician(data: AssignTechnicianData): Promise<TechnicianSchedule> {
  const response = await api.post<TechnicianSchedule>('/schedules', data);
  return response.data;
}

export async function acceptTask(id: number): Promise<TechnicianSchedule> {
  const response = await api.patch<TechnicianSchedule>(`/schedules/${id}/accept`);
  return response.data;
}

export async function rejectTask(id: number, reason: string): Promise<TechnicianSchedule> {
  const response = await api.patch<TechnicianSchedule>(`/schedules/${id}/reject`, { reason });
  return response.data;
}

export async function updateTaskStatus(id: number): Promise<TechnicianSchedule> {
  const response = await api.patch<TechnicianSchedule>(`/schedules/${id}/status`);
  return response.data;
}

export async function completeTask(id: number, report: string): Promise<TechnicianSchedule> {
  const response = await api.patch<TechnicianSchedule>(`/schedules/${id}/complete`, { report });
  return response.data;
}

export async function getTechnicians(): Promise<TechnicianInfo[]> {
  const response = await api.get<TechnicianInfo[]>('/admin/technicians');
  return response.data;
}
