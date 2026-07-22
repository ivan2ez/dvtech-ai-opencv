import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { Report } from '../models';
import {
  generateServiceSummaryReport,
  generateTechnicianPerformanceReport,
  generateAiRecommendationReport,
} from '../services/reportService';

const VALID_REPORT_TYPES = ['service_summary', 'technician_performance', 'ai_recommendation'] as const;

export async function generateReportHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { reportType, startDate, endDate } = req.body;

    if (!reportType || !VALID_REPORT_TYPES.includes(reportType)) {
      res.status(400).json({
        message: `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}`,
      });
      return;
    }

    if (!startDate || !endDate) {
      res.status(400).json({ message: 'startDate and endDate are required' });
      return;
    }

    let result: { report: any; summary: any };

    switch (reportType) {
      case 'service_summary':
        result = await generateServiceSummaryReport({ startDate, endDate });
        break;
      case 'technician_performance':
        result = await generateTechnicianPerformanceReport({ startDate, endDate });
        break;
      case 'ai_recommendation':
        result = await generateAiRecommendationReport({ startDate, endDate });
        break;
      default:
        res.status(400).json({ message: `Invalid report type` });
        return;
    }

    res.status(201).json({ report: result.report, summary: result.summary });
  } catch (error) {
    next(error);
  }
}

export async function listReportsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { count, rows } = await Report.findAndCountAll({
      order: [['generatedDate', 'DESC']],
      limit: pageSize,
      offset,
    });

    res.status(200).json({
      reports: rows,
      pagination: {
        page,
        pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getReportByIdHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid report ID' });
      return;
    }

    const report = await Report.findByPk(id);

    if (!report) {
      res.status(404).json({ message: 'Report not found' });
      return;
    }

    res.status(200).json({ report });
  } catch (error) {
    next(error);
  }
}

export async function exportReportHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid report ID' });
      return;
    }

    const format = (req.query.format as string || '').toLowerCase();

    if (format !== 'csv' && format !== 'pdf') {
      res.status(400).json({ message: 'Invalid format. Must be csv or pdf' });
      return;
    }

    const report = await Report.findByPk(id);

    if (!report) {
      res.status(404).json({ message: 'Report not found' });
      return;
    }

    const summary = JSON.parse(report.summary);

    if (format === 'csv') {
      const csv = convertSummaryToCsv(summary, report.reportType);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${id}.csv"`);
      res.status(200).send(csv);
    } else {
      // Simple text-based PDF representation
      const textContent = convertSummaryToText(summary, report.reportType);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
      res.status(200).send(textContent);
    }
  } catch (error) {
    next(error);
  }
}

function convertSummaryToCsv(summary: any, reportType: string): string {
  const lines: string[] = [];

  switch (reportType) {
    case 'service_summary': {
      lines.push('Metric,Value');
      lines.push(`Report Type,${summary.reportType}`);
      lines.push(`Total Requests,${summary.totalRequests}`);
      lines.push(`Date Range Start,${summary.dateRange?.startDate || ''}`);
      lines.push(`Date Range End,${summary.dateRange?.endDate || ''}`);
      lines.push('');
      lines.push('Service Type,Count');
      if (summary.byServiceType) {
        for (const [type, count] of Object.entries(summary.byServiceType)) {
          lines.push(`${type},${count}`);
        }
      }
      lines.push('');
      lines.push('Status,Count');
      if (summary.byStatus) {
        for (const [status, count] of Object.entries(summary.byStatus)) {
          lines.push(`${status},${count}`);
        }
      }
      break;
    }
    case 'technician_performance': {
      lines.push('Technician ID,Technician Name,Assigned,Completed,Rejected');
      if (summary.entries) {
        for (const entry of summary.entries) {
          lines.push(`${entry.technicianId},${entry.technicianName},${entry.assigned},${entry.completed},${entry.rejected}`);
        }
      }
      break;
    }
    case 'ai_recommendation': {
      lines.push('Metric,Value');
      lines.push(`Report Type,${summary.reportType}`);
      lines.push(`Total Recommendations,${summary.totalRecommendations}`);
      lines.push(`Date Range Start,${summary.dateRange?.startDate || ''}`);
      lines.push(`Date Range End,${summary.dateRange?.endDate || ''}`);
      lines.push('');
      lines.push('Unit Type,Count');
      if (summary.byUnitType) {
        for (const [type, count] of Object.entries(summary.byUnitType)) {
          lines.push(`${type},${count}`);
        }
      }
      break;
    }
    default: {
      lines.push('Key,Value');
      for (const [key, value] of Object.entries(summary)) {
        lines.push(`${key},"${JSON.stringify(value)}"`);
      }
    }
  }

  return lines.join('\n');
}

function convertSummaryToText(summary: any, reportType: string): string {
  const lines: string[] = [];
  lines.push('=== DVTech AI Report ===');
  lines.push('');
  lines.push(`Report Type: ${reportType}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  switch (reportType) {
    case 'service_summary': {
      lines.push(`Total Requests: ${summary.totalRequests}`);
      lines.push(`Date Range: ${summary.dateRange?.startDate} to ${summary.dateRange?.endDate}`);
      lines.push('');
      lines.push('By Service Type:');
      if (summary.byServiceType) {
        for (const [type, count] of Object.entries(summary.byServiceType)) {
          lines.push(`  ${type}: ${count}`);
        }
      }
      lines.push('');
      lines.push('By Status:');
      if (summary.byStatus) {
        for (const [status, count] of Object.entries(summary.byStatus)) {
          lines.push(`  ${status}: ${count}`);
        }
      }
      break;
    }
    case 'technician_performance': {
      lines.push(`Total Technicians: ${summary.totalTechnicians}`);
      lines.push(`Date Range: ${summary.dateRange?.startDate} to ${summary.dateRange?.endDate}`);
      lines.push('');
      lines.push('Technician Performance:');
      if (summary.entries) {
        for (const entry of summary.entries) {
          lines.push(`  ${entry.technicianName} (ID: ${entry.technicianId}) - Assigned: ${entry.assigned}, Completed: ${entry.completed}, Rejected: ${entry.rejected}`);
        }
      }
      break;
    }
    case 'ai_recommendation': {
      lines.push(`Total Recommendations: ${summary.totalRecommendations}`);
      lines.push(`Date Range: ${summary.dateRange?.startDate} to ${summary.dateRange?.endDate}`);
      lines.push('');
      lines.push('By Unit Type:');
      if (summary.byUnitType) {
        for (const [type, count] of Object.entries(summary.byUnitType)) {
          lines.push(`  ${type}: ${count}`);
        }
      }
      break;
    }
    default: {
      lines.push(JSON.stringify(summary, null, 2));
    }
  }

  return lines.join('\n');
}
