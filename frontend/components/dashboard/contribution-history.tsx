'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  History,
  FileText,
  UserCheck,
  ClipboardCheck,
  ChevronDown,
  Loader2,
  Inbox,
  Calendar,
} from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/lib/use-async';
import { getMyContributions } from '@/services/dashboardService';
import type { ContributionEntry } from '@/types/dashboard';

// ── Type Config ──────────────────────────────────

const TYPE_CONFIG: Record<
  ContributionEntry['type'],
  { label: string; icon: React.ElementType; dotClass: string; bgClass: string }
> = {
  DECLARATION: {
    label: 'Déclaration',
    icon: FileText,
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  },
  CLAIM: {
    label: 'Prise en charge',
    icon: UserCheck,
    dotClass: 'bg-blue-500',
    bgClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  },
  EVALUATION: {
    label: 'Évaluation',
    icon: ClipboardCheck,
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  },
};

const EVALUATION_OUTCOME_LABELS: Record<string, string> = {
  RESOLVED: 'Résolu',
  NON_RESOLVED: 'Non résolu',
};

// ── Period Filter ────────────────────────────────

type PeriodKey = '7d' | '30d' | 'year' | 'all';

interface PeriodOption {
  key: PeriodKey;
  label: string;
  getRange: () => { startDate: string; endDate: string };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  {
    key: '7d',
    label: '7 jours',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { startDate: fmtDate(start), endDate: fmtDate(end) };
    },
  },
  {
    key: '30d',
    label: '30 jours',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { startDate: fmtDate(start), endDate: fmtDate(end) };
    },
  },
  {
    key: 'year',
    label: 'Cette année',
    getRange: () => {
      const now = new Date();
      return {
        startDate: `${now.getFullYear()}-01-01`,
        endDate: fmtDate(now),
      };
    },
  },
  {
    key: 'all',
    label: 'Tout',
    getRange: () => ({ startDate: '', endDate: '' }),
  },
];

// ── Date Formatting ──────────────────────────────

