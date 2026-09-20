import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the open state changes (e.g. backdrop click, close button, cancel). */
  onOpenChange: (open: boolean) => void;
  /** Dialog heading. */
  title: string;
  /** Supporting text explaining the consequence of the action. */
  description?: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Visual treatment of the confirm button. Use "destructive" for delete/reject. */
  variant?: 'default' | 'destructive';
  /** Invoked when the user confirms. May be async. */
  onConfirm: () => void | Promise<void>;
  /** Disables the buttons and shows a pending label while the action runs. */
  isLoading?: boolean;
}

/**
 * A reusable confirmation dialog for destructive or irreversible actions.
 * Renders an "Are you sure?" prompt with a cancel and a confirm button.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={() => void onConfirm()}
            disabled={isLoading}
          >
            {isLoading ? 'Please wait…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
