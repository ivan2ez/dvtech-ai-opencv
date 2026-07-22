import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * All possible statuses for service requests and technician schedules.
 */
export type Status =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'accepted'
  | 'in-progress'
  | 'completed';

interface StatusConfig {
  label: string;
  className: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * Color mapping for each status:
 * - pending → yellow/amber (warning)
 * - approved → blue (info)
 * - rejected → red (destructive)
 * - assigned → purple/violet
 * - accepted → green/success light
 * - in-progress → blue (default)
 * - completed → green (success)
 */
const STATUS_CONFIG: Record<Status, StatusConfig> = {
  pending: {
    label: 'Pending',
    className:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    variant: 'outline',
  },
  approved: {
    label: 'Approved',
    className:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    variant: 'outline',
  },
  rejected: {
    label: 'Rejected',
    className:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    variant: 'destructive',
  },
  assigned: {
    label: 'Assigned',
    className:
      'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    variant: 'outline',
  },
  accepted: {
    label: 'Accepted',
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    variant: 'outline',
  },
  'in-progress': {
    label: 'In Progress',
    className:
      'bg-blue-500 text-white border-blue-600 dark:bg-blue-600 dark:text-white dark:border-blue-700',
    variant: 'default',
  },
  completed: {
    label: 'Completed',
    className:
      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    variant: 'outline',
  },
};

export interface StatusBadgeProps {
  /** The status value to display */
  status: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Capitalizes a status string for display.
 * Converts kebab-case to Title Case (e.g., "in-progress" → "In Progress").
 */
function formatStatusLabel(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * A reusable component that displays a status with appropriate color-coded styling.
 * Supports service request statuses and technician schedule statuses.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as Status;
  const config = STATUS_CONFIG[normalizedStatus];

  if (!config) {
    // Fallback for unknown statuses
    return (
      <Badge variant="secondary" className={className}>
        {formatStatusLabel(status)}
      </Badge>
    );
  }

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </Badge>
  );
}

export default StatusBadge;
