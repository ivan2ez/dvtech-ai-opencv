import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCwIcon,
  ClipboardList,
  Users,
  UserCheck,
  BarChart3,
  ArrowRight,
  CheckIcon,
  XIcon,
  WrenchIcon,
  UserRoundIcon,
  CalendarClockIcon,
  PhoneIcon,
  MapPinIcon,
  FileTextIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DetailDialog, DetailItem, DetailTextBlock } from '@/components/shared/DetailDialog';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { approveServiceRequest, rejectServiceRequest } from '@/services/serviceRequestApi';
import type { ServiceRequest } from '@/types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

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
  const [recentRequests, setRecentRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail dialog + approve/reject state (mirrors ManageRequests behavior).
  const [detailRequest, setDetailRequest] = useState<ServiceRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<ServiceRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchStats() {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, requestsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/service-requests', { params: { page: 1, pageSize: 50 } }),
      ]);
      setData(statsRes.data);
      // Show only pending requests (newest first), capped to the 5 most recent.
      const pending: ServiceRequest[] = (requestsRes.data?.data ?? [])
        .filter((r: ServiceRequest) => r.status === 'pending')
        .slice(0, 5);
      setRecentRequests(pending);
    } catch {
      setError('Failed to load dashboard statistics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function getAssignedTechnicianName(request: ServiceRequest): string | null {
    const active = request.technicianSchedules?.find((s) => s.status !== 'rejected');
    return active?.technician?.name ?? null;
  }

  function handleRowClick(request: ServiceRequest) {
    setDetailRequest(request);
    setDetailDialogOpen(true);
  }

  async function handleApprove(request: ServiceRequest) {
    setIsSubmitting(true);
    try {
      await approveServiceRequest(request.id);
      toast.success(`Request #${request.id} approved.`);
      setDetailDialogOpen(false);
      await fetchStats();
    } catch (err) {
      console.error('Failed to approve request:', err);
      toast.error('Failed to approve request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenRejectDialog(request: ServiceRequest) {
    setRejectingRequest(request);
    setRejectReason('');
    setRejectDialogOpen(true);
  }

  async function handleConfirmReject() {
    if (!rejectingRequest) return;
    const reason = rejectReason.trim();
    if (reason.length < 10) {
      toast.error('Rejection reason must be at least 10 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      await rejectServiceRequest(rejectingRequest.id, reason);
      toast.success(`Request #${rejectingRequest.id} rejected.`);
      setRejectDialogOpen(false);
      setDetailDialogOpen(false);
      await fetchStats();
    } catch (err) {
      console.error('Failed to reject request:', err);
      toast.error('Failed to reject request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    void fetchStats();
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void fetchStats()}>
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name ?? 'Admin'}. Here's your system overview.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchStats()}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          to="/admin/requests"
          icon={ClipboardList}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
          label="Pending Requests"
          value={data.pendingRequests}
          description="Awaiting approval"
          accentColor="border-l-orange-500"
        />
        <StatCard
          to="/admin/accounts"
          icon={UserCheck}
          iconColor="text-green-600"
          iconBg="bg-green-100"
          label="Active Technicians"
          value={data.activeTechnicians}
          description="Currently available"
          accentColor="border-l-green-500"
        />
        <StatCard
          to="/admin/accounts"
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          label="Total Customers"
          value={data.totalCustomers}
          description="Registered accounts"
          accentColor="border-l-blue-500"
        />
        <StatCard
          to="/admin/reports"
          icon={BarChart3}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
          label="Total Reports"
          value={data.totalReports}
          description="Generated to date"
          accentColor="border-l-purple-500"
        />
      </div>

      {/* Recent Pending Requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Pending Requests</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/requests">
              <span className="inline-flex items-center gap-1.5">View All <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          </Button>
        </div>

        {recentRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRequests.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(req)}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for request #${req.id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRowClick(req);
                      }}
                    >
                      <TableCell className="font-medium">
                        {req.user?.name ?? `User #${req.userId}`}
                      </TableCell>
                      <TableCell>{req.serviceType}</TableCell>
                      <TableCell>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail dialog with approve/reject (pending requests only) */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailRequest ? `Request #${detailRequest.id}` : ''}
        subtitle={detailRequest ? `Submitted ${formatDate(detailRequest.createdAt)}` : undefined}
        headerRight={detailRequest ? <StatusBadge status={detailRequest.status} /> : undefined}
        actions={
          detailRequest && detailRequest.status === 'pending' ? (
            <>
              <Button
                variant="success"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  void handleApprove(detailRequest);
                }}
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  const request = detailRequest;
                  setDetailDialogOpen(false);
                  handleOpenRejectDialog(request);
                }}
              >
                <XIcon className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </>
          ) : undefined
        }
      >
        {detailRequest && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem
                icon={WrenchIcon}
                label="Service Type"
                value={<span className="capitalize">{detailRequest.serviceType}</span>}
              />
              <DetailItem
                icon={UserRoundIcon}
                label="Technician"
                value={
                  getAssignedTechnicianName(detailRequest) ?? (
                    <span className="text-muted-foreground">Unassigned</span>
                  )
                }
              />
              <DetailItem
                icon={CalendarClockIcon}
                label="Submitted"
                value={formatDate(detailRequest.createdAt)}
              />
              <DetailItem
                icon={CalendarClockIcon}
                label="Required Date"
                value={detailRequest.serviceRequiredDate ? formatDate(detailRequest.serviceRequiredDate) : '—'}
              />
              <DetailItem
                icon={PhoneIcon}
                label="Contact Number"
                value={detailRequest.contactNumber || '—'}
              />
              {(detailRequest.installBrand || detailRequest.installModel) && (
                <DetailItem
                  icon={WrenchIcon}
                  label="AC Unit to Install"
                  value={[detailRequest.installBrand, detailRequest.installModel]
                    .filter((p) => p && p.trim().length > 0)
                    .join(' ') || '—'}
                />
              )}
              <div className="sm:col-span-2">
                <DetailItem
                  icon={MapPinIcon}
                  label="Service Address"
                  value={[
                    detailRequest.serviceStreet,
                    detailRequest.serviceBarangay,
                    detailRequest.serviceCity,
                    detailRequest.serviceProvince,
                  ]
                    .map((p) => (p ?? '').trim())
                    .filter((p) => p.length > 0)
                    .join(', ') || '—'}
                />
              </div>
            </div>

            <DetailTextBlock icon={FileTextIcon} label="AC Details">
              {detailRequest.acDetails || '—'}
            </DetailTextBlock>
          </>
        )}
      </DetailDialog>

      {/* Reject reason dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Service Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting request #{rejectingRequest?.id}.
            </p>
            <div className="space-y-2">
              <label htmlFor="reject-reason" className="text-sm font-medium">
                Rejection Reason
              </label>
              <textarea
                id="reject-reason"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Please provide a reason for rejecting this request (min 10 characters)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {rejectReason.trim().length}/500 characters (minimum 10)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmReject()}
              disabled={isSubmitting || rejectReason.trim().length < 10}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({
  to,
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  description,
  accentColor,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  description: string;
  accentColor: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className={`hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-l-4 ${accentColor}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardDescription className="text-sm font-medium">{label}</CardDescription>
          <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="text-3xl font-bold">{value}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ─── Dashboard Skeleton ─── */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-muted">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-9 w-9 rounded-lg bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent table */}
      <div>
        <div className="h-5 w-44 rounded bg-muted mb-3" />
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
