import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCwIcon,
  CalendarIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  UserCheckIcon,
  SearchIcon,
  ArrowUpDown,
  ArrowRightIcon,
  UserRoundIcon,
  WrenchIcon,
  FlagIcon,
  FileTextIcon,
  MapPinIcon,
  PhoneIcon,
  SendIcon,
  SunIcon,
  SunsetIcon,
  ArchiveIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { CompleteTaskDialog } from '@/components/technician/CompleteTaskDialog';
import { resolveUploadUrl } from '@/lib/completionPhoto';
import { getApiErrorMessage } from '@/lib/utils';
import type {
  ServiceRequest,
  ServiceTimeSlot,
  ScheduleTimeSlot,
  TechnicianSchedule,
  TechnicianInfo,
  AvailableTechnician,
  SchedulePriority,
} from '@/types';
import {
  formatDateOnly,
  formatRequestReference,
  formatRequiredSchedule,
  TIME_SLOT_SHORT_LABELS,
} from '@/utils/serviceRequest';
import {
  getServiceRequests,
  getRequestsAwaitingScheduling,
  proposeReschedule,
} from '@/services/serviceRequestApi';
import {
  getSchedules,
  assignTechnician,
  getTechnicians,
  getAvailableTechnicians,
  completeTask,
  reassignTechnician,
  getArchivedSchedules,
  archiveSchedule,
  restoreSchedule,
  deleteSchedulePermanently,
} from '@/services/scheduleApi';
import { ArchivePanel } from '@/components/admin/ArchivePanel';

const PRIORITY_BADGE: Record<SchedulePriority, { label: string; className: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', variant: 'outline' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', variant: 'outline' },
  high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', variant: 'outline' },
};

