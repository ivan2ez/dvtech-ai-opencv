import api from './api';

export interface GenerateReportInput {
  reportType: 'service_summary' | 'technician_performance' | 'ai_recommendation';
  startDate: string;
  endDate: string;
}

export interface ReportRecord {
  id: number;
  serviceRequestId: number | null;
  reportType: string;
  summary: string;
  generatedDate: string;
  createdAt: string;
}

export interface ReportListResponse {
  reports: ReportRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface GenerateReportResponse {
  report: ReportRecord;
  summary: any;
}

export async function generateReport(input: GenerateReportInput): Promise<GenerateReportResponse> {
  const response = await api.post<GenerateReportResponse>('/reports/generate', input);
  return response.data;
}

export async function listReports(params?: { page?: number; pageSize?: number }): Promise<ReportListResponse> {
  const response = await api.get<ReportListResponse>('/reports', { params });
  return response.data;
}

export async function getReportById(id: number): Promise<{ report: ReportRecord }> {
  const response = await api.get<{ report: ReportRecord }>(`/reports/${id}`);
  return response.data;
}

export async function exportReport(id: number, format: 'csv' | 'pdf'): Promise<Blob> {
  const response = await api.get(`/reports/${id}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data;
}
