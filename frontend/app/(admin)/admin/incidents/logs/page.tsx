'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import { ArrowLeft } from 'lucide-react';
import { getIncidents } from '@/services/incidentService';
import { getCategories, getDepartments } from '@/services/referenceService';
import { useAsync } from '@/lib/use-async';
import { TerminalIncidentsView } from '@/components/incidents/terminal-incidents-view';
import { LogsFilterBar } from '@/components/incidents/logs-filter-bar';

// ── Constants ─────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critique' },
  { value: 'HIGH', label: 'Élevée' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'LOW', label: 'Faible' },
];

// ── Page ──────────────────────────────────────────

export default function AdminIncidentsLogsPage() {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Resolved incidents only — no implicit date window, so every resolved
  // incident shows up (dates are applied only when explicitly picked).
  const logsFetch = useAsync(
    () =>
      getIncidents({
        statuses: ['RESOLVED'],
        departmentId: departmentId || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        dateField: 'resolvedAt',
        sort: 'resolvedAt,desc',
        size: 200,
      }),
    [departmentId, dateFrom, dateTo],
  );
  const deptsFetch = useAsync(() => getDepartments(), []);
  const catsFetch = useAsync(() => getCategories(), []);

  const allLogs = logsFetch.data?.content ?? [];

  const filteredLogs = useMemo(() => {
    let result = [...allLogs];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.reference.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.resolutionNote ?? '').toLowerCase().includes(q) ||
        `${i.user?.firstName ?? ''} ${i.user?.lastName ?? ''}`.toLowerCase().includes(q),
      );
    }
    if (priorities.length > 0) {
      result = result.filter((i) => priorities.includes(i.priority));
    }
    if (categories.length > 0) {
      result = result.filter((i) => categories.includes(i.category));
    }
    // Always most-recently-resolved first.
    result.sort((a, b) => new Date(b.resolvedAt ?? 0).getTime() - new Date(a.resolvedAt ?? 0).getTime());
    return result;
  }, [allLogs, search, priorities, categories]);

  const hasActiveFilters =
    search.trim() !== '' ||
    departmentId !== '' ||
    categories.length > 0 ||
    priorities.length > 0 ||
    dateFrom !== '' ||
    dateTo !== '';

  // System-zero only when no filters are active — otherwise show the
  // "no results for these filters" state instead of "no archived incidents".
  const systemZero = !logsFetch.loading && !hasActiveFilters && (logsFetch.data?.totalElements ?? 0) === 0;

  const resetFilters = () => {
    setSearch('');
    setDepartmentId('');
    setCategories([]);
    setPriorities([]);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const departmentOptions = (deptsFetch.data ?? []).map((d) => ({ value: String(d.id), label: d.name }));
  const categoryOptions = (catsFetch.data ?? []).map((c) => ({ value: c.name, label: c.name }));

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Page Header ───────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              onClick={() => router.push('/admin/incidents')}
              className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Retour aux incidents
            </button>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Archives</h1>
            <p className="mt-1 text-sm text-muted-foreground">Incidents résolus, historique archivé</p>
          </div>
        </div>

        {/* ── Logs filter bar ───────────────────────── */}
        <LogsFilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          categoryOptions={categoryOptions}
          selectedCategories={categories}
          onCategoriesChange={(v) => { setCategories(v); setPage(1); }}
          priorityOptions={PRIORITY_OPTIONS}
          selectedPriorities={priorities}
          onPrioritiesChange={(v) => { setPriorities(v); setPage(1); }}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRangeChange={(f, t) => { setDateFrom(f); setDateTo(t); setPage(1); }}
          departmentOptions={departmentOptions}
          departmentId={departmentId}
          onDepartmentChange={(id) => { setDepartmentId(id); setPage(1); }}
          onReset={resetFilters}
        />

        {/* ── Resolved incidents archive ────────────── */}
        <TerminalIncidentsView
          incidents={filteredLogs}
          loading={logsFetch.loading}
          error={logsFetch.error}
          onRetry={logsFetch.refetch}
          isAdmin
          hasActiveFilters={hasActiveFilters}
          systemZero={systemZero}
          onResetFilters={resetFilters}
          onNavigate={(id) => { startNavigation(); router.push(`/admin/incidents/${id}`); }}
          page={page}
          pageSize={10}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
