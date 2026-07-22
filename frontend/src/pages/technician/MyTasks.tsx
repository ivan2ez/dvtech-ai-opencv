import { useCallback, useEffect, useState } from 'react';
import { RefreshCwIcon } from 'lucide-react';

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

import type { TechnicianSchedule, ScheduleStatus, SchedulePriority } from '@/types';
import {
  getSchedules,
  acceptTask,
  rejectTask,
  updateTaskStatus,
  completeTask,
} from '@/services/scheduleApi';

const SCHEDULE_STATUS_BADGE: Record<
  ScheduleStatus,
  { label: string; className: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  assigned: { label: 'Assigned', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', variant: 'outline' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', variant: 'outline' },
  rejected: { label: 'Rejected', className: '', variant: 'destructive' },
  'in-progress': { label: 'In Progress', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', variant: 'outline' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', variant: 'outline' },
};

const PRIORITY_BADGE: Record<
  SchedulePriority,
  { label: string; className: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', variant: 'outline' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', variant: 'outline' },
  high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', variant: 'outline' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function MyTasks() {
  const [schedules, setSchedules] = useState<TechnicianSchedule[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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

  const fetchSchedules = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSchedules({ page, pageSize: 20 });
      setSchedules(response.data);
      setPagination(response.pagination);
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

  async function handleAccept(id: number) {
    setActionLoading(id);
    setError(null);
    try {
      await acceptTask(id);
      await fetchSchedules(pagination.page);
    } catch (err) {
      console.error('Failed to accept task:', err);
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
      await fetchSchedules(pagination.page);
    } catch (err) {
      console.error('Failed to reject task:', err);
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
      await fetchSchedules(pagination.page);
    } catch (err) {
      console.error('Failed to start work:', err);
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
      await fetchSchedules(pagination.page);
    } catch (err) {
      console.error('Failed to complete task:', err);
      setError('Failed to complete task. Please try again.');
    } finally {
      setIsSubmittingComplete(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <Button variant="outline" onClick={() => void fetchSchedules(pagination.page)}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void fetchSchedules(pagination.page)}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <p className="text-muted-foreground py-4">Loading tasks...</p>
      )}

      {!isLoading && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Service Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No tasks assigned to you.
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((schedule) => {
                  const statusConfig = SCHEDULE_STATUS_BADGE[schedule.status];
                  const priorityConfig = PRIORITY_BADGE[schedule.priority];
                  const isActionLoading = actionLoading === schedule.id;

                  return (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">#{schedule.id}</TableCell>
                      <TableCell>
                        {schedule.serviceRequest?.serviceType ?? '—'}
                      </TableCell>
                      <TableCell>
                        User #{schedule.serviceRequest?.userId ?? '—'}
                      </TableCell>
                      <TableCell>{formatDate(schedule.scheduledDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                          {priorityConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {schedule.status === 'assigned' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                disabled={isActionLoading}
                                onClick={() => void handleAccept(schedule.id)}
                                aria-label={`Accept task #${schedule.id}`}
                              >
                                Accept
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isActionLoading}
                                onClick={() => handleOpenRejectDialog(schedule.id)}
                                aria-label={`Reject task #${schedule.id}`}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {schedule.status === 'accepted' && (
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isActionLoading}
                              onClick={() => void handleStartWork(schedule.id)}
                              aria-label={`Start work on task #${schedule.id}`}
                            >
                              Start Work
                            </Button>
                          )}
                          {schedule.status === 'in-progress' && (
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isActionLoading}
                              onClick={() => handleOpenCompleteDialog(schedule.id)}
                              aria-label={`Complete task #${schedule.id}`}
                            >
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => void fetchSchedules(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => void fetchSchedules(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Task Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Task #{rejectTaskId}</DialogTitle>
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
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmittingReject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.length < 10 || isSubmittingReject}
              onClick={() => void handleReject()}
            >
              Reject Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Task Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task #{completeTaskId}</DialogTitle>
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
            <Button
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
              disabled={isSubmittingComplete}
            >
              Cancel
            </Button>
            <Button
              disabled={completionReport.length < 20 || isSubmittingComplete}
              onClick={() => void handleComplete()}
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
