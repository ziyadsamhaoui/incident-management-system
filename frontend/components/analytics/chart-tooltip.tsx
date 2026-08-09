'use client';

/** Shared tooltip + palette + formatting helpers for the /analytics charts. */

export const ANALYTICS_COLORS = {
  reported: '#3b82f6',
  resolved: '#10b981',
  nonResolved: '#ef4444',
  mttr: '#8b5cf6',
  timeToClaim: '#f59e0b',
  paretoBar: '#3b82f6',
  paretoLine: '#ef4444',
  grid: '#e2e8f0',
  text: '#64748b',
};

/** Recharts tooltip styled like the rest of the app. */
export function AnalyticsTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {label}
      </p>
      {payload.map((entry: any, idx: number) => (
        <p
          key={idx}
          className="text-xs text-slate-600 dark:text-slate-400"
          style={{ color: entry.color ?? entry.stroke }}
        >
          {entry.name}:{' '}
          <span className="font-semibold">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/** yyyy-MM-dd → dd/MM (chart axis labels). */
export function shortLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${d}/${m}`;
}

/** yyyy-MM-dd → dd/MM/yyyy (full display). */
export function fullDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
