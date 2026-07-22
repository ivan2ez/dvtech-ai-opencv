import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import type { ServiceRequest } from '../../types';

interface DashboardData {
  totalRequests: number;
  pendingRequests: number;
  recentRequests: ServiceRequest[];
  latestRecommendation: { id: number; unitType: string; recommendedHp: number; createdAt: string } | null;
}

export function CustomerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    totalRequests: 0,
    pendingRequests: 0,
    recentRequests: [],
    latestRecommendation: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await api.get<{ data: ServiceRequest[] }>('/service-requests');
        const requests = response.data.data ?? response.data ?? [];

        const totalRequests = requests.length;
        const pendingRequests = requests.filter((r) => r.status === 'pending').length;
        const recentRequests = [...requests]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        // Try fetching the latest AI recommendation
        let latestRecommendation = null;
        try {
          const recResponse = await api.get('/ai/recommendations/latest');
          if (recResponse.data) {
            latestRecommendation = recResponse.data;
          }
        } catch {
          // No recommendation available — that's fine
        }

        setData({ totalRequests, pendingRequests, recentRequests, latestRecommendation });
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
          Welcome back, {user?.name ?? 'Customer'}!
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your service requests and recommendations.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-3xl">{data.totalRequests}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All service requests submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Requests</CardDescription>
            <CardTitle className="text-3xl">{data.pendingRequests}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting admin approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>AI Recommendation</CardDescription>
            <CardTitle className="text-xl">
              {data.latestRecommendation ? (
                <span className="flex items-center gap-2">
                  {data.latestRecommendation.unitType}
                  <Badge variant="secondary">{data.latestRecommendation.recommendedHp} HP</Badge>
                </span>
              ) : (
                <span className="text-muted-foreground text-base">No recommendation yet</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {data.latestRecommendation
                ? `Generated on ${new Date(data.latestRecommendation.createdAt).toLocaleDateString()}`
                : 'Get your first AI-powered AC recommendation'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks you can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild className="w-full">
              <Link to="/service-request">Submit a Service Request</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/ai-recommendation">Get AI Recommendation</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/my-requests">View My Requests</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/chat">Chat with Assistant</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Requests */}
      {data.recentRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>Your latest service requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{request.serviceType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    approved: 'default',
    rejected: 'destructive',
    assigned: 'default',
    'in-progress': 'default',
    completed: 'outline',
  };

  return <Badge variant={variantMap[status] ?? 'secondary'}>{status}</Badge>;
}
