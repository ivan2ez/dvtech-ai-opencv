import { useCallback, useEffect, useState } from 'react';
import {
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  SearchIcon,
  ArrowUpDown,
  WrenchIcon,
  UserRoundIcon,
  CalendarClockIcon,
  ClockIcon,
  FileTextIcon,
  MapPinIcon,
  PhoneIcon,
  ArchiveIcon,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { DetailDialog, DetailItem, DetailTextBlock } from '@/components/shared/DetailDialog';
import type { ServiceRequest } from '@/types';
import {
  formatDateOnly,
  formatRequestReference,
  formatRequiredSchedule,
  matchesRequestReference,
  TIME_SLOT_LABELS,
  TIME_SLOT_SHORT_LABELS,
} from '@/utils/serviceRequest';
import {
  getServiceRequests,
  approveServiceRequest,
  rejectServiceRequest,
  getArchivedServiceRequests,
  archiveServiceRequest,
  restoreServiceRequestAdmin,
  permanentlyDeleteServiceRequestAdmin,
} from '@/services/serviceRequestApi';
import { ArchivePanel } from '@/components/admin/ArchivePanel';

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

/**
 * Returns the name of the currently assigned technician for a request, or null
 * if none. Schedules arrive newest-first; a rejected schedule was declined and
 * shouldn't count as the current assignment.
 */
function getAssignedTechnicianName(request: ServiceRequest): string | null {
  const schedules = request.technicianSchedules ?? [];
  const active = schedules.find((s) => s.status !== 'rejected' && s.technician);
  return active?.technician?.name ?? null;
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

  // Active list vs Archive (recycle bin) view.
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);
  const [archivingRequest, setArchivingRequest] = useState<ServiceRequest | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Sorting state
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<ServiceRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Details dialog state
  const [detailRequest, setDetailRequest] = useState<ServiceRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  /** Archives a request to the admin recycle bin. */
  async function handleConfirmArchive() {
    if (!archivingRequest) return;
    setIsArchiving(true);
    try {
      const ref = formatRequestReference(archivingRequest.id);
      await archiveServiceRequest(archivingRequest.id);
      setArchivingRequest(null);
      await fetchRequests(pagination.page);
      setArchiveRefreshKey((k) => k + 1);
      toast.success(`Request ${ref} moved to the archive.`);
    } catch (err) {
      console.error('Failed to archive request:', err);
      toast.error('Failed to archive the request.');
    } finally {
      setIsArchiving(false);
    }
  }

  function handleOpenDetails(request: ServiceRequest) {
    setDetailRequest(request);
    setDetailDialogOpen(true);
  }

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

  // Client-side filtering by status and search.
  // Search targets the two things an admin has to hand when a customer calls in:
  // the request ID they were given (SR-0005) and the customer's name.
  const filteredRequests = requests
    .filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const query = searchQuery.trim().toLowerCase();
      const customerName = (r.user?.name ?? '').toLowerCase();
      const matchesSearch =
        !query || matchesRequestReference(r.id, query) || customerName.includes(query);
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
      toast.success(`Request ${formatRequestReference(request.id)} approved.`);
    } catch (err) {
      console.error('Failed to approve request:', err);
      setError('Failed to approve request. Please try again.');
      toast.error('Failed to approve request. Please try again.');
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
      const rejectedId = rejectingRequest.id;
      await rejectServiceRequest(rejectingRequest.id, rejectReason.trim());
      setRejectDialogOpen(false);
      setRejectingRequest(null);
      setRejectReason('');
      await fetchRequests(pagination.page);
      toast.success(`Request ${formatRequestReference(rejectedId)} rejected.`);
    } catch (err) {
      console.error('Failed to reject request:', err);
      setError('Failed to reject request. Please try again.');
      toast.error('Failed to reject request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const trimmedRejectReason = rejectReason.trim();
  const isRejectReasonValid =
    trimmedRejectReason.length >= 10 && trimmedRejectReason.length <= 500;
  const rejectReasonError =
    rejectReason.length === 0
      ? ''
      : trimmedRejectReason.length < 10
        ? 'Reason must be at least 10 characters.'
        : trimmedRejectReason.length > 500
          ? 'Reason must be 500 characters or less.'
          : '';

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Service Requests</h1>
          <p className="text-sm text-muted-foreground">Review, approve, and manage customer service requests</p>
        </div>
        <Button variant="outline" onClick={() => void fetchRequests(pagination.page)}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {/* Requests vs Archive tabs */}
      <div className="flex items-center gap-1 border-b">
        {(['active', 'archive'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'active' ? 'Requests' : 'Archive'}
          </button>
        ))}
      </div>

      {activeTab === 'archive' && (
        <ArchivePanel<ServiceRequest>
          itemLabel="request"
          fetchArchived={getArchivedServiceRequests}
          onRestore={restoreServiceRequestAdmin}
          onPermanentDelete={permanentlyDeleteServiceRequestAdmin}
          refreshKey={archiveRefreshKey}
          columns={[
            { header: 'Request', render: (r) => formatRequestReference(r.id) },
            { header: 'Customer', render: (r) => r.user?.name ?? `User #${r.userId}` },
            { header: 'Service', render: (r) => r.serviceType, className: 'capitalize' },
            { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}

      {activeTab === 'active' && (
      <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search request ID or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search by request ID (e.g. SR-0005) or customer name"
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
                  <TableHead>Request ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Required Date</TableHead>
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No service requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow
                      key={request.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenDetails(request)}
                    >
                      <TableCell className="font-medium">
                        {formatRequestReference(request.id)}
                      </TableCell>
                      <TableCell>{request.user?.name ?? `User #${request.userId}`}</TableCell>
                      <TableCell>
                        {getAssignedTechnicianName(request) ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{request.serviceType}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {request.serviceRequiredDate ? (
                          <>
                            <span className="block">
                              {formatDateOnly(request.serviceRequiredDate)}
                            </span>
                            {request.serviceRequiredTime && (
                              <span className="block text-xs text-muted-foreground">
                                {TIME_SLOT_SHORT_LABELS[request.serviceRequiredTime]}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>{formatDate(request.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {request.status === 'pending' ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="success"
                              size="sm"
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
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setArchivingRequest(request)}
                            aria-label={`Archive request ${formatRequestReference(request.id)}`}
                            title="Move to archive"
                          >
                            <ArchiveIcon className="h-4 w-4" />
                          </Button>
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
                <Card
                  key={request.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleOpenDetails(request)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatRequestReference(request.id)}</span>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Customer:</span> {request.user?.name ?? `User #${request.userId}`}</p>
                      <p><span className="text-muted-foreground">Technician:</span> {getAssignedTechnicianName(request) ?? 'Unassigned'}</p>
                      <p><span className="text-muted-foreground">Service:</span> {request.serviceType}</p>
                      <p>
                        <span className="text-muted-foreground">Required:</span>{' '}
                        {formatRequiredSchedule(request.serviceRequiredDate, request.serviceRequiredTime)}
                      </p>
                      <p><span className="text-muted-foreground">Details:</span> {truncateText(request.acDetails, 60)}</p>
                      <p><span className="text-muted-foreground">Submitted:</span> {formatDate(request.createdAt)}</p>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="success"
                          size="sm"
                          className="flex-1"
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
      </>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={archivingRequest !== null} onOpenChange={(open) => !open && setArchivingRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move request{' '}
            <span className="font-medium text-foreground">
              {archivingRequest ? formatRequestReference(archivingRequest.id) : ''}
            </span>{' '}
            to the archive? You can restore it or delete it permanently from the Archive tab.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchivingRequest(null)} disabled={isArchiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmArchive()} disabled={isArchiving}>
              Move to Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailRequest ? `Request ${formatRequestReference(detailRequest.id)}` : ''}
        subtitle={detailRequest ? `Submitted ${formatDate(detailRequest.createdAt)}` : undefined}
        headerRight={detailRequest ? <StatusBadge status={detailRequest.status} /> : undefined}
        identity={
          detailRequest
            ? {
                name: detailRequest.user?.name ?? `User #${detailRequest.userId}`,
                secondary: detailRequest.user?.email,
              }
            : undefined
        }
        actions={
          detailRequest && detailRequest.status === 'pending' ? (
            <>
              <Button
                variant="success"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  const request = detailRequest;
                  setDetailDialogOpen(false);
                  void handleApprove(request);
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
                value={formatDateOnly(detailRequest.serviceRequiredDate)}
              />
              <DetailItem
                icon={ClockIcon}
                label="Requested Time"
                value={
                  detailRequest.serviceRequiredTime
                    ? TIME_SLOT_LABELS[detailRequest.serviceRequiredTime]
                    : '—'
                }
              />
              <DetailItem
                icon={ClockIcon}
                label="Last Updated"
                value={formatDate(detailRequest.updatedAt)}
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

            {detailRequest.status === 'rejected' && detailRequest.rejectionReason && (
              <DetailTextBlock icon={FileTextIcon} label="Rejection Reason">
                {detailRequest.rejectionReason}
              </DetailTextBlock>
            )}
          </>
        )}
      </DetailDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Service Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting request{' '}
              {rejectingRequest ? formatRequestReference(rejectingRequest.id) : ''}.
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
                aria-invalid={!!rejectReasonError}
              />
              {rejectReasonError ? (
                <p className="text-xs font-medium text-destructive">{rejectReasonError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {trimmedRejectReason.length}/500 characters (minimum 10)
                </p>
              )}
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
