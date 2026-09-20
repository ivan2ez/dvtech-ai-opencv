import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCwIcon,
  ClipboardListIcon,
  PlayCircleIcon,
  CheckCircle2Icon,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';

import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useAuth } from '@/hooks/useAuth';
import type { TechnicianSchedule } from '@/types';
import { getSchedules } from '@/services/scheduleApi';

export function TechnicianDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<TechnicianSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSchedules({ page: 1, pageSize: 100 });
      setSchedules(response.data);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
      setError('Failed to load your tasks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  if (isLoading) {
    return <TechnicianDashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void fetchSchedules()}>
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const assignedTasks = schedules.filter(
    (s) => s.status === 'assigned' || s.status === 'accepted'
  );
  const inProgressTasks = schedules.filter((s) => s.status === 'in-progress');
  const completedTasks = schedules.filter((s) => s.status === 'completed');

  // Show upcoming tasks (assigned + in-progress, sorted by date)
  const upcomingTasks = [...assignedTasks, ...inProgressTasks]
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Technician Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name ?? 'Technician'}. Here's your task overview.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchSchedules()}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <ClipboardListIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardDescription className="text-sm font-medium">Assigned Tasks</CardDescription>
              <CardTitle className="text-3xl font-bold mt-1">{assignedTasks.length}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Waiting for your action</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
              <PlayCircleIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardDescription className="text-sm font-medium">In Progress</CardDescription>
              <CardTitle className="text-3xl font-bold mt-1">{inProgressTasks.length}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Currently being worked on</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2Icon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardDescription className="text-sm font-medium">Completed</CardDescription>
              <CardTitle className="text-3xl font-bold mt-1">{completedTasks.length}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Tasks finished</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Upcoming Tasks</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/technician/tasks">
              <span className="inline-flex items-center gap-1.5">View All Tasks <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          </Button>
        </div>

        {upcomingTasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No upcoming tasks</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingTasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/technician/tasks/${task.id}`)}
                    >
                      <TableCell className="font-medium">
                        {task.serviceRequest?.serviceType ?? '—'}
                      </TableCell>
                      <TableCell>
                        {task.serviceRequest?.user?.name ?? `User #${task.serviceRequest?.userId ?? '—'}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(task.scheduledDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── Priority Badge ─── */
function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { className: string; label: string }> = {
    high: { className: 'bg-red-100 text-red-800 border-red-200', label: 'High' },
    medium: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Medium' },
    low: { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Low' },
  };
  const c = config[priority] ?? {
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    label: 'Low',
  };
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

/* ─── Skeleton ─── */
function TechnicianDashboardSkeleton() {
  return (
    <div className="space-y-8 p-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-52 rounded bg-muted" />
        <div className="h-4 w-80 rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-muted">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-8 w-12 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="h-5 w-32 rounded bg-muted mb-3" />
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full rounded bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