const AVAILABILITY_BADGE: Record<string, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  unavailable: { label: 'Unavailable', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const SCHEDULE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/** Joins split address parts into a single readable line, or a dash if empty. */
function formatAddress(parts?: {
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
} | null): string {
  if (!parts) return '—';
  const joined = [parts.street, parts.barangay, parts.city, parts.province]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join(', ');
  return joined || '—';
}

/** Service address stored on a request (snapshot at submit time). */
function formatServiceAddress(request?: ServiceRequest | null): string {
  if (!request) return '—';
  return formatAddress({
    street: request.serviceStreet,
    barangay: request.serviceBarangay,
    city: request.serviceCity,
    province: request.serviceProvince,
  });
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

/** The half-day slots a reschedule can be proposed into. */
const TIME_SLOT_CHOICES: Array<{
  value: ServiceTimeSlot;
  label: string;
  range: string;
  icon: typeof SunIcon;
}> = [
  { value: 'morning', label: 'Morning', range: '8:00 AM to 11:59 AM', icon: SunIcon },
  { value: 'afternoon', label: 'Afternoon', range: '12:00 PM to 5:00 PM', icon: SunsetIcon },
];

const PRIORITY_ORDER: Record<SchedulePriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

type SortField = 'scheduledDate' | 'priority';
type SortDirection = 'asc' | 'desc';

export function ManageSchedules() {
  // Approved requests state
  const [approvedRequests, setApprovedRequests] = useState<ServiceRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Schedules state
  const [schedules, setSchedules] = useState<TechnicianSchedule[]>([]);
  const [schedulePagination, setSchedulePagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Technicians state
  const [technicians, setTechnicians] = useState<TechnicianInfo[]>([]);

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // General state
  const [error, setError] = useState<string | null>(null);

  // Detail dialog state (view a schedule)
  const [detailSchedule, setDetailSchedule] = useState<TechnicianSchedule | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Admin task-completion dialog (report + required photo).
  const [adminCompleteOpen, setAdminCompleteOpen] = useState(false);
  const [isAdminCompleting, setIsAdminCompleting] = useState(false);
  const [adminCompleteError, setAdminCompleteError] = useState<string | null>(null);

  // All-schedules list vs Archive (recycle bin) view.
  const [showArchive, setShowArchive] = useState(false);
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);
  const [archivingSchedule, setArchivingSchedule] = useState<TechnicianSchedule | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Reassign-technician dialog (no-show / advance cancellation): swap to another
  // technician who is free for the SAME date + slot as the existing schedule.
  const [reassignSchedule, setReassignSchedule] = useState<TechnicianSchedule | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignTechnicianId, setReassignTechnicianId] = useState<number | ''>('');
  const [reassignCandidates, setReassignCandidates] = useState<AvailableTechnician[]>([]);
  const [isLoadingReassign, setIsLoadingReassign] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  // Detail dialog state (view an approved request)
  const [detailRequest, setDetailRequest] = useState<ServiceRequest | null>(null);
  const [requestDetailDialogOpen, setRequestDetailDialogOpen] = useState(false);

  function handleOpenRequestDetails(request: ServiceRequest) {
    setDetailRequest(request);
    setRequestDetailDialogOpen(true);
  }

  // Assign dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | ''>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<ScheduleTimeSlot>('morning');
  const [priority, setPriority] = useState<SchedulePriority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignTriedSubmit, setAssignTriedSubmit] = useState(false);

  // Slot-aware available technicians for the assign dialog (only free ones show).
  const [availableTechnicians, setAvailableTechnicians] = useState<AvailableTechnician[]>([]);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);
  const [availableError, setAvailableError] = useState<string | null>(null);

  // Reschedule proposal dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [reschedulingRequest, setReschedulingRequest] = useState<ServiceRequest | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState<ServiceTimeSlot>('morning');
  const [proposedTechnicianId, setProposedTechnicianId] = useState<number | ''>('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleTriedSubmit, setRescheduleTriedSubmit] = useState(false);

  /**
   * Requests waiting on a schedule: approved ones ready to assign, plus any with
   * a proposal already out with the customer, so the admin can see both in one
   * place rather than losing track of what's pending a reply.
   */
  const fetchApprovedRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      // Approved + unscheduled requests come from the gated endpoint, which
      // applies the quotation Paid-gate server-side (a quotation-based request
      // only surfaces once it is paid; non-quotation requests are unaffected —
      // Req 11.5, 11.6, 11.7). We additionally pull requests already out for a
      // customer reschedule reply so the admin sees both pending states in one
      // place, then de-duplicate by id.
      const [awaiting, general] = await Promise.all([
        getRequestsAwaitingScheduling(),
        getServiceRequests({ page: 1, pageSize: 100 }),
      ]);
      const needsRescheduling = general.data.filter(
        (r) => r.status === 'needs-rescheduling'
      );
      const byId = new Map<number, ServiceRequest>();
      for (const request of [...awaiting, ...needsRescheduling]) {
        byId.set(request.id, request);
      }
      setApprovedRequests(Array.from(byId.values()));
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
      setError('Failed to load approved requests. Please try again.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchSchedules = useCallback(async (page = 1) => {
    setIsLoadingSchedules(true);
    try {
      const response = await getSchedules({ page, pageSize: 20 });
      setSchedules(response.data);
      setSchedulePagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
      setError('Failed to load schedules. Please try again.');
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  const fetchTechnicians = useCallback(async () => {
    try {
      const data = await getTechnicians();
      setTechnicians(data);
    } catch (err) {
      console.error('Failed to fetch technicians:', err);
    }
  }, []);

  useEffect(() => {
    void fetchApprovedRequests();
    void fetchSchedules();
    void fetchTechnicians();
  }, [fetchApprovedRequests, fetchSchedules, fetchTechnicians]);

  // Filtered schedules by status and search
  const filteredSchedules = schedules.filter((s) => {
    const matchesStatus = scheduleStatusFilter === 'all' || s.status === scheduleStatusFilter;
    const query = searchQuery.toLowerCase();
    const techName = s.technician?.name?.toLowerCase() ?? '';
    const serviceType = s.serviceRequest?.serviceType?.toLowerCase() ?? '';
    const matchesSearch = !query || techName.includes(query) || serviceType.includes(query);
    return matchesStatus && matchesSearch;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    if (!sortField) return 0;
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'scheduledDate') {
      return (new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()) * modifier;
    }
    if (sortField === 'priority') {
      return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * modifier;
    }
    return 0;
  });

  function handleOpenAssignDialog(request: ServiceRequest) {
    setSelectedRequest(request);
    setSelectedTechnicianId('');
    // Prefill the scheduled date from the customer's requested date when present
    // so the admin only has to pick an available technician; left empty (and
    // editable) when the request carries no requested date (Req 6.1, 6.3, 6.5).
    setScheduledDate(request.serviceRequiredDate ?? '');
    // Seed the slot from the customer's requested time so the free-technician
    // lookup starts from what they actually asked for.
    setSelectedSlot((request.serviceRequiredTime as ScheduleTimeSlot | undefined) ?? 'morning');
    setPriority('medium');
    setAssignTriedSubmit(false);
    setAvailableTechnicians([]);
    setAvailableError(null);
    setAssignDialogOpen(true);
  }

  function handleOpenScheduleDetails(schedule: TechnicianSchedule) {
    setDetailSchedule(schedule);
    setDetailDialogOpen(true);
  }

  /** Archives a completed/rejected schedule to the recycle bin. */
  async function handleConfirmArchiveSchedule() {
    if (!archivingSchedule) return;
    setIsArchiving(true);
    setError(null);
    try {
      const scheduleId = archivingSchedule.id;
      await archiveSchedule(archivingSchedule.id);
      setArchivingSchedule(null);
      setDetailDialogOpen(false);
      await fetchSchedules(schedulePagination.page);
      setArchiveRefreshKey((k) => k + 1);
      toast.success(`Schedule #${scheduleId} moved to the archive.`);
    } catch (err) {
      console.error('Failed to archive schedule:', err);
      // Interceptor surfaces the backend message (e.g. 409 if not completed).
      toast.error(getApiErrorMessage(err, 'Failed to archive the schedule.'));
    } finally {
      setIsArchiving(false);
    }
  }

  function handleOpenReassignDialog(schedule: TechnicianSchedule) {
    setReassignSchedule(schedule);
    setReassignTechnicianId('');
    setReassignCandidates([]);
    setReassignError(null);
    setReassignDialogOpen(true);
  }

  /**
   * Applies the reassignment to the chosen technician, keeping the schedule's
   * existing date + slot. The backend re-validates availability and 409s if the
   * technician can't take that slot.
   */
  async function handleReassign() {
    if (!reassignSchedule || reassignTechnicianId === '') return;
    setIsReassigning(true);
    setError(null);
    try {
      const target = reassignCandidates.find((t) => t.id === Number(reassignTechnicianId));
      await reassignTechnician(reassignSchedule.id, Number(reassignTechnicianId));
      setReassignDialogOpen(false);
      setReassignSchedule(null);
      setDetailDialogOpen(false);
      await fetchSchedules(schedulePagination.page);
      toast.success(
        target
          ? `Task reassigned to ${target.name}.`
          : 'Task reassigned successfully.'
      );
    } catch (err) {
      console.error('Failed to reassign technician:', err);
      // The axios interceptor surfaces the backend message (e.g. the 409) too.
      setReassignError(getApiErrorMessage(err, 'Failed to reassign the technician.'));
    } finally {
      setIsReassigning(false);
    }
  }

  /** Admin completes an in-progress task on the technician's behalf. */
  async function handleAdminComplete(report: string, photo: File) {
    if (!detailSchedule) return;
    setIsAdminCompleting(true);
    setAdminCompleteError(null);
    try {
      const scheduleId = detailSchedule.id;
      const updated = await completeTask(detailSchedule.id, report, photo);
      setAdminCompleteOpen(false);
      setDetailSchedule(updated);
      await fetchSchedules(schedulePagination.page);
      toast.success(`Task #${scheduleId} marked as completed.`);
    } catch (err) {
      console.error('Failed to complete task:', err);
      // Surface the specific server message inline in the modal (Req 17.10);
      // keep the dialog open so the admin can read it and retry.
      setAdminCompleteError(
        getApiErrorMessage(err, 'Failed to complete the task. Please try again.'),
      );
    } finally {
      setIsAdminCompleting(false);
    }
  }

  /**
   * Loads the technicians who are free for the chosen date + slot. The dropdown
   * is fed only by this list, so unavailable / fully-booked technicians never
   * appear. If the currently selected technician drops out of the fresh list
   * (e.g. the admin changed the date), the selection is cleared.
   *
   * On failure the caller surfaces an error state with a Retry action
   * (Req 7.5); a successful-but-empty result is a distinct no-technicians
   * message (Req 7.6). Returns a cleanup flag so the effect can cancel a
   * stale in-flight request.
   */
  const loadAvailableTechnicians = useCallback(
    (date: string, slot: ScheduleTimeSlot) => {
      // Need a valid, non-past date before we can ask the backend anything.
      if (!date || date < getTodayString()) {
        setAvailableTechnicians([]);
        setAvailableError(null);
        setSelectedTechnicianId('');
        return () => {};
      }

      let cancelled = false;
      setIsLoadingAvailable(true);
      setAvailableError(null);

      getAvailableTechnicians(date, slot)
        .then((list) => {
          if (cancelled) return;
          setAvailableTechnicians(list);
          // Drop a stale selection that is no longer free for this date/slot.
          setSelectedTechnicianId((current) =>
            current !== '' && list.some((t) => t.id === current) ? current : ''
          );
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('Failed to load available technicians:', err);
          setAvailableTechnicians([]);
          setSelectedTechnicianId('');
          setAvailableError('Failed to load available technicians for this date.');
        })
        .finally(() => {
          if (!cancelled) setIsLoadingAvailable(false);
        });

      return () => {
        cancelled = true;
      };
    },
    []
  );

  /** Re-runs the available-technicians lookup for the Retry action (Req 7.5). */
  function handleRetryAvailable() {
    loadAvailableTechnicians(scheduledDate, selectedSlot);
  }

  // Reload the dropdown whenever the assign dialog is open and the date/slot
  // changes.
  useEffect(() => {
    if (!assignDialogOpen) return;
    return loadAvailableTechnicians(scheduledDate, selectedSlot);
  }, [assignDialogOpen, scheduledDate, selectedSlot, loadAvailableTechnicians]);

  /**
   * Loads the technicians free for the reassignment's existing date + slot,
   * explicitly excluding the schedule's current technician as a pre-filter
   * (Req 8.1, 8.2) so they can never be reassigned to their own task. On
   * failure the modal shows an error state with a Retry action (Req 8.4); a
   * successful-but-empty result is a distinct no-technicians message (Req 8.5).
   */
  const loadReassignCandidates = useCallback((schedule: TechnicianSchedule) => {
    const slot = (schedule.scheduledTime as ScheduleTimeSlot | null) ?? 'morning';
    let cancelled = false;
    setIsLoadingReassign(true);
    setReassignError(null);

    getAvailableTechnicians(schedule.scheduledDate, slot, schedule.technicianId)
      .then((list) => {
        if (cancelled) return;
        setReassignCandidates(list);
        // Drop a stale selection that is no longer free for this slot.
        setReassignTechnicianId((current) =>
          current !== '' && list.some((t) => t.id === current) ? current : ''
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load available technicians for reassignment:', err);
        setReassignCandidates([]);
        setReassignTechnicianId('');
        setReassignError('Failed to load available technicians for this slot.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReassign(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Re-runs the reassign availability lookup for the Retry action (Req 8.4). */
  function handleRetryReassign() {
    if (reassignSchedule) loadReassignCandidates(reassignSchedule);
  }

  // Load technicians free for the reassignment's existing date + slot whenever
  // the reassign dialog is open.
  useEffect(() => {
    if (!reassignDialogOpen || !reassignSchedule) return;
    return loadReassignCandidates(reassignSchedule);
  }, [reassignDialogOpen, reassignSchedule, loadReassignCandidates]);

  async function handleAssign() {
    if (!selectedRequest || selectedTechnicianId === '' || !scheduledDate) return;
    if (scheduledDate < getTodayString()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const assignedTech = availableTechnicians.find((t) => t.id === Number(selectedTechnicianId));
      await assignTechnician({
        technicianId: Number(selectedTechnicianId),
        serviceRequestId: selectedRequest.id,
        scheduledDate,
        scheduledTime: selectedSlot,
        priority,
      });
      setAssignDialogOpen(false);
      setSelectedRequest(null);
      await fetchApprovedRequests();
      await fetchSchedules(schedulePagination.page);
      toast.success(
        assignedTech
          ? `Technician ${assignedTech.name} assigned successfully.`
          : 'Technician assigned successfully.'
      );
    } catch (err) {
      console.error('Failed to assign technician:', err);
      setError('Failed to assign technician. Please try again.');
      toast.error('Failed to assign technician. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function refreshAll() {
    setError(null);
    void fetchApprovedRequests();
    void fetchSchedules(schedulePagination.page);
    void fetchTechnicians();
  }

  // --- Reschedule proposal ---

  function handleOpenRescheduleDialog(request: ServiceRequest) {
    setReschedulingRequest(request);
    // Seed with whatever is already on the request so the admin only has to
    // change what's actually moving.
    setProposedDate(request.proposedDate ?? '');
    setProposedTime(request.proposedTime ?? request.serviceRequiredTime ?? 'morning');
    setProposedTechnicianId(request.proposedTechnicianId ?? '');
    setRescheduleReason(request.rescheduleReason ?? '');
    setRescheduleTriedSubmit(false);
    setRescheduleDialogOpen(true);
  }

  async function handleSendReschedule() {
    if (!reschedulingRequest || !proposedDate || proposedDate < getTodayString()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await proposeReschedule(reschedulingRequest.id, {
        proposedDate,
        proposedTime,
        proposedTechnicianId: proposedTechnicianId === '' ? null : Number(proposedTechnicianId),
        reason: rescheduleReason.trim() || undefined,
      });

      setRescheduleDialogOpen(false);
      setReschedulingRequest(null);
      await fetchApprovedRequests();
      await fetchSchedules(schedulePagination.page);

      // Surface the email outcome honestly — the proposal is saved either way,
      // but the admin needs to know if the customer wasn't actually notified.
      if (result.emailDelivered) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }
    } catch (err) {
      console.error('Failed to propose reschedule:', err);
      const message = getApiErrorMessage(err, 'Failed to propose a new schedule. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const today = getTodayString();
  const dateError =
    scheduledDate === ''
      ? 'Please choose a scheduled date.'
      : scheduledDate < today
        ? 'Scheduled date cannot be in the past.'
        : '';
  const hasValidDate = !dateError;
  const technicianError = selectedTechnicianId === '' ? 'Please select a technician.' : '';
  const isAssignFormValid = !dateError && !technicianError;

  const rescheduleDateError =
    proposedDate === ''
      ? 'Please choose a new date.'
      : proposedDate < today
        ? 'The new date cannot be in the past.'
        : '';

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Schedules</h1>
          <p className="text-sm text-muted-foreground">Assign technicians and manage service schedules</p>
        </div>
        <Button variant="outline" onClick={refreshAll}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={refreshAll}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Approved Requests Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Requests Awaiting Scheduling</h2>

        {isLoadingRequests && (
          <p className="text-muted-foreground py-4">Loading approved requests...</p>
        )}

        {!isLoadingRequests && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Required Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No approved requests awaiting assignment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    approvedRequests.map((request) => {
                      const awaitingCustomer = request.status === 'needs-rescheduling';
                      return (
                        <TableRow
                          key={request.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleOpenRequestDetails(request)}
                        >
                          <TableCell className="font-medium">
                            {formatRequestReference(request.id)}
                          </TableCell>
                          <TableCell>{request.user?.name ?? `User #${request.userId}`}</TableCell>
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
                            {awaitingCustomer && request.rescheduleExpiresAt && (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                Replies by {formatDate(request.rescheduleExpiresAt)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="default"
                                size="sm"
                                disabled={awaitingCustomer}
                                title={
                                  awaitingCustomer
                                    ? 'Waiting for the customer to accept or decline the proposed schedule'
                                    : undefined
                                }
                                onClick={() => handleOpenAssignDialog(request)}
                                aria-label={`Assign technician to request ${formatRequestReference(request.id)}`}
                              >
                                <UserCheckIcon data-icon="inline-start" />
                                Assign
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRescheduleDialog(request)}
                                aria-label={`Propose a new schedule for request ${formatRequestReference(request.id)}`}
                                title="Use when no technician is available on the customer's chosen slot"
                              >
                                <CalendarClockIcon data-icon="inline-start" />
                                {awaitingCustomer ? 'Re-propose' : 'Reschedule'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {approvedRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No approved requests awaiting assignment.</p>
              ) : (
                approvedRequests.map((request) => (
                  <Card
                    key={request.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleOpenRequestDetails(request)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{formatRequestReference(request.id)}</span>
                        <StatusBadge status={request.status} />
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Customer:</span> {request.user?.name ?? `User #${request.userId}`}</p>
                        <p><span className="text-muted-foreground">Service:</span> {request.serviceType}</p>
                        <p>
                          <span className="text-muted-foreground">Required:</span>{' '}
                          {formatRequiredSchedule(request.serviceRequiredDate, request.serviceRequiredTime)}
                        </p>
                        <p><span className="text-muted-foreground">Details:</span> {truncateText(request.acDetails, 80)}</p>
                      </div>
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          disabled={request.status === 'needs-rescheduling'}
                          onClick={() => handleOpenAssignDialog(request)}
                        >
                          <UserCheckIcon data-icon="inline-start" />
                          Assign Technician
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleOpenRescheduleDialog(request)}
                        >
                          <CalendarClockIcon data-icon="inline-start" />
                          {request.status === 'needs-rescheduling' ? 'Re-propose Schedule' : 'Reschedule'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {/* Existing Schedules Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{showArchive ? 'Archived Schedules' : 'All Schedules'}</h2>
            <Button
              variant={showArchive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowArchive((v) => !v)}
            >
              <ArchiveIcon className="h-4 w-4 mr-1" />
              {showArchive ? 'Back to Schedules' : 'Archive'}
            </Button>
          </div>
          {!showArchive && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search technician or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="schedule-status-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Status:
              </label>
              <select
                id="schedule-status-filter"
                className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={scheduleStatusFilter}
                onChange={(e) => setScheduleStatusFilter(e.target.value)}
              >
                {SCHEDULE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          )}
        </div>

        {showArchive && (
          <ArchivePanel<TechnicianSchedule>
            itemLabel="schedule"
            fetchArchived={getArchivedSchedules}
            onRestore={restoreSchedule}
            onPermanentDelete={deleteSchedulePermanently}
            refreshKey={archiveRefreshKey}
            columns={[
              { header: 'ID', render: (s) => `#${s.id}` },
              { header: 'Technician', render: (s) => s.technician?.name ?? `Tech #${s.technicianId}` },
              { header: 'Service', render: (s) => s.serviceRequest?.serviceType ?? `Request #${s.serviceRequestId}`, className: 'capitalize' },
              { header: 'Date', render: (s) => formatDate(s.scheduledDate) },
              { header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
            ]}
          />
        )}

        {!showArchive && isLoadingSchedules && (
          <p className="text-muted-foreground py-4">Loading schedules...</p>
        )}

        {!showArchive && !isLoadingSchedules && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('scheduledDate')}>
                        Scheduled Date <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('priority')}>
                        Priority <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No schedules found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSchedules.map((schedule) => {
                      const priorityConfig = PRIORITY_BADGE[schedule.priority];
                      const customerName = schedule.serviceRequest?.user?.name;
                      return (
                        <TableRow
                          key={schedule.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleOpenScheduleDetails(schedule)}
                        >
                          <TableCell className="font-medium">#{schedule.id}</TableCell>
                          <TableCell>
                            {schedule.technician?.name ?? `Tech #${schedule.technicianId}`}
                          </TableCell>
                          <TableCell>
                            {customerName ?? `User #${schedule.serviceRequest?.userId ?? '—'}`}
                          </TableCell>
                          <TableCell>
                            {schedule.serviceRequest?.serviceType ?? `Request #${schedule.serviceRequestId}`}
                          </TableCell>
                          <TableCell>{formatDate(schedule.scheduledDate)}</TableCell>
                          <TableCell>
                            <StatusBadge status={schedule.status} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                              {priorityConfig.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredSchedules.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No schedules found.</p>
              ) : (
                sortedSchedules.map((schedule) => {
                  const priorityConfig = PRIORITY_BADGE[schedule.priority];
                  const customerName = schedule.serviceRequest?.user?.name;
                  return (
                    <Card
                      key={schedule.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleOpenScheduleDetails(schedule)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">#{schedule.id}</span>
                          <StatusBadge status={schedule.status} />
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">Technician:</span> {schedule.technician?.name ?? `Tech #${schedule.technicianId}`}</p>
                          <p><span className="text-muted-foreground">Customer:</span> {customerName ?? `User #${schedule.serviceRequest?.userId ?? '—'}`}</p>
                          <p><span className="text-muted-foreground">Service:</span> {schedule.serviceRequest?.serviceType ?? `Request #${schedule.serviceRequestId}`}</p>
                          <p><span className="text-muted-foreground">Date:</span> {formatDate(schedule.scheduledDate)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={priorityConfig.variant} className={priorityConfig.className}>
                            {priorityConfig.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {schedulePagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing page {schedulePagination.page} of {schedulePagination.totalPages} ({schedulePagination.totalItems} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={schedulePagination.page <= 1}
                    onClick={() => void fetchSchedules(schedulePagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={schedulePagination.page >= schedulePagination.totalPages}
                    onClick={() => void fetchSchedules(schedulePagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Schedule Details Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailSchedule ? `Schedule #${detailSchedule.id}` : ''}
        subtitle={detailSchedule ? `Scheduled ${formatDate(detailSchedule.scheduledDate)}` : undefined}
        headerRight={detailSchedule ? <StatusBadge status={detailSchedule.status} /> : undefined}
        identity={
          detailSchedule
            ? {
                name: detailSchedule.technician?.name ?? `Technician #${detailSchedule.technicianId}`,
                secondary: detailSchedule.technician?.email,
              }
            : undefined
        }
        actions={
          detailSchedule?.status === 'in-progress' ? (
            <Button
              onClick={() => {
                setAdminCompleteError(null);
                setAdminCompleteOpen(true);
              }}
            >
              <CheckCircle2Icon className="h-4 w-4 mr-1.5" />
              Complete Task
            </Button>
          ) : detailSchedule?.status === 'assigned' ? (
            <Button variant="outline" onClick={() => handleOpenReassignDialog(detailSchedule)}>
              <UserCheckIcon className="h-4 w-4 mr-1.5" />
              Reassign
            </Button>
          ) : detailSchedule?.status === 'completed' || detailSchedule?.status === 'rejected' ? (
            <Button variant="destructive" onClick={() => setArchivingSchedule(detailSchedule)}>
              <ArchiveIcon className="h-4 w-4 mr-1.5" />
              Archive
            </Button>
          ) : undefined
        }
      >
        {detailSchedule && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem
                icon={UserRoundIcon}
                label="Customer"
                value={
                  detailSchedule.serviceRequest?.user?.name ??
                  `User #${detailSchedule.serviceRequest?.userId ?? '—'}`
                }
              />
              <DetailItem
                icon={WrenchIcon}
                label="Service Type"
                value={
                  <span className="capitalize">
                    {detailSchedule.serviceRequest?.serviceType ??
                      `Request #${detailSchedule.serviceRequestId}`}
                  </span>
                }
              />
              <DetailItem
                icon={CalendarIcon}
                label="Scheduled Date"
                value={formatDate(detailSchedule.scheduledDate)}
              />
              <DetailItem
                icon={FlagIcon}
                label="Priority"
                value={
                  <Badge
                    variant={PRIORITY_BADGE[detailSchedule.priority].variant}
                    className={PRIORITY_BADGE[detailSchedule.priority].className}
                  >
                    {PRIORITY_BADGE[detailSchedule.priority].label}
                  </Badge>
                }
              />
              <DetailItem
                icon={PhoneIcon}
                label="Contact Number"
                value={detailSchedule.serviceRequest?.contactNumber || '—'}
              />
              <div className="sm:col-span-2">
                <DetailItem
                  icon={MapPinIcon}
                  label="Service Address"
                  value={formatServiceAddress(detailSchedule.serviceRequest)}
                />
              </div>
              <div className="sm:col-span-2">
                <DetailItem
                  icon={MapPinIcon}
                  label="Technician Address"
                  value={formatAddress(detailSchedule.technician?.technicianDetail)}
                />
              </div>
            </div>

            {detailSchedule.serviceRequest?.acDetails && (
              <DetailTextBlock icon={FileTextIcon} label="AC Details">
                {detailSchedule.serviceRequest.acDetails}
              </DetailTextBlock>
            )}

            {detailSchedule.report && (
              <DetailTextBlock icon={FileTextIcon} label="Completion Report">
                {detailSchedule.report}
              </DetailTextBlock>
            )}

            {detailSchedule.status === 'completed' && (() => {
              const photoUrl = resolveUploadUrl(detailSchedule.reportPhotoPath);
              if (!photoUrl) return null;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FileTextIcon className="h-3.5 w-3.5" />
                    Completion Photo
                  </div>
                  <a href={photoUrl} target="_blank" rel="noreferrer" className="inline-block">
                    <img
                      src={photoUrl}
                      alt={`Completion photo for schedule #${detailSchedule.id}`}
                      className="max-h-60 w-full rounded-md border object-contain bg-muted"
                    />
                  </a>
                </div>
              );
            })()}

            {detailSchedule.status === 'rejected' && detailSchedule.rejectionReason && (
              <DetailTextBlock icon={FileTextIcon} label="Rejection Reason">
                {detailSchedule.rejectionReason}
              </DetailTextBlock>
            )}
          </>
        )}
      </DetailDialog>

      {/* Admin: complete an in-progress task (report + required photo) */}
      <CompleteTaskDialog
        open={adminCompleteOpen}
        onOpenChange={setAdminCompleteOpen}
        taskId={detailSchedule?.id ?? null}
        isSubmitting={isAdminCompleting}
        submitError={adminCompleteError}
        onSubmit={(report, photo) => void handleAdminComplete(report, photo)}
      />

      {/* Archive Schedule Confirmation */}
      <Dialog open={archivingSchedule !== null} onOpenChange={(open) => !open && setArchivingSchedule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Schedule</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move schedule{' '}
            <span className="font-medium text-foreground">#{archivingSchedule?.id}</span>{' '}
            to the archive? You can restore it or delete it permanently from the Archive view. Only
            completed or rejected schedules can be archived.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchivingSchedule(null)} disabled={isArchiving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmArchiveSchedule()}
              disabled={isArchiving}
            >
              Move to Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Technician Dialog (no-show / advance cancellation) */}
      <Dialog
        open={reassignDialogOpen}
        onOpenChange={(open) => {
          setReassignDialogOpen(open);
          if (!open) {
            setReassignSchedule(null);
            setReassignError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reassign Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move this task to another technician who is free for the same date and time slot —
              for a no-show or an advance cancellation. If no one is available, propose a reschedule
              instead.
            </p>

            {reassignSchedule && (
              <div className="rounded-md border p-3 space-y-1 text-sm">
                <p className="font-medium">Schedule #{reassignSchedule.id}</p>
                <p className="text-muted-foreground">
                  Current technician:{' '}
                  {reassignSchedule.technician?.name ?? `Tech #${reassignSchedule.technicianId}`}
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                  {formatDate(reassignSchedule.scheduledDate)}
                  {reassignSchedule.scheduledTime
                    ? ` — ${TIME_SLOT_SHORT_LABELS[reassignSchedule.scheduledTime]}`
                    : ''}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="reassign-technician" className="text-sm font-medium">
                New Technician
              </label>
              <select
                id="reassign-technician"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                value={reassignTechnicianId}
                disabled={isLoadingReassign}
                onChange={(e) =>
                  setReassignTechnicianId(e.target.value ? Number(e.target.value) : '')
                }
              >
                <option value="">
                  {isLoadingReassign
                    ? 'Loading available technicians...'
                    : reassignCandidates.length === 0
                      ? 'No technicians available for this slot'
                      : 'Select a technician...'}
                </option>
                {reassignCandidates.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} — {tech.availabilityStatus} ({tech.tasksOnDate} task(s) that day)
                  </option>
                ))}
              </select>

              {/* Distinct no-technicians-available message on empty success (Req 8.5) */}
              {!isLoadingReassign && !reassignError && reassignCandidates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No technician is free for this date and slot. Close this and use “Reschedule” to
                  propose a new date to the customer.
                </p>
              )}

              {/* Error state with a retry action on request failure (Req 8.4) */}
              {reassignError && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                  <p className="text-xs font-medium text-destructive">{reassignError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingReassign}
                    onClick={handleRetryReassign}
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5 mr-1" />
                    {isLoadingReassign ? 'Retrying...' : 'Retry'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReassignDialogOpen(false)}
              disabled={isReassigning}
            >
              Cancel
            </Button>
            <Button
              disabled={reassignTechnicianId === '' || isReassigning}
              onClick={() => void handleReassign()}
            >
              {isReassigning ? 'Reassigning...' : 'Reassign Technician'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approved Request Details Dialog */}
      <DetailDialog
        open={requestDetailDialogOpen}
        onOpenChange={setRequestDetailDialogOpen}
        title={detailRequest ? `Request #${detailRequest.id}` : ''}
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
          detailRequest ? (
            <Button
              size="sm"
              onClick={() => {
                const request = detailRequest;
                setRequestDetailDialogOpen(false);
                handleOpenAssignDialog(request);
              }}
            >
              <UserCheckIcon className="h-4 w-4 mr-1" />
              Assign Technician
            </Button>
          ) : undefined
        }
      >
        {detailRequest && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem
                icon={UserRoundIcon}
                label="Customer"
                value={detailRequest.user?.name ?? `User #${detailRequest.userId}`}
              />
              <DetailItem
                icon={WrenchIcon}
                label="Service Type"
                value={<span className="capitalize">{detailRequest.serviceType}</span>}
              />
              <DetailItem
                icon={PhoneIcon}
                label="Contact Number"
                value={detailRequest.contactNumber || '—'}
              />
              <div className="sm:col-span-2">
                <DetailItem
                  icon={MapPinIcon}
                  label="Service Address"
                  value={formatServiceAddress(detailRequest)}
                />
              </div>
            </div>

            <DetailTextBlock icon={FileTextIcon} label="AC Details">
              {detailRequest.acDetails || '—'}
            </DetailTextBlock>
          </>
        )}
      </DetailDialog>

      {/* Assign Technician Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Request details */}
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-sm font-medium">Service Request #{selectedRequest?.id}</p>
              <p className="text-sm text-muted-foreground">
                Customer: {selectedRequest?.user?.name ?? `User #${selectedRequest?.userId ?? '—'}`}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Contact:</span>{' '}
                  {selectedRequest?.contactNumber || '—'}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Type: {selectedRequest?.serviceType}
              </p>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Service address:</span>{' '}
                  {formatServiceAddress(selectedRequest)}
                </span>
              </p>
              {selectedRequest?.acDetails && (
                <p className="text-sm text-muted-foreground">
                  Details: {selectedRequest.acDetails}
                </p>
              )}
            </div>

            {/* Date picker — chosen first, because the technician list is
                filtered to who's free on this date + slot. */}
            <div className="space-y-2">
              <label htmlFor="schedule-date" className="text-sm font-medium flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Scheduled Date
              </label>
              <input
                id="schedule-date"
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                min={getTodayString()}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                aria-invalid={assignTriedSubmit && !!dateError}
              />
              {assignTriedSubmit && dateError && (
                <p className="text-xs font-medium text-destructive">{dateError}</p>
              )}
            </div>

            {/* Time slot selector — part of the availability lookup key. */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Slot</label>
              <div className="grid grid-cols-2 gap-2">
                {TIME_SLOT_CHOICES.map((choice) => {
                  const Icon = choice.icon;
                  const isSelected = selectedSlot === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setSelectedSlot(choice.value)}
                      className={`flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:border-ring'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <Icon className="h-4 w-4" />
                        {choice.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{choice.range}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Technician selector — populated only with technicians who are
                free for the selected date + slot. */}
            <div className="space-y-2">
              <label htmlFor="technician-select" className="text-sm font-medium">
                Technician
              </label>
              <select
                id="technician-select"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedTechnicianId}
                disabled={!hasValidDate || isLoadingAvailable}
                onChange={(e) => setSelectedTechnicianId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">
                  {!hasValidDate
                    ? 'Choose a date first...'
                    : isLoadingAvailable
                      ? 'Loading available technicians...'
                      : availableTechnicians.length === 0
                        ? 'No technicians available for this slot'
                        : 'Select a technician...'}
                </option>
                {availableTechnicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} — {tech.availabilityStatus} ({tech.tasksOnDate} task(s) that day)
                  </option>
                ))}
              </select>

              {/* Distinct no-technicians-available message on empty success (Req 7.6) */}
              {hasValidDate && !isLoadingAvailable && !availableError && availableTechnicians.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No technician is free for this date and slot. Try another slot or date, or propose
                  a reschedule.
                </p>
              )}

              {/* Error state with a retry action on request failure (Req 7.5) */}
              {availableError && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                  <p className="text-xs font-medium text-destructive">{availableError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingAvailable}
                    onClick={handleRetryAvailable}
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5 mr-1" />
                    {isLoadingAvailable ? 'Retrying...' : 'Retry'}
                  </Button>
                </div>
              )}

              {/* Availability display for the selected technician */}
              {selectedTechnicianId !== '' && (() => {
                const tech = availableTechnicians.find((t) => t.id === Number(selectedTechnicianId));
                if (!tech) return null;
                const config = AVAILABILITY_BADGE[tech.availabilityStatus] ?? {
                  label: 'Available',
                  className:
                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                };
                return (
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className={config.className}>
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {tech.tasksOnDate} task(s) scheduled that day
                    </span>
                    {tech.contactNumber && (
                      <span className="text-xs text-muted-foreground">• {tech.contactNumber}</span>
                    )}
                  </div>
                );
              })()}

              {assignTriedSubmit && hasValidDate && technicianError && (
                <p className="text-xs font-medium text-destructive">{technicianError}</p>
              )}
            </div>

            {/* Priority selector */}
            <div className="space-y-2">
              <label htmlFor="priority-select" className="text-sm font-medium">
                Priority
              </label>
              <select
                id="priority-select"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={priority}
                onChange={(e) => setPriority(e.target.value as SchedulePriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                setAssignTriedSubmit(true);
                if (isAssignFormValid) void handleAssign();
              }}
            >
              Assign Technician
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Propose Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Propose reschedule</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {reschedulingRequest && (
              <Badge variant="outline" className="w-fit">
                {formatRequestReference(reschedulingRequest.id)}
              </Badge>
            )}

            <p className="text-sm text-muted-foreground">
              No technician is available on the customer's scheduled date. Suggest a new date and
              time — the customer will be asked to confirm before it's finalized, and has 48 hours
              to respond before the request expires.
            </p>

            {/* Current vs proposed, so the change is obvious at a glance */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-md border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Current schedule</p>
                <p className="text-sm line-through text-muted-foreground">
                  {formatRequiredSchedule(
                    reschedulingRequest?.serviceRequiredDate ?? null,
                    reschedulingRequest?.serviceRequiredTime ?? null
                  )}
                </p>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Proposed schedule</p>
                <p className="text-sm font-medium">
                  {proposedDate ? formatRequiredSchedule(proposedDate, proposedTime) : '—'}
                </p>
              </div>
            </div>

            {/* New date */}
            <div className="space-y-2">
              <label htmlFor="reschedule-date" className="text-sm font-medium">
                New date
              </label>
              <input
                id="reschedule-date"
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                min={getTodayString()}
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                aria-invalid={rescheduleTriedSubmit && !!rescheduleDateError}
              />
              {rescheduleTriedSubmit && rescheduleDateError && (
                <p className="text-xs font-medium text-destructive">{rescheduleDateError}</p>
              )}
            </div>

            {/* New time */}
            <div className="space-y-2">
              <span className="text-sm font-medium">New time</span>
              <div role="radiogroup" aria-label="New time" className="grid grid-cols-2 gap-3">
                {TIME_SLOT_CHOICES.map((slot) => {
                  const isSelected = proposedTime === slot.value;
                  const Icon = slot.icon;
                  return (
                    <label
                      key={slot.value}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-input hover:bg-muted/50'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="radio"
                          className="h-4 w-4"
                          name="reschedule-time"
                          value={slot.value}
                          checked={isSelected}
                          onChange={() => setProposedTime(slot.value)}
                        />
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {slot.label}
                      </span>
                      <span className="pl-6 text-xs text-muted-foreground">{slot.range}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Technician (optional) */}
            <div className="space-y-2">
              <label htmlFor="reschedule-technician" className="text-sm font-medium">
                Select technician
              </label>
              <select
                id="reschedule-technician"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={proposedTechnicianId}
                onChange={(e) =>
                  setProposedTechnicianId(e.target.value ? Number(e.target.value) : '')
                }
              >
                <option value="">Unassigned</option>
                {technicians.map((tech) => {
                  const availability = tech.technicianDetail?.availabilityStatus ?? 'available';
                  return (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} — {availability}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-muted-foreground">
                Optional. Leave as Unassigned to propose only the new date and time.
              </p>
            </div>

            {/* Reason (optional) */}
            <div className="space-y-2">
              <label htmlFor="reschedule-reason" className="text-sm font-medium">
                Reason (optional)
              </label>
              <textarea
                id="reschedule-reason"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="No technician available on the original date."
                maxLength={500}
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {rescheduleReason.trim().length}/500 — shown to the customer in the email.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescheduleDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                setRescheduleTriedSubmit(true);
                if (!rescheduleDateError) void handleSendReschedule();
              }}
            >
              <SendIcon className="h-4 w-4 mr-1" />
              {isSubmitting ? 'Sending...' : 'Send to customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
