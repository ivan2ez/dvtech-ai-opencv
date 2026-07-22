import { Op } from 'sequelize';
import { Report, ServiceRequest, TechnicianSchedule, User, AiRecommendation } from '../models';

// --- Types ---

export interface GenerateServiceSummaryInput {
  startDate: string;
  endDate: string;
}

export interface ServiceSummaryByType {
  installation: number;
  maintenance: number;
  repair: number;
}

export interface ServiceSummaryByStatus {
  pending: number;
  approved: number;
  rejected: number;
  'in-progress': number;
  completed: number;
}

export interface ServiceSummaryData {
  reportType: 'service_summary';
  totalRequests: number;
  byServiceType: ServiceSummaryByType;
  byStatus: ServiceSummaryByStatus;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  message?: string;
}

export interface GenerateReportResult {
  report: Report;
  summary: ServiceSummaryData;
}

// --- Validation Helpers ---

function validateDateRange(startDate: string, endDate: string): void {
  if (!startDate || startDate.trim().length === 0) {
    const error = new Error('Start date is required') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  if (!endDate || endDate.trim().length === 0) {
    const error = new Error('End date is required') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    const error = new Error('Invalid start date format') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  if (isNaN(end.getTime())) {
    const error = new Error('Invalid end date format') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  if (start > end) {
    const error = new Error('Start date must be before or equal to end date') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }
}

// --- Service ---

export async function generateServiceSummaryReport(
  input: GenerateServiceSummaryInput
): Promise<GenerateReportResult> {
  // 1. Validate date range
  validateDateRange(input.startDate, input.endDate);

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  // Set end date to end of day to include the full day
  endDate.setHours(23, 59, 59, 999);

  // 2. Fetch service requests within date range
  const serviceRequests = await ServiceRequest.findAll({
    where: {
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    },
  });

  // 3. Aggregate by service type
  const byServiceType: ServiceSummaryByType = {
    installation: 0,
    maintenance: 0,
    repair: 0,
  };

  // 4. Aggregate by status
  const byStatus: ServiceSummaryByStatus = {
    pending: 0,
    approved: 0,
    rejected: 0,
    'in-progress': 0,
    completed: 0,
  };

  for (const request of serviceRequests) {
    // Count by service type
    const serviceType = request.serviceType as keyof ServiceSummaryByType;
    if (serviceType in byServiceType) {
      byServiceType[serviceType]++;
    }

    // Count by status
    const status = request.status as keyof ServiceSummaryByStatus;
    if (status in byStatus) {
      byStatus[status]++;
    }
  }

  // 5. Build summary data
  const summaryData: ServiceSummaryData = {
    reportType: 'service_summary',
    totalRequests: serviceRequests.length,
    byServiceType,
    byStatus,
    dateRange: {
      startDate: input.startDate,
      endDate: input.endDate,
    },
  };

  // 6. If no data exists, add message indicating no records found
  if (serviceRequests.length === 0) {
    summaryData.message = 'No records found for the selected period';
  }

  // 7. Create and save the report
  const report = await Report.create({
    serviceRequestId: null,
    reportType: 'service_summary',
    summary: JSON.stringify(summaryData),
    generatedDate: new Date(),
  });

  return {
    report,
    summary: summaryData,
  };
}


// --- Technician Performance Report Types ---

export interface GenerateTechnicianPerformanceInput {
  startDate: string;
  endDate: string;
}

export interface TechnicianPerformanceEntry {
  technicianId: number;
  technicianName: string;
  assigned: number;
  completed: number;
  rejected: number;
}

export interface TechnicianPerformanceData {
  reportType: 'technician_performance';
  totalTechnicians: number;
  entries: TechnicianPerformanceEntry[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  message?: string;
}

export interface GenerateTechnicianPerformanceResult {
  report: Report;
  summary: TechnicianPerformanceData;
}

// --- Technician Performance Report Service ---

export async function generateTechnicianPerformanceReport(
  input: GenerateTechnicianPerformanceInput
): Promise<GenerateTechnicianPerformanceResult> {
  // 1. Validate date range
  validateDateRange(input.startDate, input.endDate);

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  // Set end date to end of day to include the full day
  endDate.setHours(23, 59, 59, 999);

  // 2. Fetch technician schedules within date range, including technician info
  const schedules = await TechnicianSchedule.findAll({
    where: {
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    },
    include: [{ model: User, as: 'technician' }],
  });

  // 3. Aggregate per technician
  const technicianMap = new Map<number, TechnicianPerformanceEntry>();

  for (const schedule of schedules) {
    const techId = schedule.technicianId;
    const techName = schedule.technician?.name || 'Unknown';

    if (!technicianMap.has(techId)) {
      technicianMap.set(techId, {
        technicianId: techId,
        technicianName: techName,
        assigned: 0,
        completed: 0,
        rejected: 0,
      });
    }

    const entry = technicianMap.get(techId)!;

    // Every schedule record counts as an assignment
    entry.assigned++;

    // Count completed and rejected statuses
    if (schedule.status === 'completed') {
      entry.completed++;
    } else if (schedule.status === 'rejected') {
      entry.rejected++;
    }
  }

  const entries = Array.from(technicianMap.values());

  // 4. Build summary data
  const summaryData: TechnicianPerformanceData = {
    reportType: 'technician_performance',
    totalTechnicians: entries.length,
    entries,
    dateRange: {
      startDate: input.startDate,
      endDate: input.endDate,
    },
  };

  // 5. If no data exists, add message indicating no records found
  if (schedules.length === 0) {
    summaryData.message = 'No records found for the selected period';
  }

  // 6. Create and save the report
  const report = await Report.create({
    serviceRequestId: null,
    reportType: 'technician_performance',
    summary: JSON.stringify(summaryData),
    generatedDate: new Date(),
  });

  return {
    report,
    summary: summaryData,
  };
}


// --- AI Recommendation Report Types ---

export interface GenerateAiRecommendationInput {
  startDate: string;
  endDate: string;
}

export interface AiRecommendationByUnitType {
  'split-type': number;
  'window-type': number;
  'floor-standing': number;
}

export interface AiRecommendationData {
  reportType: 'ai_recommendation';
  totalRecommendations: number;
  byUnitType: AiRecommendationByUnitType;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  message?: string;
}

export interface GenerateAiRecommendationResult {
  report: Report;
  summary: AiRecommendationData;
}

// --- AI Recommendation Report Service ---

export async function generateAiRecommendationReport(
  input: GenerateAiRecommendationInput
): Promise<GenerateAiRecommendationResult> {
  // 1. Validate date range
  validateDateRange(input.startDate, input.endDate);

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  // Set end date to end of day to include the full day
  endDate.setHours(23, 59, 59, 999);

  // 2. Fetch AI recommendations within date range
  const recommendations = await AiRecommendation.findAll({
    where: {
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      },
    },
  });

  // 3. Aggregate by unit type
  const byUnitType: AiRecommendationByUnitType = {
    'split-type': 0,
    'window-type': 0,
    'floor-standing': 0,
  };

  for (const recommendation of recommendations) {
    const unitType = recommendation.unitType as keyof AiRecommendationByUnitType;
    if (unitType in byUnitType) {
      byUnitType[unitType]++;
    }
  }

  // 4. Build summary data
  const summaryData: AiRecommendationData = {
    reportType: 'ai_recommendation',
    totalRecommendations: recommendations.length,
    byUnitType,
    dateRange: {
      startDate: input.startDate,
      endDate: input.endDate,
    },
  };

  // 5. If no data exists, add message indicating no records found
  if (recommendations.length === 0) {
    summaryData.message = 'No records found for the selected period';
  }

  // 6. Create and save the report
  const report = await Report.create({
    serviceRequestId: null,
    reportType: 'ai_recommendation',
    summary: JSON.stringify(summaryData),
    generatedDate: new Date(),
  });

  return {
    report,
    summary: summaryData,
  };
}
