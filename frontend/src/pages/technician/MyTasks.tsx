import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCwIcon, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { TechnicianSchedule, ScheduleStatus, SchedulePriority } from '@/types';
import {
  getSchedules,
  acceptTask,
  rejectTask,
  updateTaskStatus,
  completeTask,
} from '@/services/scheduleApi';

const PRIORITY_BADGE: Record<
  SchedulePriority,
  { label: string; className: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', variant: 'outline' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', variant: 'outline' },
  high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', variant: 'outline' },
};

type FilterTab = 'all' | 'assigned' | 'in-progress' | 'completed';
type SortField = 'scheduledDate' | 'priority';
type SortDirection = 'asc' | 'desc';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const PRIORITY_ORDER: Record<SchedulePriority, number> = { high: 3, medium: 2, low: 1 };

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getCustomerName(schedule: TechnicianSchedule): string {
  return schedule.serviceRequest?.user?.name ?? `User #${schedule.serviceRequest?.userId ?? '—'}`;
}

export function MyTasks() {
  const [allSchedules, setAllSchedules] = useState<TechnicianSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filter & sort
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('scheduledDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTaskId, setRejectTaskId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTaskId, setCompleteTaskId] = useState<number | null>(null);
  const [completionReport, setCompletionReport] = useState('');
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSchedules({ page: 1, pageSize: 100 });
      setAllSchedules(response.data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load your tasks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  // Filter
  const filteredSchedules = allSchedules.filter((s) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'assigned') return s.status === 'assigned' || s.status === 'accepted';
    if (activeFilter === 'in-progress') return s.status === 'in-progress';
    if (activeFilter === 'completed') return s.status === 'completed' || s.status === 'rejected';
    return true;
  });

  // Sort
  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'scheduledDate') {
      comparison = new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    } else if (sortField === 'priority') {
      comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'priority' ? 'desc' : 'asc');
    }
  }

  // Actions
  async function handleAccept(id: number) {
    setActionLoading(id);
    setError(null);
    try {
      await acceptTask(id);
      await fetchSchedules();
    } catch {
      setError('Failed to accept task. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleOpenRejectDialog(id: number) {
    setRejectTaskId(id);
    setRejectReason('');
    setRejectDialogOpen(true);
  }

  async function handleReject() {
    if (!rejectTaskId || rejectReason.length < 10) return;
    setIsSubmittingReject(true);
    setError(null);
    try {
      await rejectTask(rejectTaskId, rejectReason);
      setRejectDialogOpen(false);
      setRejectTaskId(null);
      setRejectReason('');
      await fetchSchedules();
    } catch {
      setError('Failed to reject task. Please try again.');
    } finally {
      setIsSubmittingReject(false);
    }
  }

  async function handleStartWork(id: number) {
    setActionLoading(id);
    setError(null);
    try {
      await updateTaskStatus(id);
      await fetchSchedules();
    } catch {
      setError('Failed to update task status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleOpenCompleteDialog(id: number) {
    setCompleteTaskId(id);
    setCompletionReport('');
    setCompleteDialogOpen(true);
  }

  async function handleComplete() {
    if (!completeTaskId || completionReport.length < 20) return;
    setIsSubmittingComplete(true);
    setError(null);
    try {
      await completeTask(completeTaskId, completionReport);
      setCompleteDialogOpen(false);
      setCompleteTaskId(null);
      setCompletionReport('');
      await fetchSchedules();
    } catch {
      setError('Failed to complete task. Please try again.');
    } finally {
      setIsSubmittingComplete(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <Button variant="outline" size="sm" onClick={() => void fetchSchedules()}>
          <RefreshCwIcon className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'all'
            ? allSchedules.length
            : tab.key === 'assigned'
              ? allSchedules.filter((s) => s.status === 'assigned' || s.status === 'accepted').length
              : tab.key === 'in-progress'
                ? allSchedules.filter((s) => s.status === 'in-progress').length
                : allSchedules.filter((s) => s.status === 'completed' || s.status === 'rejected').length;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeFilter === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-center py-6 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void fetchSchedules()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading && (
        <p className="text-muted-foreground py-4">Loading tasks...</p>
      )}

      {!isLoading && !error && (
        <>
          {sortedSchedules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeFilter === 'all' ? 'No tasks assigned to you.' : `No ${activeFilter} tasks.`}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort('scheduledDate')}
                        >
                          Scheduled Date
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort('priority')}
                        >
                          Priority
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSchedules.map((schedule) => {
                      const priorityConfig = PRIORITY_BADGE[schedule.priority];
                      const isActionLoading = actionLoading === schedule.id;

                      return (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <Link
                              to={`/technician/tasks/${schedule.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {schedule.serviceRequest?.serviceType ?? '—'}
                            </Link>
                          </TableCell>
                          <TableCell>{getCustomerName(schedule)}</TableCell>
                          <TableCell>{formatDate(schedule.scheduledDate)}</TableCell>
                          <TableCell>
                            <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                              {priorityConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={schedule.status} />
                          </TableCell>
                          <TableCell>
                            <TaskActions
                              schedule={schedule}
                              isLoading={isActionLoading}
                              onAccept={() => void handleAccept(schedule.id)}
                              onReject={() => handleOpenRejectDialog(schedule.id)}
                              onStartWork={() => void handleStartWork(schedule.id)}
                              onComplete={() => handleOpenCompleteDialog(schedule.id)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {sortedSchedules.map((schedule) => {
                  const priorityConfig = PRIORITY_BADGE[schedule.priority];
                  const isActionLoading = actionLoading === schedule.id;

                  return (
                    <div key={schedule.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/technician/tasks/${schedule.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {schedule.serviceRequest?.serviceType ?? '—'}
                        </Link>
                        <StatusBadge status={schedule.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Customer: </span>
                          {getCustomerName(schedule)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date: </span>
                          {formatDate(schedule.scheduledDate)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Priority: </span>
                          <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                            {priorityConfig.label}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Assigned: </span>
                          {formatDate(schedule.createdAt)}
                        </div>
                      </div>
                      <TaskActions
                        schedule={schedule}
                        isLoading={isActionLoading}
                        onAccept={() => void handleAccept(schedule.id)}
                        onReject={() => handleOpenRejectDialog(schedule.id)}
                        onStartWork={() => void handleStartWork(schedule.id)}
                        onComplete={() => handleOpenCompleteDialog(schedule.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Reject Task Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reject-reason" className="text-sm font-medium">
                Rejection Reason
              </label>
              <textarea
                id="reject-reason"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Please provide a reason for rejecting this task (min 10 characters)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {rejectReason.length}/10 characters minimum
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isSubmittingReject}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={rejectReason.length < 10 || isSubmittingReject} onClick={() => void handleReject()}>
              Reject Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Task Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="completion-report" className="text-sm font-medium">
                Completion Report
              </label>
              <textarea
                id="completion-report"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Describe the work completed (min 20 characters)..."
                value={completionReport}
                onChange={(e) => setCompletionReport(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {completionReport.length}/20 characters minimum
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)} disabled={isSubmittingComplete}>
              Cancel
            </Button>
            <Button disabled={completionReport.length < 20 || isSubmittingComplete} onClick={() => void handleComplete()}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Task Actions Component ---

interface TaskActionsProps {
  schedule: TechnicianSchedule;
  isLoading: boolean;
  onAccept: () => void;
  onReject: () => void;
  onStartWork: () => void;
  onComplete: () => void;
}

function TaskActions({ schedule, isLoading, onAccept, onReject, onStartWork, onComplete }: TaskActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {schedule.status === 'assigned' && (
        <>
          <Button variant="default" size="sm" disabled={isLoading} onClick={onAccept}>
            Accept
          </Button>
          <Button variant="destructive" size="sm" disabled={isLoading} onClick={onReject}>
            Reject
          </Button>
        </>
      )}
      {schedule.status === 'accepted' && (
        <Button variant="default" size="sm" disabled={isLoading} onClick={onStartWork}>
          Start Work
        </Button>
      )}
      {schedule.status === 'in-progress' && (
        <Button variant="default" size="sm" disabled={isLoading} onClick={onComplete}>
          Complete
        </Button>
      )}
      {schedule.status === 'completed' && (
        <span className="text-xs text-muted-foreground">Done</span>
      )}
      {schedule.status === 'rejected' && (
        <span className="text-xs text-muted-foreground">Rejected</span>
      )}
    </div>
  );
}
