import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import type { ServiceRequest } from '@/types';
import { getServiceRequests } from '@/services/serviceRequestApi';

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

export function MyRequests() {
  const navigate = useNavigate();
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

  function handleViewDetails(request: ServiceRequest) {
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Service Requests</h1>
        <Button onClick={() => navigate('/service-request')}>
          <PlusIcon className="h-4 w-4 mr-1" />
          New Request
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void fetchRequests(pagination.page)}>
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
          {requests.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">No service requests found.</p>
              <Button onClick={() => navigate('/service-request')}>
                Submit Your First Request
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Type</TableHead>
                      <TableHead>AC Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium capitalize">{request.serviceType}</TableCell>
                        <TableCell>{truncateText(request.acDetails, 50)}</TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell>{formatDate(request.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(request)}
                            aria-label={`View details for request #${request.id}`}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {requests.map((request) => (
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
                      <span className="font-medium capitalize">{request.serviceType}</span>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {truncateText(request.acDetails, 80)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.createdAt)}
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

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Service Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
                <span className="text-muted-foreground font-medium">Service Type</span>
                <span className="capitalize">{selectedRequest.serviceType}</span>

                <span className="text-muted-foreground font-medium">Status</span>
                <span>
                  <StatusBadge status={selectedRequest.status} />
                </span>

                <span className="text-muted-foreground font-medium">AC Details</span>
                <span>{selectedRequest.acDetails || '—'}</span>

                <span className="text-muted-foreground font-medium">Submitted</span>
                <span>{formatDate(selectedRequest.createdAt)}</span>

                <span className="text-muted-foreground font-medium">Last Updated</span>
                <span>{formatDate(selectedRequest.updatedAt)}</span>
              </div>
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
