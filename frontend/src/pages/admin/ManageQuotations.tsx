import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCwIcon,
  SearchIcon,
  UserRoundIcon,
  BoxIcon,
  TagIcon,
  CalendarIcon,
  FileTextIcon,
  MailIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { toast } from 'sonner';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { DetailDialog, DetailItem, DetailTextBlock } from '@/components/shared/DetailDialog';
import { getApiErrorMessage } from '@/lib/utils';
import {
  listAllQuotations,
  updateQuotationStatus,
  type Quotation,
} from '@/services/quotationApi';
import {
  QUOTATION_STATUS_VALUES,
  type QuotationStatus,
} from '@/constants/quotationStatus';

/** Turns a placeholder status value (e.g. "under-review") into a label. */
function formatStatusLabel(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** A stable quotation identifier for display (e.g. "QT-000012"). */
function formatQuotationReference(id: number): string {
  return `QT-${String(id).padStart(6, '0')}`;
}

/** Human-readable submitted date. */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  ...QUOTATION_STATUS_VALUES.map((status) => ({
    value: status,
    label: formatStatusLabel(status),
  })),
];

/**
 * Manage Quotations admin page (A6 — Req 11.1, 11.2, 11.3, 11.4).
 *
 * Lists every customer's quotation request with its identifier, customer, unit,
 * submitted date, and status. The list arrives most-recent-first from the
 * server (Req 11.3); client-side text search and a status filter narrow it
 * (Req 11.4). Admin actions are placeholders pending INQUIRY.DOCX (Req 11.2, 5).
 */
export function ManageQuotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [detailQuotation, setDetailQuotation] = useState<Quotation | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  // Id of the quotation whose status change is in flight (drives the disabled
  // state on the details-dialog Select).
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const fetchQuotations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listAllQuotations();
      setQuotations(data);
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
      setError('Failed to load quotations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQuotations();
  }, [fetchQuotations]);

  // The server already returns the rows most-recent-first (Req 11.3), so the
  // list is only narrowed here — never reordered.
  const filteredQuotations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return quotations.filter((q) => {
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const haystack = [
        formatQuotationReference(q.id),
        q.brand,
        q.model,
        q.customer?.name ?? '',
        q.customer?.email ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [quotations, searchQuery, statusFilter]);

  function handleOpenDetails(quotation: Quotation) {
    setDetailQuotation(quotation);
    setDetailDialogOpen(true);
  }

  /**
   * Applies an admin status transition and reflects it in place (Req 11). The
   * updated row (with the same customer) comes back from the server, so we swap
   * it into the local list and the open dialog without a full refetch. At
   * 'paid' the server wires the quotation into scheduling (Req 11.5, 11.6).
   */
  async function handleChangeStatus(quotation: Quotation, nextStatus: QuotationStatus) {
    if (nextStatus === quotation.status) return;
    setUpdatingStatusId(quotation.id);
    try {
      const updated = await updateQuotationStatus(quotation.id, nextStatus);
      setQuotations((prev) => prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q)));
      setDetailQuotation((current) =>
        current && current.id === updated.id ? { ...current, ...updated } : current
      );
      toast.success(
        `Quotation ${formatQuotationReference(updated.id)} set to ${formatStatusLabel(nextStatus)}`
      );
    } catch (err) {
      console.error('Failed to update quotation status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update the quotation status.'));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Quotations</h1>
          <p className="text-sm text-muted-foreground">
            Review incoming quotation requests before they enter scheduling
          </p>
        </div>
        <Button variant="outline" onClick={() => void fetchQuotations()}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reference, customer, or unit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="quotation-status-filter"
            className="text-sm font-medium text-muted-foreground whitespace-nowrap"
          >
            Status:
          </label>
          <select
            id="quotation-status-filter"
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void fetchQuotations()}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading quotations...</p>
        </div>
      ) : (
        !error && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No quotations found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotations.map((quotation) => (
                      <TableRow
                        key={quotation.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenDetails(quotation)}
                      >
                        <TableCell className="font-medium">
                          {formatQuotationReference(quotation.id)}
                        </TableCell>
                        <TableCell>
                          {quotation.customer?.name ?? `User #${quotation.id}`}
                        </TableCell>
                        <TableCell>
                          {quotation.brand} {quotation.model}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(quotation.submittedAt)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={quotation.status} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {/* Placeholder admin actions — the concrete action set
                              (approve, quote, decline, ...) awaits INQUIRY.DOCX
                              (Req 11.2, 5). For now the admin can open details. */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetails(quotation)}
                            aria-label={`View quotation ${formatQuotationReference(quotation.id)}`}
                          >
                            <FileTextIcon data-icon="inline-start" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredQuotations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No quotations found.</p>
              ) : (
                filteredQuotations.map((quotation) => (
                  <Card
                    key={quotation.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleOpenDetails(quotation)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {formatQuotationReference(quotation.id)}
                        </span>
                        <StatusBadge status={quotation.status} />
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">Customer:</span>{' '}
                          {quotation.customer?.name ?? `User #${quotation.id}`}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Unit:</span>{' '}
                          {quotation.brand} {quotation.model}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Submitted:</span>{' '}
                          {formatDate(quotation.submittedAt)}
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleOpenDetails(quotation)}
                        >
                          <FileTextIcon className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Total count reflecting the active search / status filter. */}
            <p className="pt-4 text-sm text-muted-foreground">
              {filteredQuotations.length}{' '}
              {filteredQuotations.length === 1 ? 'quotation' : 'quotations'}
            </p>
          </>
        )
      )}

      {/* Quotation Details Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailQuotation ? formatQuotationReference(detailQuotation.id) : ''}
        subtitle={
          detailQuotation ? `Submitted ${formatDate(detailQuotation.submittedAt)}` : undefined
        }
        headerRight={
          detailQuotation ? <StatusBadge status={detailQuotation.status} /> : undefined
        }
        identity={
          detailQuotation?.customer
            ? {
                name: detailQuotation.customer.name,
                secondary: detailQuotation.customer.email,
              }
            : undefined
        }
      >
        {detailQuotation && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem
                icon={UserRoundIcon}
                label="Customer"
                value={detailQuotation.customer?.name ?? '—'}
              />
              <DetailItem
                icon={MailIcon}
                label="Email"
                value={detailQuotation.customer?.email ?? '—'}
              />
              <DetailItem icon={TagIcon} label="Brand" value={detailQuotation.brand} />
              <DetailItem icon={BoxIcon} label="Model" value={detailQuotation.model} />
              <DetailItem
                icon={CalendarIcon}
                label="Submitted"
                value={formatDate(detailQuotation.submittedAt)}
              />
            </div>

            {/* Status management — the admin advances the quotation through the
                placeholder vocabulary. At 'Paid' it enters scheduling (Req 11). */}
            <div className="space-y-1.5">
              <label htmlFor="quotation-status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="quotation-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                value={detailQuotation.status}
                disabled={updatingStatusId === detailQuotation.id}
                onChange={(e) =>
                  void handleChangeStatus(detailQuotation, e.target.value as QuotationStatus)
                }
              >
                {QUOTATION_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {updatingStatusId === detailQuotation.id
                  ? 'Updating status...'
                  : 'Setting the status to Paid moves this into Requests Awaiting Scheduling.'}
              </p>
            </div>

            {detailQuotation.details && (
              <DetailTextBlock icon={FileTextIcon} label="Request Details">
                {detailQuotation.details}
              </DetailTextBlock>
            )}
          </>
        )}
      </DetailDialog>
    </div>
  );
}
