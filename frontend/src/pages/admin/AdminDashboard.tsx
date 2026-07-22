import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

interface AdminDashboardData {
  pendingRequests: number;
  activeTechnicians: number;
  totalReports: number;
  totalCustomers: number;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData>({
    pendingRequests: 0,
    activeTechnicians: 0,
    totalReports: 0,
    totalCustomers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch service requests and count pending ones
        const requestsResponse = await api.get('/service-requests');
        const requests = requestsResponse.data.data ?? requestsResponse.data ?? [];
        const pendingRequests = Array.isArray(requests)
          ? requests.filter((r: { status: string }) => r.status === 'pending').length
          : 0;

        // Fetch technicians and count available ones
        let activeTechnicians = 0;
        try {
          const techResponse = await api.get('/admin/technicians');
          const technicians = techResponse.data.data ?? techResponse.data ?? [];
          activeTechnicians = Array.isArray(technicians)
            ? technicians.filter(
                (t: { technicianDetail?: { availabilityStatus: string } }) =>
                  t.technicianDetail?.availabilityStatus === 'available'
              ).length
            : 0;
        } catch {
          // Technicians endpoint may not be accessible
        }

        // Fetch customers count
        let totalCustomers = 0;
        try {
          const customersResponse = await api.get('/admin/customers');
          const customers = customersResponse.data.data ?? customersResponse.data ?? [];
          totalCustomers = Array.isArray(customers) ? customers.length : 0;
        } catch {
          // Customers endpoint may not be accessible
        }

        // Fetch reports count
        let totalReports = 0;
        try {
          const reportsResponse = await api.get('/reports');
          const reports = reportsResponse.data.data ?? reportsResponse.data ?? [];
          totalReports = Array.isArray(reports) ? reports.length : 0;
        } catch {
          // Reports endpoint may not be accessible
        }

        setData({ pendingRequests, activeTechnicians, totalReports, totalCustomers });
      } catch {
        // Error handled by axios interceptor
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard...</div>
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Requests</CardDescription>
            <CardTitle className="text-3xl">{data.pendingRequests}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Service requests awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Technicians</CardDescription>
            <CardTitle className="text-3xl">{data.activeTechnicians}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Technicians currently available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reports</CardDescription>
            <CardTitle className="text-3xl">{data.totalReports}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Reports generated to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Customers</CardDescription>
            <CardTitle className="text-3xl">{data.totalCustomers}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Registered customer accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Navigation</CardTitle>
          <CardDescription>Jump to management modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button asChild className="w-full">
              <Link to="/admin/requests">Manage Requests</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/admin/schedules">Manage Schedules</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/admin/products">Manage Products</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/accounts">Manage Accounts</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/reports">Generate Reports</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
