'use client';

import { Download, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { isoDate } from '@/lib/csv';
import { downloadCsv, downloadExcel, downloadPdf } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { IncidentDTO } from '@/types/incident';

type T = ReturnType<typeof useTranslation>['t'];

interface TerminalIncidentsViewProps {
  /** Resolved incidents after ALL client-side filters (search / dates / priority / dept / category). */
  incidents: IncidentDTO[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Show the Department column (ADMIN only). */
  isAdmin: boolean;
  /** True when any client filter (search / dates / priority / dept / category) is active. */
  hasActiveFilters: boolean;
  /** True when the server returned zero resolved incidents at all. */
  systemZero: boolean;
  onResetFilters: () => void;
  onNavigate: (id: number) => void;
  /** 1-based current page (client-side pagination over the filtered set). */
  page?: number;
  /** Rows per page. */
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

// ── Helpers ───────────────────────────────────────

function relativeTime(iso: string, t: T): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t.logsJustNow;
  if (min < 60) return t.logsMinutesAgo.replace('{n}', String(min));
  const hours = Math.floor(min / 60);
  if (hours < 24) return t.logsHoursAgo.replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  if (days === 1) return t.logsYesterday;
  return t.logsDaysAgo.replace('{n}', String(days));
}

function resolvedByName(inc: IncidentDTO): string {
  const by = inc.resolvedBy;
  return by ? `${by.firstName} ${by.lastName}` : '—';
}

// ── Desktop table ─────────────────────────────────

function LogsTable({
  incidents,
  isAdmin,
  onNavigate,
}: {
  incidents: IncidentDTO[];
  isAdmin: boolean;
  onNavigate: (id: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden lg:block">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <th className="px-5 py-4 w-8" />
                  <th className="px-5 py-4">{t.logsColReference}</th>
                  <th className="px-5 py-4">{t.logsColCategory}</th>
                  {isAdmin && <th className="px-5 py-4">{t.logsColDepartment}</th>}
                  <th className="px-5 py-4">{t.logsColOutcome}</th>
                  <th className="px-5 py-4">{t.logsColResolvedBy}</th>
                  <th className="px-5 py-4">{t.logsColResolvedDate}</th>
                  <th className="px-5 py-4">{t.logsColNote}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => onNavigate(inc.id)}
                    className="cursor-pointer transition-colors hover:bg-muted/30 group"
                  >
                    <td className="px-5 py-4" style={{ boxShadow: 'inset 4px 0 0 0 #10b981' }} />
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-semibold text-blue-600 group-hover:underline dark:text-blue-400">
                        {inc.reference}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground/80">
                      {inc.category}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-sm text-muted-foreground">{inc.department}</td>
                    )}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {t.logsResolved}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{resolvedByName(inc)}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {inc.resolvedAt ? relativeTime(inc.resolvedAt, t) : '—'}
                    </td>
                    <td className="max-w-[260px] px-5 py-4">
                      <p className="truncate text-sm text-muted-foreground/80" title={inc.resolutionNote ?? ''}>
                        {inc.resolutionNote || '—'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Mobile cards (small & medium displays — table is lg+) ──

function LogsCards({
  incidents,
  onNavigate,
}: {
  incidents: IncidentDTO[];
  onNavigate: (id: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="lg:hidden space-y-3">
      {incidents.map((inc) => (
        <div
          key={inc.id}
          onClick={() => onNavigate(inc.id)}
          className="cursor-pointer rounded-xl border bg-card transition-colors hover:bg-muted/20"
          style={{ borderLeftWidth: '4px', borderLeftColor: '#10b981' }}
        >
          <div className="flex w-full items-center justify-between px-5 py-4">
            <div className="flex-1 min-w-0">
              {/* Line 1 — reference + category badge | relative resolved timestamp */}
              <div className="flex items-center gap-2.5 mb-2">
                <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {inc.reference}
                </span>
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {inc.category}
                </span>
              </div>
              {/* Line 2 — outcome badge + accountability subtitle */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t.logsResolved}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.logsResolvedBy.replace('{name}', resolvedByName(inc))}
                </span>
              </div>
              {/* Line 3 — resolution note excerpt */}
              <p className="truncate text-xs text-muted-foreground/80">
                {inc.resolutionNote || '—'}
              </p>
            </div>
            <div className="shrink-0 ml-3 text-right">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {inc.resolvedAt ? relativeTime(inc.resolvedAt, t) : '—'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────

function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {t.logsShowing.replace('{from}', String(from)).replace('{to}', String(to)).replace('{total}', String(total))}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-8 text-xs">
          {t.logsPrev}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t.logsPage.replace('{page}', String(page)).replace('{totalPages}', String(totalPages))}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-8 text-xs">
          {t.logsNext}
        </Button>
      </div>
    </div>
  );
}

export function TerminalIncidentsView({
  incidents,
  loading,
  error,
  onRetry,
  isAdmin,
  hasActiveFilters,
  systemZero,
  onResetFilters,
  onNavigate,
  page = 1,
  pageSize = 10,
  onPageChange,
}: TerminalIncidentsViewProps) {
  const { t } = useTranslation();

  const filteredEmpty = !systemZero && !loading && !error && incidents.length === 0 && hasActiveFilters;
  const totalPages = Math.max(1, Math.ceil(incidents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = incidents.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── Export (PDF / Excel / CSV) ──────────────────
  const buildExport = () => {
    const headers = [
      t.logsColReference,
      t.logsColCategory,
      ...(isAdmin ? [t.logsColDepartment] : []),
      t.logsColOutcome,
      t.logsColResolvedBy,
      t.logsColResolvedDate,
      t.logsColNote,
    ];
    const rows = incidents.map((inc) => [
      inc.reference,
      inc.category,
      ...(isAdmin ? [inc.department] : []),
      t.logsResolved,
      resolvedByName(inc),
      inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString('fr-FR') : '—',
      inc.resolutionNote ?? '',
    ]);
    return { headers, rows };
  };

  const handleExportCsv = () => {
    const { headers, rows } = buildExport();
    downloadCsv(`incidents-logs-${isoDate(new Date())}.csv`, headers, rows);
  };
  const handleExportExcel = () => {
    const { headers, rows } = buildExport();
    downloadExcel(`incidents-logs-${isoDate(new Date())}.xlsx`, headers, rows);
  };
  const handleExportPdf = () => {
    const { headers, rows } = buildExport();
    downloadPdf(`incidents-logs-${isoDate(new Date())}.pdf`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Export dropdown */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              disabled={incidents.length === 0}
              title={t.logsExport}
            >
              <Download className="h-3.5 w-3.5" />
              {t.logsExport}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleExportPdf} className="cursor-pointer text-sm">
              {t.logsExportPdf}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer text-sm">
              {t.logsExportExcel}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCsv} className="cursor-pointer text-sm">
              {t.logsExportCsv}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={6} columns={7} />
          </CardContent>
        </Card>
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : systemZero ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Filter}
              title={t.logsEmptyZeroTitle}
              description={t.logsEmptyZeroDesc}
            />
          </CardContent>
        </Card>
      ) : filteredEmpty ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Filter}
              title={t.logsEmptyFilteredTitle}
              description={t.logsEmptyFilteredDesc}
              actionLabel={t.logsResetFilters}
              onAction={onResetFilters}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <LogsTable incidents={paginated} isAdmin={isAdmin} onNavigate={onNavigate} />
          <LogsCards incidents={paginated} onNavigate={onNavigate} />
          {onPageChange && incidents.length > pageSize && (
            <Card>
              <CardContent className="p-0">
                <PaginationFooter page={safePage} pageSize={pageSize} total={incidents.length} onPageChange={onPageChange} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
