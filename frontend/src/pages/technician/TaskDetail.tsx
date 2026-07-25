import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, RefreshCwIcon, CheckCircle2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import type { TechnicianSchedule, ScheduleStatus, SchedulePriority } from '@/types';
import {
  getScheduleById,
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

const STATUS_STEPS: { key: ScheduleStatus; label: string }[] = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStepIndex(status: ScheduleStatus): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [schedule, setSchedule] = useState<TechnicianSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completionReport, setCompletionReport] = useState('');
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getScheduleById(Number(id));
      setSchedule(data);
    } catch (err) {
      console.error('Failed to fetch task details:', err);
      setError('Failed to load task details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  async function handleAccept() {
    if (!schedule) return;
    setActionLoading(true);
    setError(null);
    try {
      await acceptTask(schedule.id);
      await fetchSchedule();
    } catch (err) {
      console.error('Failed to accept task:', err);
      setError('Failed to accept task. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenRejectDialog() {
    setRejectReason('');
    setRejectDialogOpen(true);
  }

  async function handleReject() {
    if (!schedule || rejectReason.length < 10) return;
    setIsSubmittingReject(true);
    setError(null);
    try {
      await rejectTask(schedule.id, rejectReason);
      setRejectDialogOpen(false);
      setRejectReason('');
      await fetchSchedule();
    } catch (err) {
      console.error('Failed to reject task:', err);
      setError('Failed to reject task. Please try again.');
    } finally {
      setIsSubmittingReject(false);
    }
  }

  async function handleStartWork() {
    if (!schedule) return;
    setActionLoading(true);
    setError(null);
    try {
      await updateTaskStatus(schedule.id);
      await fetchSchedule();
    } catch (err) {
      console.error('Failed to start work:', err);
      setError('Failed to update task status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenCompleteDialog() {
    setCompletionReport('');
    setCompleteDialogOpen(true);
  }

  async function handleComplete() {
    if (!schedule || completionReport.length < 20) return;
    setIsSubmittingComplete(true);
    setError(null);
    try {
      await completeTask(schedule.id, completionReport);
      setCompleteDialogOpen(false);
      setCompletionReport('');
      await fetchSchedule();
    } catch (err) {
      console.error('Failed to complete task:', err);
      setError('Failed to complete task. Please try again.');
    } finally {
      setIsSubmittingComplete(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading task details...</p>
      </div>
    );
  }

  if (error && !schedule) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void fetchSchedule()}>
          <RefreshCwIcon data-icon="inline-start" />
          Retry
        </Button>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Task not found.</p>
      </div>
    );
  }

  const statusConfig = SCHEDULE_STATUS_BADGE[schedule.status];
  const priorityConfig = PRIORITY_BADGE[schedule.priority];
  const currentStepIndex = getStepIndex(schedule.status);

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Link to="/technician/tasks">
        <Button variant="ghost" size="sm">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to Tasks
        </Button>
      </Link>

      {/* Error display */}
      {error && (
        <div className="flex items-center justify-center py-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Task overview */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Task #{schedule.id}</h1>
          <Button variant="outline" size="sm" onClick={() => void fetchSchedule()}>
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Schedule ID</p>
            <p className="font-medium">#{schedule.id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Scheduled Date</p>
            <p className="font-medium">{formatDate(schedule.scheduledDate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={statusConfig.variant} className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Priority</p>
            <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
              {priorityConfig.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Status progression */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Status Progression</h2>
        <div className="flex items-center justify-between">
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isFuture = index > currentStepIndex;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2Icon className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <p
                    className={`text-xs mt-1 text-center ${
                      isCompleted
                        ? 'text-green-600 dark:text-green-400 font-medium'
                        : isCurrent
                          ? 'text-blue-600 dark:text-blue-400 font-medium'
                          : isFuture
                            ? 'text-gray-400 dark:text-gray-500'
                            : ''
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
                {index < STATUS_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      index < currentStepIndex
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Service request details */}
      {schedule.serviceRequest && (
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Service Request Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Service Type</p>
              <p className="font-medium">{schedule.serviceRequest.serviceType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{schedule.serviceRequest?.user?.name ?? `User #${schedule.serviceRequest?.userId ?? '—'}`}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">AC Details</p>
              <p className="font-medium">{schedule.serviceRequest.acDetails ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Request Status</p>
              <p className="font-medium capitalize">{schedule.serviceRequest.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Request Created</p>
              <p className="font-medium">{formatDate(schedule.serviceRequest.createdAt)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Completion report display */}
      {schedule.status === 'completed' && schedule.report && (
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Completion Report</h2>
          <p className="text-sm whitespace-pre-wrap">{schedule.report}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex items-center gap-3">
          {schedule.status === 'assigned' && (
            <>
              <Button
                variant="default"
                disabled={actionLoading}
                onClick={() => void handleAccept()}
                aria-label={`Accept task #${schedule.id}`}
              >
                Accept
              </Button>
              <Button
                variant="destructive"
                disabled={actionLoading}
                onClick={handleOpenRejectDialog}
                aria-label={`Reject task #${schedule.id}`}
              >
                Reject
              </Button>
            </>
          )}
          {schedule.status === 'accepted' && (
            <Button
              variant="default"
              disabled={actionLoading}
              onClick={() => void handleStartWork()}
              aria-label={`Start work on task #${schedule.id}`}
            >
              Start Work
            </Button>
          )}
          {schedule.status === 'in-progress' && (
            <Button
              variant="default"
              disabled={actionLoading}
              onClick={handleOpenCompleteDialog}
              aria-label={`Complete task #${schedule.id}`}
            >
              Complete
            </Button>
          )}
          {schedule.status === 'completed' && (
            <span className="text-sm text-muted-foreground">This task has been completed.</span>
          )}
          {schedule.status === 'rejected' && (
            <span className="text-sm text-muted-foreground">This task was rejected.</span>
          )}
        </div>
      </div>

      {/* Reject Task Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Task #{schedule.id}</DialogTitle>
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
            <DialogTitle>Complete Task #{schedule.id}</DialogTitle>
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
