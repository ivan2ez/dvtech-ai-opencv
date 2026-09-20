import { useCallback, useEffect, useState } from 'react';
import { MailIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CODE_LENGTH = 6;

export interface GmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Partially hidden address shown in the copy (e.g. "ju•••@gmail.com"). */
  maskedGmail: string;
  expiresInMinutes: number;
  /** Seconds to wait before "Resend" becomes available again. */
  resendCooldownSeconds: number;
  /**
   * Submits the entered code. Reject with an Error to show its message inline
   * and keep the dialog open; resolve to signal success.
   */
  onVerify: (code: string) => Promise<void>;
  /** Requests a new code. Reject with an Error to show its message inline. */
  onResend: () => Promise<void>;
  /** Shown as a warning, e.g. when server-side email delivery is not set up. */
  deliveryWarning?: string | null;
  title?: string;
  submitLabel?: string;
}

/**
 * Gmail ownership check: collects the 6-digit code the backend emailed and
 * hands it to `onVerify`. Used by both account creation and profile Gmail
 * changes, since neither is allowed to complete without verification.
 */
export function GmailVerificationDialog({
  open,
  onOpenChange,
  maskedGmail,
  expiresInMinutes,
  resendCooldownSeconds,
  onVerify,
  onResend,
  deliveryWarning,
  title = 'Verify your email',
  submitLabel = 'Verify Account',
}: GmailVerificationDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(resendCooldownSeconds);

  // Reset everything each time the dialog is opened so a previous attempt's
  // digits or error never carry over.
  useEffect(() => {
    if (open) {
      setCode('');
      setError(null);
      setIsVerifying(false);
      setIsResending(false);
      setSecondsLeft(resendCooldownSeconds);
    }
  }, [open, resendCooldownSeconds]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (!open || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, secondsLeft]);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || isVerifying) return;

      setIsVerifying(true);
      setError(null);
      try {
        await onVerify(value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
        setCode('');
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, onVerify]
  );

  async function handleResend() {
    setIsResending(true);
    setError(null);
    try {
      await onResend();
      setCode('');
      setSecondsLeft(resendCooldownSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    } finally {
      setIsResending(false);
    }
  }

  const canResend = secondsLeft <= 0 && !isResending && !isVerifying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <MailIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>
            We sent a {CODE_LENGTH}-digit code to{' '}
            <span className="font-medium text-foreground">{maskedGmail}</span>
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(code);
          }}
        >
          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (error) setError(null);
            }}
            onComplete={(next) => void submit(next)}
            length={CODE_LENGTH}
            disabled={isVerifying}
            invalid={Boolean(error)}
            autoFocus
            aria-describedby={error ? 'gmail-otp-error' : 'gmail-otp-hint'}
          />

          {error && (
            <p
              id="gmail-otp-error"
              role="alert"
              className="text-center text-sm font-medium text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={code.length !== CODE_LENGTH || isVerifying}
          >
            {isVerifying ? 'Verifying...' : submitLabel}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Didn't get the code?{' '}
            {canResend ? (
              <button
                type="button"
                onClick={() => void handleResend()}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Resend
              </button>
            ) : (
              <span aria-live="polite">
                {isResending ? 'Sending...' : `Resend in ${secondsLeft}s`}
              </span>
            )}
          </p>

          <p
            id="gmail-otp-hint"
            className="rounded-md bg-muted/60 p-2.5 text-center text-xs text-muted-foreground"
          >
            Check your Gmail inbox and Spam folder for the verification code. It expires in{' '}
            {expiresInMinutes} minutes.
          </p>

          {deliveryWarning && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-center text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {deliveryWarning}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
