import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, XIcon, RefreshCwIcon, SearchIcon, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

import { StatusBadge } from '@/components/shared/StatusBadge';
import type { ServiceRequest, ServiceRequestStatus } from '@/types';
import {
  getServiceRequests,
  approveServiceRequest,
  rejectServiceRequest,
} from '@/services/serviceRequestApi';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

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

type SortDirection = 'asc' | 'desc';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState<'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  function toggleSort() {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  // Client-side filtering by status and search
  const filteredRequests = requests
    .filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        r.serviceType.toLowerCase().includes(query) ||
        (r.acDetails && r.acDetails.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });

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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search service type or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Status:
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
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>AC Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={toggleSort}
                    >
                      Date
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </TableHead>
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
                      <TableCell>{request.user?.name ?? `User #${request.userId}`}</TableCell>
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
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filteredRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No service requests found.</p>
            ) : (
              filteredRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">#{request.id}</span>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Customer:</span> {request.user?.name ?? `User #${request.userId}`}</p>
                      <p><span className="text-muted-foreground">Service:</span> {request.serviceType}</p>
                      <p><span className="text-muted-foreground">Details:</span> {truncateText(request.acDetails, 60)}</p>
                      <p><span className="text-muted-foreground">Date:</span> {formatDate(request.createdAt)}</p>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white flex-1"
                          disabled={isSubmitting}
                          onClick={() => void handleApprove(request)}
                        >
                          <CheckIcon data-icon="inline-start" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          disabled={isSubmitting}
                          onClick={() => handleOpenRejectDialog(request)}
                        >
                          <XIcon data-icon="inline-start" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

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
