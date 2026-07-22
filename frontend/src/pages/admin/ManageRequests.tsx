import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, XIcon, RefreshCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ServiceRequest, ServiceRequestStatus } from '@/types';
import {
  getServiceRequests,
  approveServiceRequest,
  rejectServiceRequest,
} from '@/services/serviceRequestApi';

const STATUS_BADGE_CONFIG: Record<ServiceRequestStatus, { label: string; className: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', variant: 'outline' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', variant: 'outline' },
  rejected: { label: 'Rejected', className: '', variant: 'destructive' },
  assigned: { label: 'Assigned', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', variant: 'outline' },
  'in-progress': { label: 'In Progress', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', variant: 'outline' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', variant: 'outline' },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function StatusBadge({ status }: { status: ServiceRequestStatus }) {
  const config = STATUS_BADGE_CONFIG[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ManageRequests() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<ServiceRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getServiceRequests({ page, pageSize: 20 });
      setRequests(response.data);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
      setError('Failed to load service requests. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Client-side filtering
  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  async function handleApprove(request: ServiceRequest) {
    setIsSubmitting(true);
    try {
      await approveServiceRequest(request.id);
      await fetchRequests(pagination.page);
    } catch (err) {
      console.error('Failed to approve request:', err);
      setError('Failed to approve request. Please try again.');
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
    setIsSubmitting(true);
    try {
      await rejectServiceRequest(rejectingRequest.id, rejectReason);
      setRejectDialogOpen(false);
      setRejectingRequest(null);
      setRejectReason('');
      await fetchRequests(pagination.page);
    } catch (err) {
      console.error('Failed to reject request:', err);
      setError('Failed to reject request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isRejectReasonValid = rejectReason.length >= 10 && rejectReason.length <= 500;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Service Requests</h1>
        <Button variant="outline" onClick={() => void fetchRequests(pagination.page)}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">
          Filter by status:
        </label>
        <select
          id="status-filter"
          className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void fetchRequests(pagination.page)}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading && !error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service Type</TableHead>
                <TableHead>AC Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No service requests found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">#{request.id}</TableCell>
                    <TableCell>User #{request.userId}</TableCell>
                    <TableCell>{request.serviceType}</TableCell>
                    <TableCell>{truncateText(request.acDetails, 40)}</TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell>
                      {request.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={isSubmitting}
                            onClick={() => void handleApprove(request)}
                            aria-label={`Approve request #${request.id}`}
                          >
                            <CheckIcon data-icon="inline-start" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => handleOpenRejectDialog(request)}
                            aria-label={`Reject request #${request.id}`}
                          >
                            <XIcon data-icon="inline-start" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => void fetchRequests(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => void fetchRequests(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Dialog */}
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
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter reason for rejection (10-500 characters)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {rejectReason.length}/500 characters (minimum 10)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!isRejectReasonValid || isSubmitting}
              onClick={() => void handleConfirmReject()}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
