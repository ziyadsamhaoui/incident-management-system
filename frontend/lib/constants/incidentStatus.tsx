// ── Centralized Incident Status Label Map ─────────
// Shared across SOUS_CHEF, CHEF_ATELIER, ADMIN views
// to enforce consistent user-facing terminology.
//
// Dot + Text: Linear/Vercel-inspired low-noise indicator.

export type IncidentState =
  | 'DECLARED'
  | 'CLAIMED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'NON_RESOLVED'
  | 'CLOSED';

export interface StatusConfig {
  labelFr: string;
  labelEn: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  /** CSS class for the 6px status dot */
  dotClass: string;
  /** CSS class for the status text label */
  textClass: string;
  /** CSS class for the 4px left-edge status accent border */
  barClass: string;
  /** Hex color for the left-edge status bar (used via inline style to bypass JIT purging) */
  barColor: string;
  /** Legacy full badge className (kept for backward compat / badge component) */
  className: string;
}

export const INCIDENT_STATUS_MAP: Record<IncidentState, StatusConfig> = {
  DECLARED: {
    labelFr: 'Déclaré',
    labelEn: 'Declared',
    variant: 'outline',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-600 dark:text-slate-400',
    barClass: 'border-l-slate-500',
    barColor: '#334155',
    className:
      'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200',
  },
  CLAIMED: {
    labelFr: 'Pris en charge',
    labelEn: 'Claimed',
    variant: 'secondary',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700 dark:text-blue-400',
    barClass: 'border-l-blue-500',
    barColor: '#3b82f6',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  },
  IN_PROGRESS: {
    labelFr: 'En cours',
    labelEn: 'In Progress',
    variant: 'warning',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    barClass: 'border-l-amber-500',
    barColor: '#f59e0b',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  },
  RESOLVED: {
    labelFr: 'Résolu',
    labelEn: 'Resolved',
    variant: 'success',
    dotClass: 'bg-green-500',
    textClass: 'text-green-700 dark:text-green-400',
    barClass: 'border-l-emerald-500',
    barColor: '#10b981',
    className:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
  },
  NON_RESOLVED: {
    labelFr: 'Non résolu',
    labelEn: 'Not Resolved',
    variant: 'destructive',
    dotClass: 'bg-red-500',
    textClass: 'text-red-700 dark:text-red-400',
    barClass: 'border-l-red-500',
    barColor: '#ef4444',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  },
  CLOSED: {
    labelFr: 'Clôturé',
    labelEn: 'Closed',
    variant: 'default',
    dotClass: 'bg-slate-800 dark:bg-slate-200',
    textClass: 'text-slate-900 dark:text-slate-100',
    barClass: 'border-l-slate-900 dark:border-l-slate-200',
    barColor: '#0f172a',
    className:
      'bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900',
  },
};

/**
 * Resolve a status config by key, falling back to DECLARED on unknown values.
 */
export function getStatusConfig(status: string): StatusConfig {
  return INCIDENT_STATUS_MAP[status as IncidentState] ?? INCIDENT_STATUS_MAP.DECLARED;
}

// ── Status Dot + Text Component ───────────────────

import { cn } from '@/lib/utils';

export function StatusDotLabel({ status }: { status: string }) {
  const config = getStatusConfig(status);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          config.dotClass,
        )}
      />
      <span className={cn('text-sm font-medium', config.textClass)}>
        {config.labelFr}
      </span>
    </span>
  );
}
