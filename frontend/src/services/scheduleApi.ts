import api from './api';
import type {
  TechnicianSchedule,
  TechnicianInfo,
  AssignTechnicianData,
  PaginatedResponse,
  BackendPaginatedResponse,
} from '../types';

export async function getSchedules(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<TechnicianSchedule>> {
  const response = await api.get<BackendPaginatedResponse<TechnicianSchedule> & { schedules?: TechnicianSchedule[] }>('/schedules', { params });
  const raw = response.data;
  return {
    data: raw.schedules ?? raw.data,
    pagination: {
      page: raw.page,
      pageSize: raw.pageSize,
      totalItems: raw.total,
      totalPages: raw.totalPages,
    },
  };
}

export async function getScheduleById(id: number): Promise<TechnicianSchedule> {
  const response = await api.get<{ schedule: TechnicianSchedule }>(`/schedules/${id}`);
  return response.data.schedule;
}

export async function assignTechnician(data: AssignTechnicianData): Promise<TechnicianSchedule> {
  const response = await api.post<{ schedule: TechnicianSchedule }>('/schedules', data);
  return response.data.schedule;
}

export async function acceptTask(id: number): Promise<TechnicianSchedule> {
  const response = await api.patch<{ schedule: TechnicianSchedule }>(`/schedules/${id}/accept`);
  return response.data.schedule;
}

export async function rejectTask(id: number, reason: string): Promise<TechnicianSchedule> {
  const response = await api.patch<{ schedule: TechnicianSchedule }>(`/schedules/${id}/reject`, { reason });
  return response.data.schedule;
}

export async function updateTaskStatus(id: number): Promise<TechnicianSchedule> {
  const response = await api.patch<{ schedule: TechnicianSchedule }>(`/schedules/${id}/status`);
  return response.data.schedule;
}

export async function completeTask(id: number, report: string): Promise<TechnicianSchedule> {
  const response = await api.patch<{ schedule: TechnicianSchedule }>(`/schedules/${id}/complete`, { report });
  return response.data.schedule;
}

export async function getTechnicians(): Promise<TechnicianInfo[]> {
  const response = await api.get<{ data: TechnicianInfo[] }>('/admin/technicians');
  return response.data.data;
}
