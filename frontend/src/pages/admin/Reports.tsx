import { useCallback, useEffect, useState } from 'react';
import { FileTextIcon, DownloadIcon, RefreshCwIcon, Loader2Icon, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { GenerateReportInput, ReportRecord, GenerateReportResponse } from '@/services/reportApi';
import {
  generateReport,
  listReports,
  exportReport,
} from '@/services/reportApi';

type ReportType = GenerateReportInput['reportType'];

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  service_summary: 'Service Summary',
  technician_performance: 'Technician Performance',
  ai_recommendation: 'AI Recommendation',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

type SortField = 'generatedDate';
type SortDirection = 'asc' | 'desc';

export function Reports() {
  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Form state
  const [reportType, setReportType] = useState<ReportType>('service_summary');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GenerateReportResponse | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Report history state
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Export state
  const [exportingId, setExportingId] = useState<number | null>(null);

  const fetchReportHistory = useCallback(async (page = 1) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await listReports({ page, pageSize: 10 });
      setReports(response.reports);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch report history:', err);
      setHistoryError('Failed to load report history. Please try again.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void fetchReportHistory();
  }, [fetchReportHistory]);

  async function handleGenerate() {
    if (!startDate || !endDate) {
      setGenerateError('Please select both start and end dates.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setGenerateError('Start date must be before end date.');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGeneratedResult(null);

    try {
      const result = await generateReport({
        reportType,
        startDate,
        endDate,
      });
      setGeneratedResult(result);
      // Refresh history after generating
      void fetchReportHistory(1);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      const message = err?.response?.data?.message || 'Failed to generate report. Please try again.';
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedReports = [...reports].sort((a, b) => {
    if (!sortField) return 0;
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'generatedDate') {
      return (new Date(a.generatedDate).getTime() - new Date(b.generatedDate).getTime()) * modifier;
    }
    return 0;
  });

  async function handleExport(id: number, format: 'csv' | 'pdf') {
    setExportingId(id);
    try {
      const blob = await exportReport(id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${id}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to export report as ${format}:`, err);
    } finally {
      setExportingId(null);
    }
  }

  function renderSummaryResults() {
    if (!generatedResult) return null;

    const { summary } = generatedResult;

    if (reportType === 'service_summary') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {summary?.byServiceType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By Service Type</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Type</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary.byServiceType).map(([type, count]) => (
                      <TableRow key={type}>
                        <TableCell>{type}</TableCell>
                        <TableCell className="text-right">{count as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {summary?.byStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary.byStatus).map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell className="capitalize">{status}</TableCell>
                        <TableCell className="text-right">{count as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (reportType === 'technician_performance') {
      const techData = summary?.technicians || summary?.performance || [];
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Technician Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-right">Tasks Completed</TableHead>
                  <TableHead className="text-right">Tasks Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(techData) && techData.length > 0 ? (
                  techData.map((tech: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{tech.name || tech.technicianName || `Technician #${tech.id || index + 1}`}</TableCell>
                      <TableCell className="text-right">{tech.completed ?? tech.tasksCompleted ?? 0}</TableCell>
                      <TableCell className="text-right">{tech.assigned ?? tech.tasksAssigned ?? 0}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No technician data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      );
    }

    if (reportType === 'ai_recommendation') {
      const unitData = summary?.byUnitType || summary?.unitTypes || {};
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Recommendations by Unit Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Type</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(unitData).length > 0 ? (
                  Object.entries(unitData).map(([type, count]) => (
                    <TableRow key={type}>
                      <TableCell className="capitalize">{type}</TableCell>
                      <TableCell className="text-right">{count as number}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No recommendation data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      );
    }

    // Fallback: render raw summary
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">
            {typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>

      {/* Report Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Generate Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(value) => setReportType(value as ReportType)}
              >
                <SelectTrigger id="report-type">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_summary">Service Summary</SelectItem>
                  <SelectItem value="technician_performance">Technician Performance</SelectItem>
                  <SelectItem value="ai_recommendation">AI Recommendation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileTextIcon className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>

          {generateError && (
            <p className="mt-4 text-sm text-destructive">{generateError}</p>
          )}
        </CardContent>
      </Card>

      {/* Generated Report Results */}
      {generatedResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Results: {REPORT_TYPE_LABELS[reportType]}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={exportingId === generatedResult.report.id}
                onClick={() => void handleExport(generatedResult.report.id, 'csv')}
              >
                <DownloadIcon className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exportingId === generatedResult.report.id}
                onClick={() => void handleExport(generatedResult.report.id, 'pdf')}
              >
                <DownloadIcon className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {renderSummaryResults()}
        </div>
      )}

      {/* Report History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Report History</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchReportHistory(pagination.page)}
            >
              <RefreshCwIcon className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyError && (
            <div className="text-center py-8">
              <p className="text-destructive">{historyError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void fetchReportHistory(1)}
              >
                Retry
              </Button>
            </div>
          )}

          {isLoadingHistory && !historyError && (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading report history...</p>
            </div>
          )}

          {!isLoadingHistory && !historyError && (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('generatedDate')}>
                          Generated <ArrowUpDown className="h-4 w-4" />
                        </button>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No reports generated yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">#{report.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {REPORT_TYPE_LABELS[report.reportType as ReportType] || report.reportType}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {report.summary || '—'}
                          </TableCell>
                          <TableCell>{formatDate(report.generatedDate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={exportingId === report.id}
                                onClick={() => void handleExport(report.id, 'csv')}
                                aria-label={`Export report #${report.id} as CSV`}
                              >
                                <DownloadIcon className="h-4 w-4" />
                                CSV
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={exportingId === report.id}
                                onClick={() => void handleExport(report.id, 'pdf')}
                                aria-label={`Export report #${report.id} as PDF`}
                              >
                                <DownloadIcon className="h-4 w-4" />
                                PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3">
                {reports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No reports generated yet.</p>
                ) : (
                  sortedReports.map((report) => (
                    <div key={report.id} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">#{report.id}</span>
                        <Badge variant="outline">
                          {REPORT_TYPE_LABELS[report.reportType as ReportType] || report.reportType}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Summary:</span> {report.summary || '—'}</p>
                        <p><span className="text-muted-foreground">Generated:</span> {formatDate(report.generatedDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={exportingId === report.id}
                          onClick={() => void handleExport(report.id, 'csv')}
                        >
                          <DownloadIcon className="h-4 w-4 mr-1" />
                          CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={exportingId === report.id}
                          onClick={() => void handleExport(report.id, 'pdf')}
                        >
                          <DownloadIcon className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => void fetchReportHistory(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => void fetchReportHistory(pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
