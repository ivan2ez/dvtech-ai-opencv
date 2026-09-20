import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, RefreshCwIcon, CheckCircle2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { CompleteTaskDialog } from '@/components/technician/CompleteTaskDialog';
import { resolveUploadUrl } from '@/lib/completionPhoto';
import type { TechnicianSchedule, ScheduleStatus, SchedulePriority } from '@/types';
import {
  getScheduleById,
  startTask,
  undoTask,
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

// Backend status machine: assigned -> in-progress -> completed.
const STATUS_STEPS: { key: ScheduleStatus; label: string }[] = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
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

  async function handleStartWork() {
    if (!schedule) return;
    setActionLoading(true);
    setError(null);
    try {
      await startTask(schedule.id);
      await fetchSchedule();
      toast.success(`Task #${schedule.id} started. It is now in progress.`);
    } catch (err) {
      console.error('Failed to start work:', err);
      setError('Failed to start the task. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndo() {
    if (!schedule) return;
    setActionLoading(true);
    setError(null);
    try {
      await undoTask(schedule.id);
      await fetchSchedule();
      toast.success(`Task #${schedule.id} reverted to assigned.`);
    } catch (err) {
      console.error('Failed to undo task status:', err);
      setError('Failed to undo the task status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenCompleteDialog() {
    setCompleteDialogOpen(true);
  }

  async function handleComplete(report: string, photo: File) {
    if (!schedule) return;
    setIsSubmittingComplete(true);
    setError(null);
    try {
      const scheduleId = schedule.id;
      await completeTask(schedule.id, report, photo);
      setCompleteDialogOpen(false);
      await fetchSchedule();
      toast.success(`Task #${scheduleId} marked as completed.`);
    } catch (err) {
      console.error('Failed to complete task:', err);
      // The axios interceptor surfaces the backend message via toast.
      setError('Failed to complete the task. Please try again.');
    } finally {
      setIsSubmittingComplete(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="rounded-lg border p-6 space-y-4">
          <div className="h-7 w-40 rounded bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-5 w-28 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <div className="h-5 w-36 rounded bg-muted mb-4" />
          <div className="h-10 w-full rounded bg-muted" />
        </div>
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
  const completionPhotoUrl = resolveUploadUrl(schedule.reportPhotoPath);

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Link to="/technician/tasks" className="inline-block mb-2">
        <Button variant="outline" size="sm">
          <ArrowLeftIcon className="h-4 w-4 mr-1.5" />
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
          {schedule.status === 'completed' && schedule.completedAt && (
            <div>
              <p className="text-sm text-muted-foreground">Completed Date</p>
              <p className="font-medium">{formatDateTime(schedule.completedAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status progression — hidden for rejected tasks, which are off the main path */}
      {schedule.status !== 'rejected' && (
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Status Progression</h2>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, index) => {
              const isTaskComplete = schedule.status === 'completed';
              const isCompleted = isTaskComplete || index < currentStepIndex;
              const isCurrent = !isTaskComplete && index === currentStepIndex;
              const isFuture = !isTaskComplete && index > currentStepIndex;

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
                      {isCompleted ? <CheckCircle2Icon className="w-5 h-5" /> : index + 1}
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
                        schedule.status === 'completed' || index < currentStepIndex
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
      )}

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
            {(schedule.serviceRequest.installBrand || schedule.serviceRequest.installModel) && (
              <div>
                <p className="text-sm text-muted-foreground">AC Unit to Install</p>
                <p className="font-medium">
                  {[schedule.serviceRequest.installBrand, schedule.serviceRequest.installModel]
                    .filter((p) => p && p.trim().length > 0)
                    .join(' ') || '—'}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Request Status</p>
              <p className="font-medium capitalize">{schedule.serviceRequest.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Request Created</p>
              <p className="font-medium">{formatDate(schedule.serviceRequest.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Required Date</p>
              <p className="font-medium">
                {schedule.serviceRequest.serviceRequiredDate
                  ? formatDate(schedule.serviceRequest.serviceRequiredDate)
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completion report display */}
      {schedule.status === 'completed' && schedule.report && (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h2 className="text-lg font-semibold">Completion Report</h2>
            {schedule.completedAt && (
              <p className="text-sm text-muted-foreground">
                Completed on {formatDateTime(schedule.completedAt)}
              </p>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{schedule.report}</p>

          {/* Completion photo */}
          {completionPhotoUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Completion Photo</p>
              <a href={completionPhotoUrl} target="_blank" rel="noreferrer" className="inline-block">
                <img
                  src={completionPhotoUrl}
                  alt={`Completion photo for task #${schedule.id}`}
                  className="max-h-72 w-full max-w-md rounded-md border object-contain bg-muted"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Rejection reason display */}
      {schedule.status === 'rejected' && schedule.rejectionReason && (
        <div className="rounded-lg border p-6 space-y-2">
          <h2 className="text-lg font-semibold">Rejection Reason</h2>
          <p className="text-sm whitespace-pre-wrap">{schedule.rejectionReason}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex items-center gap-3">
          {schedule.status === 'assigned' && (
            <Button
              variant="default"
              disabled={actionLoading}
              onClick={() => void handleStartWork()}
              aria-label={`Start task #${schedule.id}`}
            >
              Start
            </Button>
          )}
          {schedule.status === 'in-progress' && (
            <>
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => void handleUndo()}
                aria-label={`Undo start on task #${schedule.id}`}
              >
                Undo
              </Button>
              <Button
                variant="default"
                disabled={actionLoading}
                onClick={handleOpenCompleteDialog}
                aria-label={`Complete task #${schedule.id}`}
              >
                Complete
              </Button>
            </>
          )}
          {schedule.status === 'completed' && (
            <span className="text-sm text-muted-foreground">This task has been completed.</span>
          )}
          {schedule.status === 'rejected' && (
            <span className="text-sm text-muted-foreground">This task was rejected.</span>
          )}
        </div>
      </div>

      {/* Complete Task Dialog (report + required photo) */}
      <CompleteTaskDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        taskId={schedule.id}
        isSubmitting={isSubmittingComplete}
        onSubmit={(report, photo) => void handleComplete(report, photo)}
      />
    </div>
  );
}
