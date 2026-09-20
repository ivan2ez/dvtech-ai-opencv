import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCwIcon,
  SearchIcon,
  BoxIcon,
  CalendarClockIcon,
  FileTextIcon,
  HashIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  listMyQuotations,
  getMyQuotation,
  type Quotation,
} from '@/services/quotationApi';
import {
  QUOTATION_STATUS_VALUES,
  type QuotationStatus,
} from '@/constants/quotationStatus';

/** Turns a kebab-case status into a Title Case label (e.g. "under-review" → "Under Review"). */
function formatStatusLabel(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Quotation identifier shown to the customer (e.g. "QUO-000012"). */
function formatQuotationReference(id: number): string {
  return `QUO-${String(id).padStart(6, '0')}`;
}

function matchesQuotationReference(id: number, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  const ref = formatQuotationReference(id).toLowerCase();
  return ref.includes(q) || String(id).includes(q);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatUnit(quotation: Pick<Quotation, 'brand' | 'model'>): string {
  return [quotation.brand, quotation.model]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join(' ') || '—';
}

const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | QuotationStatus; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  ...QUOTATION_STATUS_VALUES.map((value) => ({
    value,
    label: formatStatusLabel(value),
  })),
];

/**
 * My Quotations — the customer's list of their own quotation requests
 * (C4, Req 4). Rows show the quotation identifier, unit brand + model,
 * submitted date, status, and a details action; ordered most-recent-first by
 * the server. Provides text search + status filter with an empty state. A
 * quotation stays visible here at Assigned/Paid, preserving the separate My
 * Requests behaviour (Req 4.9).
 */
export function MyQuotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuotationStatus>('all');

  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const fetchQuotations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listMyQuotations();
      setQuotations(data);
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
      setError('Failed to load your quotations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQuotations();
  }, [fetchQuotations]);

  /**
   * Opens the details dialog. Refreshes the row from the detail endpoint so the
   * dialog reflects the latest owned data (Req 4.3), falling back to the list
   * row if that call fails.
   */
  async function handleViewDetails(quotation: Quotation) {
    setSelectedQuotation(quotation);
    setDetailDialogOpen(true);
    try {
      const fresh = await getMyQuotation(quotation.id);
      setSelectedQuotation(fresh);
    } catch (err) {
      console.error('Failed to load quotation details:', err);
    }
  }

  // Client-side search (by identifier or brand/model) + status filter.
  const query = searchQuery.trim().toLowerCase();
  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      query.length === 0 ||
      matchesQuotationReference(q.id, searchQuery) ||
      formatUnit(q).toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Quotations</h1>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quotation ID or unit..."
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
            className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | QuotationStatus)}
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
            <Button variant="outline" onClick={() => void fetchQuotations()}>
              <RefreshCwIcon className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading && !error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading quotations...</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {filteredQuotations.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              {quotations.length === 0 ? (
                <p className="text-muted-foreground">
                  You have no quotation requests yet.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  No quotations match your search or filter.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation ID</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Submitted Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotations.map((quotation) => (
                      <TableRow
                        key={quotation.id}
                        className="cursor-pointer"
                        onClick={() => void handleViewDetails(quotation)}
                      >
                        <TableCell className="font-medium">
                          {formatQuotationReference(quotation.id)}
                        </TableCell>
                        <TableCell>{formatUnit(quotation)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(quotation.submittedAt)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={quotation.status} />
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleViewDetails(quotation)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {filteredQuotations.map((quotation) => (
                  <div
                    key={quotation.id}
                    className="rounded-lg border p-4 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => void handleViewDetails(quotation)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for quotation ${formatQuotationReference(quotation.id)}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleViewDetails(quotation);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {formatQuotationReference(quotation.id)}
                      </span>
                      <StatusBadge status={quotation.status} />
                    </div>
                    <p className="text-sm font-medium">{formatUnit(quotation)}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(quotation.submittedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={
          selectedQuotation ? `Quotation ${formatQuotationReference(selectedQuotation.id)}` : ''
        }
        subtitle={
          selectedQuotation ? `Submitted ${formatDate(selectedQuotation.submittedAt)}` : undefined
        }
        headerRight={
          selectedQuotation ? <StatusBadge status={selectedQuotation.status} /> : undefined
        }
      >
        {selectedQuotation && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem
                icon={HashIcon}
                label="Quotation ID"
                value={formatQuotationReference(selectedQuotation.id)}
              />
              <DetailItem
                icon={BoxIcon}
                label="Unit"
                value={formatUnit(selectedQuotation)}
              />
              <DetailItem
                icon={CalendarClockIcon}
                label="Submitted"
                value={formatDate(selectedQuotation.submittedAt)}
              />
              <DetailItem
                icon={FileTextIcon}
                label="Status"
                value={formatStatusLabel(selectedQuotation.status)}
              />
            </div>

            <DetailTextBlock icon={FileTextIcon} label="Details">
              {selectedQuotation.details || '—'}
            </DetailTextBlock>
          </>
        )}
      </DetailDialog>
    </div>
  );
}

export default MyQuotations;
