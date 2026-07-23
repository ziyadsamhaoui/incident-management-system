import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names, resolving conflicts via tailwind-merge.
 * Wraps clsx for conditional class composition.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a timestamp string into a localized date/time display.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a human-readable label for an incident status enum value.
 */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    DECLARED: 'Declared',
    CLAIMED: 'Claimed',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
    NON_RESOLVED: 'Not Resolved',
    CLOSED: 'Closed',
  };
  return labels[status] ?? status;
}

/**
 * Returns a human-readable label for a priority enum value.
 */
export function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
  };
  return labels[priority] ?? priority;
}
