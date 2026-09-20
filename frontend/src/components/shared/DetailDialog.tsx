import type { ReactNode } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface DetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Main heading, e.g. "Request #3". */
  title: ReactNode;
  /** Small text under the title, e.g. a date. */
  subtitle?: ReactNode;
  /** Rendered at the top-right of the header (typically a StatusBadge). */
  headerRight?: ReactNode;
  /** Optional identity row (avatar + name + secondary line). */
  identity?: {
    name: string;
    secondary?: ReactNode;
  };
  /**
   * Optional action buttons (e.g. Edit / Delete) shown in the footer, left of
   * the Close button. When omitted, only a Close button is rendered.
   */
  actions?: ReactNode;
  children: ReactNode;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * A consistent, read-only details modal used across admin tables.
 * Renders a header band (title/subtitle/badge + optional identity) and a body.
 */
export function DetailDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  headerRight,
  identity,
  actions,
  children,
}: DetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-muted/40 px-5 pt-5 pb-4 border-b">
          <div className="flex items-center justify-between gap-3">
            <DialogHeader className="space-y-0">
              <DialogTitle className="flex items-center gap-2 text-base">{title}</DialogTitle>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </DialogHeader>
            {headerRight}
          </div>

          {identity && (
            <div className="mt-4 flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials(identity.name || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">{identity.name}</p>
                {identity.secondary && (
                  <p className="text-sm text-muted-foreground truncate">{identity.secondary}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">{children}</div>

        {actions ? (
          <DialogFooter className="flex-row items-center justify-between gap-2 px-5 pb-5 pt-0 border-0 bg-transparent m-0 sm:justify-between">
            <div className="flex items-center gap-2">{actions}</div>
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          </DialogFooter>
        ) : (
          <DialogFooter showCloseButton className="px-5 pb-5 pt-0 border-0 bg-transparent m-0" />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A labeled field with an icon tile. Use inside a DetailDialog grid. */
export function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

/** A tinted, bordered block for longer free-text content (e.g. details/notes). */
export function DetailTextBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-sm whitespace-pre-wrap">{children}</div>
    </div>
  );
}
