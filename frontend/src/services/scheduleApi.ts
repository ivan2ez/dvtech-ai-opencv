import api from './api';
import type {
  TechnicianSchedule,
  TechnicianInfo,
  AvailableTechnician,
  AssignTechnicianData,
  ScheduleTimeSlot,
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

/**
 * Starts a task: assigned -> in-progress.
 * Available to the assigned technician and to admins.
 */
export async function startTask(id: number): Promise<TechnicianSchedule> {
  const response = await api.patch<{ schedule: TechnicianSchedule }>(`/schedules/${id}/start`);
  return response.data.schedule;
}

/**
 * Undoes an accidental start: in-progress -> assigned.
 * Only allowed before a completion report is submitted.
 */
export async function undoTask(id: number): Promise<TechnicianSchedule> {
  const response = await api.patch<{ schedule: TechnicianSchedule }>(`/schedules/${id}/undo`);
  return response.data.schedule;
}

/**
 * Completes a task: in-progress -> completed.
 * Sent as multipart/form-data because the backend requires BOTH a written
 * report (min 20 chars) and a completion photo file.
 */
export async function completeTask(
  id: number,
  report: string,
  photo: File
): Promise<TechnicianSchedule> {
  const formData = new FormData();
  formData.append('report', report);
  formData.append('photo', photo);
  const response = await api.patch<{ schedule: TechnicianSchedule }>(
    `/schedules/${id}/complete`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data.schedule;
}

/** All technicians (used for informational lists, not slot-aware). */
export async function getTechnicians(): Promise<TechnicianInfo[]> {
  const response = await api.get<{ data: TechnicianInfo[] }>('/admin/technicians');
  return response.data.data;
}

/**
 * Admin reassigns a task to a different available technician, keeping the same
 * date + slot. Used for a no-show or an advance cancellation. The backend
 * re-validates the new technician for that slot and 409s if they can't take it.
 */
export async function reassignTechnician(
  id: number,
  technicianId: number
): Promise<TechnicianSchedule> {
  const response = await api.patch<{ schedule: TechnicianSchedule }>(
    `/schedules/${id}/reassign`,
    { technicianId }
  );
  return response.data.schedule;
}

// --- Admin archive (soft delete → Archive view) ---

/** Lists archived schedules. */
export async function getArchivedSchedules(): Promise<TechnicianSchedule[]> {
  const response = await api.get<{ data: TechnicianSchedule[] }>('/schedules/archived');
  return response.data.data;
}

/** Archives a schedule (only completed/rejected can be archived). */
export async function archiveSchedule(id: number): Promise<void> {
  await api.delete(`/schedules/${id}/archive`);
}

/** Restores an archived schedule. */
export async function restoreSchedule(id: number): Promise<void> {
  await api.post(`/schedules/${id}/restore`);
}

/** Permanently deletes an archived schedule. */
export async function deleteSchedulePermanently(id: number): Promise<void> {
  await api.delete(`/schedules/${id}/permanent`);
}

/**
 * Technicians who are free for a specific date + slot — the source for the
 * admin assignment dropdown. Busy, unavailable, and fully booked technicians
 * are excluded by the backend.
 *
 * `excludeTechnicianId` pre-filters a technician out before the availability
 * checks run (Req 7.7, 8.2). The Reassign modal passes the current technician
 * so they can never be reassigned to their own task; the Assign modal omits it.
 */
export async function getAvailableTechnicians(
  date: string,
  slot: ScheduleTimeSlot,
  excludeTechnicianId?: number
): Promise<AvailableTechnician[]> {
  const response = await api.get<{ technicians: AvailableTechnician[] }>(
    '/schedules/available-technicians',
    {
      params: {
        date,
        slot,
        ...(excludeTechnicianId != null ? { excludeTechnicianId } : {}),
      },
    }
  );
  return response.data.technicians;
}
