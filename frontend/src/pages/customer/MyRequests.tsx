import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PlusIcon,
  RefreshCwIcon,
  WrenchIcon,
  UserRoundIcon,
  CalendarClockIcon,
  ClockIcon,
  FileTextIcon,
  MapPinIcon,
  PhoneIcon,
  CalendarCheckIcon,
  SearchIcon,
  Trash2Icon,
  RotateCcwIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { RescheduleResponseDialog } from '@/components/customer/RescheduleResponseDialog';
import type { ServiceRequest, ServiceRequestStatus } from '@/types';
import {
  formatDateOnly,
  formatRequestReference,
  formatRequiredSchedule,
  matchesRequestReference,
  TIME_SLOT_LABELS,
} from '@/utils/serviceRequest';
import {
  getServiceRequests,
  respondToReschedule,
  deleteOwnRequest,
  restoreOwnRequest,
  permanentlyDeleteOwnRequest,
} from '@/services/serviceRequestApi';

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

/**
 * Returns the current (non-rejected) technician assignment for a request, if
 * one exists. Schedules arrive newest-first from the API; a rejected schedule
 * means that assignment was declined and shouldn't be shown as "assigned".
 */
function getActiveAssignment(request: ServiceRequest) {
  const schedules = request.technicianSchedules ?? [];
  return schedules.find((s) => s.status !== 'rejected' && s.technician) ?? null;
}

