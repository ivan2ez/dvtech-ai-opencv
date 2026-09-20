import { useEffect, useState } from 'react';
import { AlertTriangleIcon, ArrowRightIcon, CheckIcon, UserRoundIcon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ServiceRequest } from '@/types';
import { formatRequestReference, formatRequiredSchedule } from '@/utils/serviceRequest';

export interface RescheduleResponseDialogProps {
  request: ServiceRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Applies the decision. Reject with an Error to show its message inline and
   * keep the dialog open.
   */
  onRespond: (action: 'accept' | 'decline', notes?: string) => Promise<void>;
}

/** Whole hours left before the 48-hour window closes, floored at 0. */
function hoursRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / (60 * 60 * 1000)));
}

function formatDeadline(expiresAt: string | null): string {
  if (!expiresAt) return '—';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Lets a customer accept or decline the schedule the admin proposed.
 *
 * Accepting assigns the request; declining records optional notes explaining
 * why. Both are one-way, so the choice is presented explicitly rather than
 * inferred from closing the dialog.
 */
export function RescheduleResponseDialog({
  request,
  open,
  onOpenChange,
  onRespond,
}: RescheduleResponseDialogProps) {
  const [isDeclining, setIsDeclining] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset on each open so a previous attempt never leaks into the next one.
  useEffect(() => {
    if (open) {
      setIsDeclining(false);
      setNotes('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  if (!request) return null;

  const remaining = hoursRemaining(request.rescheduleExpiresAt);
  const currentTechnician = request.technicianSchedules?.find(
    (s) => s.status !== 'rejected' && s.technician
  )?.technician;

  async function submit(action: 'accept' | 'decline') {
    setIsSubmitting(true);
    setError(null);
    try {
      await onRespond(action, action === 'decline' ? notes.trim() || undefined : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Badge variant="outline" className="w-fit">
            {formatRequestReference(request.id)}
          </Badge>

          <p className="text-sm text-muted-foreground">
            No technician is available for your original schedule. Please review the new proposed
            schedule below.
          </p>

          {/* Original vs proposed */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 rounded-md border p-3">
            <div>
              <p className="text-xs text-muted-foreground">Original schedule</p>
              <p className="text-sm text-muted-foreground line-through">
                {formatRequiredSchedule(request.serviceRequiredDate, request.serviceRequiredTime)}
              </p>
              {currentTechnician && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <UserRoundIcon className="h-3 w-3" aria-hidden="true" />
                  {currentTechnician.name}
                </p>
              )}
            </div>
            <ArrowRightIcon
              className="mt-4 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">New schedule</p>
              <p className="text-sm font-semibold">
                {formatRequiredSchedule(request.proposedDate, request.proposedTime)}
              </p>
              {request.proposedTechnician && (
                <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <UserRoundIcon className="h-3 w-3" aria-hidden="true" />
                  {request.proposedTechnician.name}
                </p>
              )}
            </div>
          </div>

          {request.rescheduleReason && (
            <div>
              <p className="text-sm font-medium">Reason for reschedule</p>
              <p className="mt-1 rounded-md bg-muted/60 p-2.5 text-sm text-muted-foreground">
                {request.rescheduleReason}
              </p>
            </div>
          )}

          {/* Deadline */}
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Please respond by <strong>{formatDeadline(request.rescheduleExpiresAt)}</strong>
              {remaining !== null && (
                <> ({remaining} hour{remaining === 1 ? '' : 's'} left)</>
              )}
              . If you don't respond in time, this request will expire.
            </span>
          </div>

          {/* Optional decline notes, revealed only when declining */}
          {isDeclining && (
            <div className="space-y-2">
              <label htmlFor="decline-notes" className="text-sm font-medium">
                Notes (optional)
              </label>
              <textarea
                id="decline-notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Let us know why this schedule doesn't work for you."
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{notes.trim().length}/500</p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {isDeclining ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsDeclining(false)}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => void submit('decline')}
                disabled={isSubmitting}
              >
                <XIcon className="h-4 w-4 mr-1" />
                {isSubmitting ? 'Declining...' : 'Confirm Decline'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                onClick={() => setIsDeclining(true)}
                disabled={isSubmitting}
              >
                <XIcon className="h-4 w-4 mr-1" />
                Decline
              </Button>
              <Button
                variant="success"
                onClick={() => void submit('accept')}
                disabled={isSubmitting}
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                {isSubmitting ? 'Accepting...' : 'Accept new schedule'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
