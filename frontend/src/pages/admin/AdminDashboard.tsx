import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCwIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

interface AdminStats {
  pendingRequests: number;
  activeTechnicians: number;
  totalCustomers: number;
  totalReports: number;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminStats>({
    pendingRequests: 0,
    activeTechnicians: 0,
    totalReports: 0,
    totalCustomers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/stats');
      setData(response.data);
    } catch {
      setError('Failed to load dashboard statistics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void fetchStats()}>
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name ?? 'Admin'}. Here's your system overview.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/requests" className="block">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Pending Requests</CardDescription>
              <CardTitle className="text-3xl">{data.pendingRequests}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Service requests awaiting approval</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/accounts" className="block">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Active Technicians</CardDescription>
              <CardTitle className="text-3xl">{data.activeTechnicians}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Technicians currently available</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/reports" className="block">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Total Reports</CardDescription>
              <CardTitle className="text-3xl">{data.totalReports}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Reports generated to date</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/accounts" className="block">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription>Total Customers</CardDescription>
              <CardTitle className="text-3xl">{data.totalCustomers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Registered customer accounts</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
