import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCwIcon, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { CompleteTaskDialog } from '@/components/technician/CompleteTaskDialog';
import type { TechnicianSchedule, SchedulePriority } from '@/types';
import {
  getSchedules,
  startTask,
  undoTask,
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
  const navigate = useNavigate();
  const [allSchedules, setAllSchedules] = useState<TechnicianSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filter & sort
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('scheduledDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTaskId, setCompleteTaskId] = useState<number | null>(null);
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
    if (activeFilter === 'assigned') return s.status === 'assigned';
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
  async function handleStartWork(id: number) {
    setActionLoading(id);
    setError(null);
    try {
      await startTask(id);
      await fetchSchedules();
      toast.success(`Task #${id} started. It is now in progress.`);
    } catch {
      setError('Failed to start the task. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUndo(id: number) {
    setActionLoading(id);
    setError(null);
    try {
      await undoTask(id);
      await fetchSchedules();
      toast.success(`Task #${id} reverted to assigned.`);
    } catch {
      setError('Failed to undo the task status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleOpenCompleteDialog(id: number) {
    setCompleteTaskId(id);
    setCompleteDialogOpen(true);
  }

  async function handleComplete(report: string, photo: File) {
    if (!completeTaskId) return;
    setIsSubmittingComplete(true);
    setError(null);
    try {
      const id = completeTaskId;
      await completeTask(completeTaskId, report, photo);
      setCompleteDialogOpen(false);
      setCompleteTaskId(null);
      await fetchSchedules();
      toast.success(`Task #${id} marked as completed.`);
    } catch {
      // The axios interceptor surfaces the backend message via toast.
      setError('Failed to complete the task. Please try again.');
    } finally {
      setIsSubmittingComplete(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-sm text-muted-foreground">View and manage your assigned service tasks</p>
        </div>
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
              ? allSchedules.filter((s) => s.status === 'assigned').length
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
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 w-full rounded-lg bg-muted" />
          ))}
        </div>
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
                        <TableRow
                          key={schedule.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/technician/tasks/${schedule.id}`)}
                        >
                          <TableCell className="font-medium">
                            {schedule.serviceRequest?.serviceType ?? '—'}
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
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <TaskActions
                              schedule={schedule}
                              isLoading={isActionLoading}
                              onStartWork={() => void handleStartWork(schedule.id)}
                              onUndo={() => void handleUndo(schedule.id)}
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
                    <div
                      key={schedule.id}
                      className="rounded-lg border p-4 space-y-3 cursor-pointer"
                      onClick={() => navigate(`/technician/tasks/${schedule.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {schedule.serviceRequest?.serviceType ?? '—'}
                        </span>
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
                      <div onClick={(e) => e.stopPropagation()}>
                        <TaskActions
                          schedule={schedule}
                          isLoading={isActionLoading}
                          onStartWork={() => void handleStartWork(schedule.id)}
                          onUndo={() => void handleUndo(schedule.id)}
                          onComplete={() => handleOpenCompleteDialog(schedule.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Complete Task Dialog (report + required photo) */}
      <CompleteTaskDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        taskId={completeTaskId}
        isSubmitting={isSubmittingComplete}
        onSubmit={(report, photo) => void handleComplete(report, photo)}
      />
    </div>
  );
}

// --- Task Actions Component ---

interface TaskActionsProps {
  schedule: TechnicianSchedule;
  isLoading: boolean;
  onStartWork: () => void;
  onUndo: () => void;
  onComplete: () => void;
}

function TaskActions({ schedule, isLoading, onStartWork, onUndo, onComplete }: TaskActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {schedule.status === 'assigned' && (
        <Button variant="default" size="sm" disabled={isLoading} onClick={onStartWork}>
          Start
        </Button>
      )}
      {schedule.status === 'in-progress' && (
        <>
          <Button variant="outline" size="sm" disabled={isLoading} onClick={onUndo}>
            Undo
          </Button>
          <Button variant="default" size="sm" disabled={isLoading} onClick={onComplete}>
            Complete
          </Button>
        </>
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