function formatTimestampFR(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('fr-FR', { month: 'short' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capWeekday}. ${day} ${month} — ${time}`;
}

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ── Grouping ─────────────────────────────────────

interface MonthGroup {
  key: string;
  label: string;
  entries: ContributionEntry[];
}

function groupByMonth(entries: ContributionEntry[]): MonthGroup[] {
  const map = new Map<string, ContributionEntry[]>();
  for (const entry of entries) {
    const key = getMonthKey(entry.timestamp);
    const list = map.get(key);
    if (list) {
      list.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }
  const groups: MonthGroup[] = [];
  map.forEach((list, key) => {
    groups.push({ key, label: getMonthLabel(list[0].timestamp), entries: list });
  });
  groups.sort((a, b) => b.key.localeCompare(a.key));
  return groups;
}

// ── Entry Row ────────────────────────────────────

function ContributionRow({ entry }: { entry: ContributionEntry }) {
  const config = TYPE_CONFIG[entry.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      {/* Type dot */}
      <div className="mt-1 flex shrink-0 items-center justify-center">
        <div className={cn('h-2.5 w-2.5 rounded-full', config.dotClass)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              config.bgClass,
            )}
          >
            <Icon className="h-3 w-3" />
            {config.label}
          </span>
          {entry.type === 'EVALUATION' && entry.evaluationOutcome && (
            <span
              className={cn(
                'text-[10px] font-medium',
                entry.evaluationOutcome === 'RESOLVED'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {EVALUATION_OUTCOME_LABELS[entry.evaluationOutcome] ?? entry.evaluationOutcome}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{entry.category}</span>
        </div>

        {/* Incident reference + description */}
        <Link
          href={`/admin/incidents/${entry.incidentId}`}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
        >
          <span className="font-mono text-xs">{entry.incidentReference}</span>
          {entry.incidentDescription && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px] hidden sm:inline">
              — {entry.incidentDescription}
            </span>
          )}
        </Link>
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
        {formatTimestampFR(entry.timestamp)}
      </span>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────

const PAGE_SIZE = 50;

export function ContributionHistory() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [typeFilter, setTypeFilter] = useState<Set<ContributionEntry['type']>>(new Set());
  const [page, setPage] = useState(0);
  const [allEntries, setAllEntries] = useState<ContributionEntry[]>([]);
  const [totalElements, setTotalElements] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const periodOption = PERIOD_OPTIONS.find((p) => p.key === period)!;
  const { startDate, endDate } = periodOption.getRange();

  // useAsync re-fetches automatically when deps change (period change)
  const { data: firstPage, loading, error, refetch } = useAsync(
    () => getMyContributions({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 0,
      size: PAGE_SIZE,
    }),
    [startDate, endDate],
  );

  // When firstPage changes (new fetch from period change or refetch), update state
  const prevFirstPageRef = useRef(firstPage ?? null);
  useEffect(() => {
    if (firstPage && firstPage !== prevFirstPageRef.current) {
      prevFirstPageRef.current = firstPage;
      setAllEntries(firstPage.content);
      setTotalElements(firstPage.totalElements);
    }
  }, [firstPage]);

  const hasMore = totalElements != null && allEntries.length < totalElements;

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPageData = await getMyContributions({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: page + 1,
        size: PAGE_SIZE,
      });
      setAllEntries((prev) => [...prev, ...nextPageData.content]);
      setTotalElements(nextPageData.totalElements);
      setPage((p) => p + 1);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, startDate, endDate, page]);

  // Reset state when period changes
  const prevPeriodRef = useRef(period);
  useEffect(() => {
    if (prevPeriodRef.current !== period) {
      prevPeriodRef.current = period;
      setAllEntries([]);
      setTotalElements(null);
      setPage(0);
      prevFirstPageRef.current = null;
    }
  }, [period]);

  // Client-side type filter
  const filteredEntries = useMemo(() => {
    if (typeFilter.size === 0) return allEntries;
    return allEntries.filter((e) => typeFilter.has(e.type));
  }, [allEntries, typeFilter]);

  const monthGroups = useMemo(() => groupByMonth(filteredEntries), [filteredEntries]);

  const totalCount = filteredEntries.length;

  const toggleType = (type: ContributionEntry['type']) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card>
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-muted-foreground" />
              Historique des contributions
            </CardTitle>
            {totalElements != null && (
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{totalCount}</span>{' '}
                contribution{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {/* Filters */}
          <div className="px-4 pb-3 space-y-2">
            {/* Period filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPeriod(opt.key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    period === opt.key
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ['DECLARATION', 'Déclaration'],
                  ['CLAIM', 'Prise en charge'],
                  ['EVALUATION', 'Évaluation'],
                ] as const
              ).map(([type, label]) => {
                const cfg = TYPE_CONFIG[type];
                const active = typeFilter.size === 0 || typeFilter.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all border',
                      active
                        ? `${cfg.bgClass} border-current/20`
                        : 'text-muted-foreground border-transparent hover:bg-muted',
                    )}
                  >
                    <div className={cn('h-2 w-2 rounded-full', cfg.dotClass)} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          {loading && allEntries.length === 0 ? (
            <HistorySkeleton />
          ) : error ? (
            <div className="px-4 pb-4">
              <ErrorState message={error} compact onRetry={refetch} />
            </div>
          ) : monthGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center h-[200px]">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                Aucune contribution sur cette période
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Vos déclarations, prises en charge et évaluations apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border h-[200px] overflow-y-auto">
              {monthGroups.map((group) => (
                <div key={group.key}>
                  {/* Month header */}
                  <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm px-4 py-2 border-b border-border/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                      <span className="ml-1.5 font-normal">
                        · {group.entries.length} contribution{group.entries.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>

                  {/* Entries */}
                  {group.entries.map((entry, idx) => (
                    <ContributionRow key={`${entry.incidentId}-${entry.type}-${idx}`} entry={entry} />
                  ))}
                </div>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex flex-col items-center gap-2 px-4 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="gap-1.5 text-xs"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    Voir plus
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
