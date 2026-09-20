import { useEffect, useRef, useState } from 'react';
import { UploadIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  COMPLETION_PHOTO_ACCEPT,
  validateCompletionPhoto,
} from '@/lib/completionPhoto';

const MIN_REPORT_LENGTH = 20;
const MAX_REPORT_LENGTH = 1000;

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number | null;
  isSubmitting: boolean;
  /** Resolves the completion. Receives the trimmed report and the chosen photo. */
  onSubmit: (report: string, photo: File) => void;
}

/**
 * Shared dialog for completing a task with BOTH a written report (min 20 chars)
 * and a required completion photo, matching the backend's multipart contract.
 * Used by the technician MyTasks/TaskDetail pages and the admin schedule view.
 */
export function CompleteTaskDialog({
  open,
  onOpenChange,
  taskId,
  isSubmitting,
  onSubmit,
}: CompleteTaskDialogProps) {
  const [report, setReport] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the form whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setReport('');
      setPhoto(null);
      setPreviewUrl(null);
      setTriedSubmit(false);
    }
  }, [open]);

  // Keep an object URL for the preview and revoke it when the photo changes.
  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const trimmedReport = report.trim();
  const reportError =
    report.length === 0
      ? ''
      : trimmedReport.length < MIN_REPORT_LENGTH
        ? `Report must be at least ${MIN_REPORT_LENGTH} characters.`
        : '';
  const photoError = photo ? validateCompletionPhoto(photo) : '';
  const isReportValid = trimmedReport.length >= MIN_REPORT_LENGTH;
  const isPhotoValid = !!photo && !validateCompletionPhoto(photo);
  const canSubmit = isReportValid && isPhotoValid && !isSubmitting;

  function handleSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
  }

  function handleRemovePhoto() {
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit() {
    setTriedSubmit(true);
    if (!canSubmit || !photo) return;
    onSubmit(trimmedReport, photo);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{taskId ? `Complete Task #${taskId}` : 'Complete Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Completion report */}
          <div className="space-y-2">
            <label htmlFor="completion-report" className="text-sm font-medium">
              Completion Report
            </label>
            <textarea
              id="completion-report"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Describe the work completed (min 20 characters)..."
              value={report}
              onChange={(e) => setReport(e.target.value)}
              maxLength={MAX_REPORT_LENGTH}
              aria-invalid={!!reportError}
            />
            {reportError ? (
              <p className="text-xs font-medium text-destructive">{reportError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {trimmedReport.length}/{MAX_REPORT_LENGTH} characters (minimum {MIN_REPORT_LENGTH})
              </p>
            )}
          </div>

          {/* Completion photo (required) */}
          <div className="space-y-2">
            <label htmlFor="completion-photo" className="text-sm font-medium">
              Completion Photo <span className="text-destructive">*</span>
            </label>
            <input
              ref={fileInputRef}
              id="completion-photo"
              type="file"
              accept={COMPLETION_PHOTO_ACCEPT}
              className="hidden"
              onChange={handleSelectFile}
            />

            {previewUrl ? (
              <div className="relative w-full overflow-hidden rounded-md border">
                <img
                  src={previewUrl}
                  alt="Completion preview"
                  className="max-h-48 w-full object-contain bg-muted"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={handleRemovePhoto}
                  disabled={isSubmitting}
                >
                  <XIcon className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-6 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
              >
                <UploadIcon className="h-5 w-5" />
                Click to upload a photo (JPG, PNG or WebP, max 10MB)
              </button>
            )}

            {photo && !photoError && (
              <p className="text-xs text-muted-foreground truncate">{photo.name}</p>
            )}
            {photoError && <p className="text-xs font-medium text-destructive">{photoError}</p>}
            {triedSubmit && !photo && (
              <p className="text-xs font-medium text-destructive">A completion photo is required.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
