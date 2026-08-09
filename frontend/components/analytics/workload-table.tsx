'use client';

import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useTranslation } from '@/lib/i18n';
import { formatHours } from '@/lib/report';
import type { WorkloadEntry } from '@/types/analytics';

interface WorkloadTableProps {
  entries: WorkloadEntry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * Section 7 — Team workload visibility (ADMIN only, enforced server-side).
 *
 * Framing constraint: strictly aggregate team-health / workload-balancing
 * metrics. No leaderboards, no ranks, no gamified callouts — the table is
 * ordered by last name (neutral) and every cell is a plain aggregate.
 */
export function WorkloadTable({ entries, loading, error, onRetry }: WorkloadTableProps) {
  const { t } = useTranslation();

  return (
    <Card className="h-full">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t.analyticsWorkloadTitle}
          <Badge variant="outline" className="ml-1 border-slate-300 px-1.5 py-0 text-[9px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
            ADMIN
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t.analyticsWorkloadDesc}</p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton rows={4} columns={6} />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} compact onRetry={onRetry} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5">{t.analyticsWorkloadMember}</th>
                  <th className="px-4 py-2.5 text-right">{t.analyticsWorkloadClaims}</th>
                  <th className="px-4 py-2.5 text-right">{t.analyticsWorkloadResolved}</th>
                  <th className="px-4 py-2.5 text-right">{t.analyticsWorkloadNonResolved}</th>
                  <th className="px-4 py-2.5 text-right">{t.analyticsWorkloadEvaluated}</th>
                  <th className="px-4 py-2.5 text-right">{t.analyticsWorkloadAvg}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((w) => (
                  <tr key={w.userId ?? `${w.firstName}${w.lastName}`} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      {w.firstName} {w.lastName}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{w.claimedCount}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{w.resolvedCount}</td>
                    <td className="px-4 py-3 text-right text-red-500 dark:text-red-400">{w.nonResolvedCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{w.evaluatedCount}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatHours(w.avgResolutionHours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t.analyticsEmpty}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
