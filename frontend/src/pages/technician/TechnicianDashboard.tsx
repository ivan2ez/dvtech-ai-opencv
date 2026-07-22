import { useCallback, useEffect, useState } from 'react';
import { RefreshCwIcon, ClipboardListIcon, PlayCircleIcon, CheckCircle2Icon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import type { TechnicianSchedule } from '@/types';
import { getSchedules } from '@/services/scheduleApi';

export function TechnicianDashboard() {
  const [schedules, setSchedules] = useState<TechnicianSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all schedules — backend filters by technician role
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

  const assignedCount = schedules.filter(
    (s) => s.status === 'assigned' || s.status === 'accepted'
  ).length;
  const inProgressCount = schedules.filter((s) => s.status === 'in-progress').length;
  const completedCount = schedules.filter((s) => s.status === 'completed').length;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Technician Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's an overview of your tasks.</p>
        </div>
        <Button variant="outline" onClick={() => void fetchSchedules()}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void fetchSchedules()}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <p className="text-muted-foreground py-4">Loading your tasks...</p>
      )}

      {!isLoading && !error && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-6 space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <ClipboardListIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Assigned Tasks</span>
              </div>
              <p className="text-3xl font-bold">{assignedCount}</p>
              <p className="text-xs text-muted-foreground">Tasks waiting for action</p>
            </div>

            <div className="rounded-lg border p-6 space-y-2">
              <div className="flex items-center gap-2 text-orange-600">
                <PlayCircleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">In Progress</span>
              </div>
              <p className="text-3xl font-bold">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">Tasks currently being worked on</p>
            </div>

            <div className="rounded-lg border p-6 space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2Icon className="h-5 w-5" />
                <span className="text-sm font-medium">Completed</span>
              </div>
              <p className="text-3xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Tasks finished</p>
            </div>
          </div>

          {/* Quick Link */}
          <div className="pt-4">
            <Link to="/technician/tasks">
              <Button>
                <ClipboardListIcon data-icon="inline-start" />
                View My Tasks
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
