import { useCallback, useEffect, useState } from 'react';
import { RefreshCwIcon, CalendarIcon, UserCheckIcon, SearchIcon, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { StatusBadge } from '@/components/shared/StatusBadge';
import type {
  ServiceRequest,
  TechnicianSchedule,
  TechnicianInfo,
  ScheduleStatus,
  SchedulePriority,
} from '@/types';
import { getServiceRequests } from '@/services/serviceRequestApi';
import { getSchedules, assignTechnician, getTechnicians } from '@/services/scheduleApi';

const PRIORITY_BADGE: Record<SchedulePriority, { label: string; className: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', variant: 'outline' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', variant: 'outline' },
  high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', variant: 'outline' },
};

const AVAILABILITY_BADGE: Record<string, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  busy: { label: 'Busy', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  unavailable: { label: 'Unavailable', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const SCHEDULE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

const PRIORITY_ORDER: Record<SchedulePriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

type SortField = 'scheduledDate' | 'priority';
type SortDirection = 'asc' | 'desc';

export function ManageSchedules() {
  // Approved requests state
  const [approvedRequests, setApprovedRequests] = useState<ServiceRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Schedules state
  const [schedules, setSchedules] = useState<TechnicianSchedule[]>([]);
  const [schedulePagination, setSchedulePagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Technicians state
  const [technicians, setTechnicians] = useState<TechnicianInfo[]>([]);

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // General state
  const [error, setError] = useState<string | null>(null);

  // Assign dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | ''>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [priority, setPriority] = useState<SchedulePriority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApprovedRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const response = await getServiceRequests({ page: 1, pageSize: 100 });
      const approved = response.data.filter((r) => r.status === 'approved');
      setApprovedRequests(approved);
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
      setError('Failed to load approved requests. Please try again.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchSchedules = useCallback(async (page = 1) => {
    setIsLoadingSchedules(true);
    try {
      const response = await getSchedules({ page, pageSize: 20 });
      setSchedules(response.data);
      setSchedulePagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
      setError('Failed to load schedules. Please try again.');
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  const fetchTechnicians = useCallback(async () => {
    try {
      const data = await getTechnicians();
      setTechnicians(data);
    } catch (err) {
      console.error('Failed to fetch technicians:', err);
    }
  }, []);

  useEffect(() => {
    void fetchApprovedRequests();
    void fetchSchedules();
    void fetchTechnicians();
  }, [fetchApprovedRequests, fetchSchedules, fetchTechnicians]);

  // Filtered schedules by status and search
  const filteredSchedules = schedules.filter((s) => {
    const matchesStatus = scheduleStatusFilter === 'all' || s.status === scheduleStatusFilter;
    const query = searchQuery.toLowerCase();
    const techName = s.technician?.name?.toLowerCase() ?? '';
    const serviceType = s.serviceRequest?.serviceType?.toLowerCase() ?? '';
    const matchesSearch = !query || techName.includes(query) || serviceType.includes(query);
    return matchesStatus && matchesSearch;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    if (!sortField) return 0;
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'scheduledDate') {
      return (new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()) * modifier;
    }
    if (sortField === 'priority') {
      return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * modifier;
    }
    return 0;
  });

  function handleOpenAssignDialog(request: ServiceRequest) {
    setSelectedRequest(request);
    setSelectedTechnicianId('');
    setScheduledDate('');
    setPriority('medium');
    setAssignDialogOpen(true);
  }

  async function handleAssign() {
    if (!selectedRequest || !selectedTechnicianId || !scheduledDate) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await assignTechnician({
        technicianId: Number(selectedTechnicianId),
        serviceRequestId: selectedRequest.id,
        scheduledDate,
        priority,
      });
      setAssignDialogOpen(false);
      setSelectedRequest(null);
      await fetchApprovedRequests();
      await fetchSchedules(schedulePagination.page);
    } catch (err) {
      console.error('Failed to assign technician:', err);
      setError('Failed to assign technician. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function refreshAll() {
    setError(null);
    void fetchApprovedRequests();
    void fetchSchedules(schedulePagination.page);
    void fetchTechnicians();
  }

  const isAssignFormValid = selectedTechnicianId !== '' && scheduledDate !== '';

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Schedules</h1>
        <Button variant="outline" onClick={refreshAll}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={refreshAll}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Approved Requests Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Approved Requests (Ready to Assign)</h2>

        {isLoadingRequests && (
          <p className="text-muted-foreground py-4">Loading approved requests...</p>
        )}

        {!isLoadingRequests && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>AC Details</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No approved requests awaiting assignment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    approvedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">#{request.id}</TableCell>
                        <TableCell>{request.user?.name ?? `User #${request.userId}`}</TableCell>
                        <TableCell>{request.serviceType}</TableCell>
                        <TableCell>{request.acDetails ? request.acDetails.slice(0, 40) : '—'}</TableCell>
                        <TableCell>{formatDate(request.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleOpenAssignDialog(request)}
                            aria-label={`Assign technician to request #${request.id}`}
                          >
                            <UserCheckIcon data-icon="inline-start" />
                            Assign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {approvedRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No approved requests awaiting assignment.</p>
              ) : (
                approvedRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">#{request.id}</span>
                        <StatusBadge status="approved" />
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Customer:</span> {request.user?.name ?? `User #${request.userId}`}</p>
                        <p><span className="text-muted-foreground">Service:</span> {request.serviceType}</p>
                        <p><span className="text-muted-foreground">Details:</span> {request.acDetails ? request.acDetails.slice(0, 60) : '—'}</p>
                        <p><span className="text-muted-foreground">Date:</span> {formatDate(request.createdAt)}</p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => handleOpenAssignDialog(request)}
                      >
                        <UserCheckIcon data-icon="inline-start" />
                        Assign Technician
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {/* Existing Schedules Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold">All Schedules</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search technician or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="schedule-status-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Status:
              </label>
              <select
                id="schedule-status-filter"
                className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={scheduleStatusFilter}
                onChange={(e) => setScheduleStatusFilter(e.target.value)}
              >
                {SCHEDULE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoadingSchedules && (
          <p className="text-muted-foreground py-4">Loading schedules...</p>
        )}

        {!isLoadingSchedules && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('scheduledDate')}>
                        Scheduled Date <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('priority')}>
                        Priority <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No schedules found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSchedules.map((schedule) => {
                      const priorityConfig = PRIORITY_BADGE[schedule.priority];
                      const customerName = schedule.serviceRequest?.user?.name;
                      return (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">#{schedule.id}</TableCell>
                          <TableCell>
                            {schedule.technician?.name ?? `Tech #${schedule.technicianId}`}
                          </TableCell>
                          <TableCell>
                            {customerName ?? `User #${schedule.serviceRequest?.userId ?? '—'}`}
                          </TableCell>
                          <TableCell>
                            {schedule.serviceRequest?.serviceType ?? `Request #${schedule.serviceRequestId}`}
                          </TableCell>
                          <TableCell>{formatDate(schedule.scheduledDate)}</TableCell>
                          <TableCell>
                            <StatusBadge status={schedule.status} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                              {priorityConfig.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredSchedules.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No schedules found.</p>
              ) : (
                sortedSchedules.map((schedule) => {
                  const priorityConfig = PRIORITY_BADGE[schedule.priority];
                  const customerName = schedule.serviceRequest?.user?.name;
                  return (
                    <Card key={schedule.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">#{schedule.id}</span>
                          <StatusBadge status={schedule.status} />
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">Technician:</span> {schedule.technician?.name ?? `Tech #${schedule.technicianId}`}</p>
                          <p><span className="text-muted-foreground">Customer:</span> {customerName ?? `User #${schedule.serviceRequest?.userId ?? '—'}`}</p>
                          <p><span className="text-muted-foreground">Service:</span> {schedule.serviceRequest?.serviceType ?? `Request #${schedule.serviceRequestId}`}</p>
                          <p><span className="text-muted-foreground">Date:</span> {formatDate(schedule.scheduledDate)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                            {priorityConfig.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {schedulePagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing page {schedulePagination.page} of {schedulePagination.totalPages} ({schedulePagination.totalItems} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={schedulePagination.page <= 1}
                    onClick={() => void fetchSchedules(schedulePagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={schedulePagination.page >= schedulePagination.totalPages}
                    onClick={() => void fetchSchedules(schedulePagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Assign Technician Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Request details */}
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-sm font-medium">Service Request #{selectedRequest?.id}</p>
              <p className="text-sm text-muted-foreground">
                Type: {selectedRequest?.serviceType}
              </p>
              {selectedRequest?.acDetails && (
                <p className="text-sm text-muted-foreground">
                  Details: {selectedRequest.acDetails}
                </p>
              )}
            </div>

            {/* Technician selector */}
            <div className="space-y-2">
              <label htmlFor="technician-select" className="text-sm font-medium">
                Technician
              </label>
              <select
                id="technician-select"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select a technician...</option>
                {technicians.map((tech) => {
                  const availability = tech.technicianDetail?.availabilityStatus ?? 'available';
                  const taskCount = tech.activeTaskCount ?? 0;
                  return (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} — {availability} ({taskCount} active tasks)
                    </option>
                  );
                })}
              </select>
              {/* Availability display for selected technician */}
              {selectedTechnicianId !== '' && (
                <div className="flex items-center gap-2 pt-1">
                  {(() => {
                    const tech = technicians.find((t) => t.id === Number(selectedTechnicianId));
                    if (!tech) return null;
                    const availability = tech.technicianDetail?.availabilityStatus ?? 'available';
                    const config = AVAILABILITY_BADGE[availability];
                    return (
                      <>
                        <Badge variant="outline" className={config.className}>
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {tech.activeTaskCount ?? 0} active task(s)
                        </span>
                        {tech.technicianDetail?.specialization && (
                          <span className="text-xs text-muted-foreground">
                            • {tech.technicianDetail.specialization}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Date picker */}
            <div className="space-y-2">
              <label htmlFor="schedule-date" className="text-sm font-medium flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Scheduled Date
              </label>
              <input
                id="schedule-date"
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                min={getTodayString()}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            {/* Priority selector */}
            <div className="space-y-2">
              <label htmlFor="priority-select" className="text-sm font-medium">
                Priority
              </label>
              <select
                id="priority-select"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={priority}
                onChange={(e) => setPriority(e.target.value as SchedulePriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              disabled={!isAssignFormValid || isSubmitting}
              onClick={() => void handleAssign()}
            >
              Assign Technician
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