export function MyRequests() {
  const navigate = useNavigate();
  // The reschedule email links here as /my-requests?request=<id>, so the
  // relevant row's dialog can be opened straight away.
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Active list vs the customer's personal recycle bin.
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');
  // Search (by request ID/reference or service type) + status filter.
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceRequestStatus>('all');

  // Delete / recycle-bin action state.
  const [isMutating, setIsMutating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRequest | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<ServiceRequest | null>(null);

  // Reschedule accept/decline dialog
  const [rescheduleRequest, setRescheduleRequest] = useState<ServiceRequest | null>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);

  const fetchRequests = useCallback(
    async (page = 1, scope: 'active' | 'deleted' = 'active') => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getServiceRequests({ page, pageSize: 20, scope });
        setRequests(response.data);
        setPagination(response.pagination);
      } catch (err) {
        console.error('Failed to fetch service requests:', err);
        setError('Failed to load service requests. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchRequests(1, activeTab);
  }, [fetchRequests, activeTab]);

  /**
   * Rows awaiting a reschedule decision open the accept/decline dialog; every
   * other row opens the read-only details.
   */
  function handleViewDetails(request: ServiceRequest) {
    if (request.status === 'needs-rescheduling') {
      setRescheduleRequest(request);
      setRescheduleDialogOpen(true);
      return;
    }
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  }

  // Follow the ?request=<id> deep link from the notification email once the
  // list has loaded, then drop the params so a refresh doesn't reopen it.
  useEffect(() => {
    const requestedId = searchParams.get('request');
    if (!requestedId || requests.length === 0) return;

    const match = requests.find((r) => String(r.id) === requestedId);
    if (match) {
      handleViewDetails(match);
    } else {
      toast.error('That request could not be found in your records.');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('request');
    next.delete('token');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, searchParams]);

  /** Applies the customer's accept/decline decision on a proposed schedule. */
  async function handleRescheduleResponse(action: 'accept' | 'decline', notes?: string) {
    if (!rescheduleRequest) return;

    try {
      await respondToReschedule(rescheduleRequest.id, action, notes);
    } catch (err) {
      // Surface the backend message (e.g. the 48-hour window has passed) inside
      // the dialog by rethrowing it.
      const message =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object'
          ? ((err as { response: { data?: { message?: string } } }).response?.data?.message ??
            'Failed to submit your response.')
          : 'Failed to submit your response.';

      // A lapsed window changes the status server-side, so refresh either way.
      await fetchRequests(pagination.page, activeTab);
      throw new Error(message);
    }

    setRescheduleDialogOpen(false);
    setRescheduleRequest(null);
    await fetchRequests(pagination.page, activeTab);
    toast.success(
      action === 'accept'
        ? 'New schedule accepted. Your request is now assigned.'
        : 'New schedule declined.'
    );
  }

  // --- Recycle-bin actions ---

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsMutating(true);
    try {
      await deleteOwnRequest(deleteTarget.id);
      setDeleteTarget(null);
      await fetchRequests(pagination.page, activeTab);
      toast.success('Request moved to your recycle bin.');
    } catch (err) {
      console.error('Failed to delete request:', err);
      toast.error('Failed to move the request to the recycle bin.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRestore(request: ServiceRequest) {
    setIsMutating(true);
    try {
      await restoreOwnRequest(request.id);
      await fetchRequests(pagination.page, activeTab);
      toast.success('Request restored.');
    } catch (err) {
      console.error('Failed to restore request:', err);
      toast.error('Failed to restore the request.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmPurge() {
    if (!purgeTarget) return;
    setIsMutating(true);
    try {
      await permanentlyDeleteOwnRequest(purgeTarget.id);
      setPurgeTarget(null);
      await fetchRequests(pagination.page, activeTab);
      toast.success('Request permanently deleted.');
    } catch (err) {
      console.error('Failed to permanently delete request:', err);
      toast.error('Failed to permanently delete the request.');
    } finally {
      setIsMutating(false);
    }
  }

  // Client-side search (by request ID/reference or service type) + status filter.
  const query = searchQuery.trim().toLowerCase();
  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      query.length === 0 ||
      matchesRequestReference(r.id, searchQuery) ||
      r.serviceType.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | ServiceRequestStatus; label: string }> = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'needs-rescheduling', label: 'Needs Rescheduling' },
    { value: 'declined', label: 'Declined' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Service Requests</h1>
        <Button onClick={() => navigate('/service-request')}>
          <PlusIcon className="h-4 w-4 mr-1" />
          New Request
        </Button>
      </div>

      {/* Active list vs Recycle bin */}
      <div className="flex items-center gap-1 border-b">
        {(['active', 'deleted'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'active' ? 'My Requests' : 'Recycle Bin'}
          </button>
        ))}
      </div>

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search request ID or service type..."
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
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ServiceRequestStatus)}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
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
            <Button variant="outline" onClick={() => void fetchRequests(pagination.page, activeTab)}>
              <RefreshCwIcon className="h-4 w-4 mr-1" />
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
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              {activeTab === 'deleted' ? (
                <p className="text-muted-foreground">Your recycle bin is empty.</p>
              ) : requests.length === 0 ? (
                <>
                  <p className="text-muted-foreground">No service requests found.</p>
                  <Button onClick={() => navigate('/service-request')}>
                    Submit Your First Request
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">No requests match your search or filter.</p>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Required Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow
                        key={request.id}
                        className="cursor-pointer"
                        onClick={() => handleViewDetails(request)}
                      >
                        {/* The reference doubles as the customer's ticket number
                            when they contact DVTech about this request. */}
                        <TableCell className="font-medium">
                          {formatRequestReference(request.id)}
                        </TableCell>
                        <TableCell className="capitalize">{request.serviceType}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateOnly(request.serviceRequiredDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={request.status} />
                            {request.status === 'needs-rescheduling' && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                <CalendarCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                Action needed
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(request.createdAt)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {activeTab === 'active' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isMutating}
                              onClick={() => setDeleteTarget(request)}
                              aria-label={`Delete request ${formatRequestReference(request.id)}`}
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isMutating}
                                onClick={() => void handleRestore(request)}
                              >
                                <RotateCcwIcon className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isMutating}
                                onClick={() => setPurgeTarget(request)}
                                aria-label={`Permanently delete request ${formatRequestReference(request.id)}`}
                              >
                                <Trash2Icon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-lg border p-4 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleViewDetails(request)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${request.serviceType} request`}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleViewDetails(request); }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatRequestReference(request.id)}</span>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="text-sm font-medium capitalize">{request.serviceType}</p>
                    <p className="text-sm text-muted-foreground">
                      {truncateText(request.acDetails, 80)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Required: {formatRequiredSchedule(request.serviceRequiredDate, request.serviceRequiredTime)}
                    </p>
                    {request.status === 'needs-rescheduling' && (
                      <p className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <CalendarCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Tap to accept or decline the new schedule
                      </p>
                    )}
                    <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                      {activeTab === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={isMutating}
                          onClick={() => setDeleteTarget(request)}
                        >
                          <Trash2Icon className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isMutating}
                            onClick={() => void handleRestore(request)}
                          >
                            <RotateCcwIcon className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isMutating}
                            onClick={() => setPurgeTarget(request)}
                          >
                            <Trash2Icon className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(request.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => void fetchRequests(pagination.page - 1, activeTab)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => void fetchRequests(pagination.page + 1, activeTab)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={selectedRequest ? `Request ${formatRequestReference(selectedRequest.id)}` : ''}
        subtitle={selectedRequest ? `Submitted ${formatDate(selectedRequest.createdAt)}` : undefined}
        headerRight={selectedRequest ? <StatusBadge status={selectedRequest.status} /> : undefined}
      >
        {selectedRequest && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem
                icon={WrenchIcon}
                label="Service Type"
                value={<span className="capitalize">{selectedRequest.serviceType}</span>}
              />
              <DetailItem
                icon={UserRoundIcon}
                label="Technician"
                value={
                  getActiveAssignment(selectedRequest)?.technician?.name ?? (
                    <span className="text-muted-foreground">Unassigned</span>
                  )
                }
              />
              <DetailItem
                icon={CalendarClockIcon}
                label="Submitted"
                value={formatDate(selectedRequest.createdAt)}
              />
              <DetailItem
                icon={CalendarClockIcon}
                label="Required Date"
                value={formatDateOnly(selectedRequest.serviceRequiredDate)}
              />
              <DetailItem
                icon={ClockIcon}
                label="Requested Time"
                value={
                  selectedRequest.serviceRequiredTime
                    ? TIME_SLOT_LABELS[selectedRequest.serviceRequiredTime]
                    : '—'
                }
              />
              <DetailItem
                icon={ClockIcon}
                label="Last Updated"
                value={formatDate(selectedRequest.updatedAt)}
              />
              <DetailItem
                icon={PhoneIcon}
                label="Contact Number"
                value={selectedRequest.contactNumber || '—'}
              />
              {(selectedRequest.installBrand || selectedRequest.installModel) && (
                <DetailItem
                  icon={WrenchIcon}
                  label="AC Unit to Install"
                  value={[selectedRequest.installBrand, selectedRequest.installModel]
                    .filter((p) => p && p.trim().length > 0)
                    .join(' ') || '—'}
                />
              )}
              <div className="sm:col-span-2">
                <DetailItem
                  icon={MapPinIcon}
                  label="Service Address"
                  value={[
                    selectedRequest.serviceStreet,
                    selectedRequest.serviceBarangay,
                    selectedRequest.serviceCity,
                    selectedRequest.serviceProvince,
                  ]
                    .map((p) => (p ?? '').trim())
                    .filter((p) => p.length > 0)
                    .join(', ') || '—'}
                />
              </div>
            </div>

            <DetailTextBlock icon={FileTextIcon} label="AC Details">
              {selectedRequest.acDetails || '—'}
            </DetailTextBlock>

            {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
              <DetailTextBlock icon={FileTextIcon} label="Rejection Reason">
                {selectedRequest.rejectionReason}
              </DetailTextBlock>
            )}

            {/* Outcome of a reschedule the customer declined or let expire. */}
            {selectedRequest.status === 'declined' && (
              <DetailTextBlock icon={FileTextIcon} label="You declined the proposed schedule">
                {selectedRequest.rescheduleDeclineNotes ||
                  'No notes were added. Contact DVTech to arrange another schedule.'}
              </DetailTextBlock>
            )}

            {selectedRequest.status === 'expired' && (
              <DetailTextBlock icon={ClockIcon} label="Expired">
                {selectedRequest.proposedDate
                  ? 'The 48-hour window to accept or decline the proposed schedule passed without a response. Please submit a new request.'
                  : 'This request expired without being scheduled. Please submit a new request.'}
              </DetailTextBlock>
            )}

            {/* Assigned technician */}
            {(() => {
              const assignment = getActiveAssignment(selectedRequest);
              if (!assignment?.technician) {
                return (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <UserRoundIcon className="h-3.5 w-3.5" />
                      Assigned Technician
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      No technician has been assigned yet.
                    </p>
                  </div>
                );
              }
              const tech = assignment.technician;
              return (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <UserRoundIcon className="h-3.5 w-3.5" />
                    Assigned Technician
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-sm font-medium">{tech.name}</p>
                    {tech.technicianDetail?.specialization && (
                      <p className="text-xs text-muted-foreground">
                        Specialization: {tech.technicianDetail.specialization}
                      </p>
                    )}
                    {tech.technicianDetail?.contactNumber && (
                      <p className="text-xs text-muted-foreground">
                        Contact: {tech.technicianDetail.contactNumber}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Scheduled: {formatDate(assignment.scheduledDate)}
                    </p>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </DetailDialog>

      {/* Accept / decline a proposed schedule */}
      <RescheduleResponseDialog
        request={rescheduleRequest}
        open={rescheduleDialogOpen}
        onOpenChange={(open) => {
          setRescheduleDialogOpen(open);
          if (!open) setRescheduleRequest(null);
        }}
        onRespond={handleRescheduleResponse}
      />

      {/* Delete → recycle bin confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move request{' '}
            <span className="font-medium text-foreground">
              {deleteTarget ? formatRequestReference(deleteTarget.id) : ''}
            </span>{' '}
            to your recycle bin? You can restore it later from the Recycle Bin tab.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isMutating}
            >
              Move to Recycle Bin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirmation */}
      <Dialog open={purgeTarget !== null} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently Delete Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete request{' '}
            <span className="font-medium text-foreground">
              {purgeTarget ? formatRequestReference(purgeTarget.id) : ''}
            </span>
            ? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmPurge()}
              disabled={isMutating}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
