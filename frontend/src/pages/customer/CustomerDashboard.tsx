import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { ArrowRight, Bot, BrainCircuit, Wrench } from 'lucide-react';
import { StatusBadge } from '../../components/shared/StatusBadge';
import api from '../../services/api';
import type { ServiceRequest } from '../../types';

interface DashboardData {
  totalRequests: number;
  pendingRequests: number;
  activeRequests: ServiceRequest[];
  recentRequests: ServiceRequest[];
}

export function CustomerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    totalRequests: 0,
    pendingRequests: 0,
    activeRequests: [],
    recentRequests: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await api.get<{ data: ServiceRequest[]; total: number }>('/service-requests');
        const requests = response.data.data ?? [];

        const totalRequests = response.data.total ?? requests.length;
        const pendingRequests = requests.filter((r) => r.status === 'pending').length;
        const activeStatuses = ['assigned', 'accepted', 'in-progress'];
        const activeRequests = requests.filter((r) => activeStatuses.includes(r.status));
        const recentRequests = [...requests]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        setData({ totalRequests, pendingRequests, activeRequests, recentRequests });
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
          Here's your service overview.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
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
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl">{data.pendingRequests}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting admin approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">{data.activeRequests.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently being serviced</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Service Highlight */}
      {data.activeRequests.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Active Service
            </CardTitle>
            <CardDescription>Your service currently in progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activeRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-md border bg-background p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{request.serviceType}</p>
                  <p className="text-sm text-muted-foreground">
                    Submitted on {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>Your latest service requests</CardDescription>
          </div>
          {data.recentRequests.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/my-requests" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {data.recentRequests.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">No service requests yet.</p>
              <Button asChild>
                <Link to="/service-request">Submit Your First Request</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium capitalize">{request.serviceType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Need Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>Not sure what AC unit you need? Let our AI assist you.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-auto py-4 justify-start gap-3">
              <Link to="/ai-recommendation">
                <BrainCircuit className="h-5 w-5 shrink-0 text-primary" />
                <div className="text-left">
                  <p className="font-medium">AI Recommendation</p>
                  <p className="text-xs text-muted-foreground font-normal">
                    Get a personalized AC suggestion based on your room
                  </p>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start gap-3">
              <Link to="/chat">
                <Bot className="h-5 w-5 shrink-0 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Chat with AI Assistant</p>
                  <p className="text-xs text-muted-foreground font-normal">
                    Ask questions about AC maintenance and troubleshooting
                  </p>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

