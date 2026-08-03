'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  AlertTriangle,
  ChevronRight,
  Eye,
  ShieldAlert,
  Wrench,
  MessageSquare,
  Zap,
  Settings,
  SlidersHorizontal,
  Inbox,
  X,
  FileText,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getStatusConfig } from '@/lib/constants/incidentStatus';
import type { IncidentStatus, IncidentPriority } from '@/types/incident';
import type { IncidentDTO } from '@/types/incident';
import { getIncidents } from '@/services/incidentService';
import { getCategories, getDepartments } from '@/services/referenceService';
import { useAsync } from '@/lib/use-async';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { IncidentDetailDrawer } from '@/components/incidents/incident-detail-drawer';
import { WelcomeOverlay } from '@/components/auth/WelcomeOverlay';

//  Helpers

const PRIORITY_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée', CRITICAL: 'Critique' };
const PRIORITY_CLASSES: Record<string, string> = { LOW: 'text-slate-500 bg-slate-100 dark:bg-slate-800', MEDIUM: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', HIGH: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', CRITICAL: 'text-red-600 bg-red-50 dark:bg-red-900/20' };
const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const STATUS_OPTIONS = [
  { value: 'DECLARED', label: 'Déclaré' },
  { value: 'CLAIMED', label: 'Pris en charge' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'RESOLVED', label: 'Résolu' },
  { value: 'NON_RESOLVED', label: 'Non résolu' },
  { value: 'CLOSED', label: 'Clôturé' },
];

const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critique' },
  { value: 'HIGH', label: 'Élevée' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'LOW', label: 'Faible' },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Sécurité: ShieldAlert,
  Accident: Wrench,
  Réclamation: MessageSquare,
  Mécanique: Zap,
  Électrique: Settings,
};

function formatElapsed(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
}

function formatDuration(diffMs: number): string {
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
}

/**
 * Column "Temps". Resolved / closed incidents show a fixed processing
 * duration (declared → resolved) instead of a live timer that keeps running.
 */
function formatIncidentTime(inc: IncidentDTO): string {
  const endTime = inc.resolvedAt ?? inc.closedAt;
  if (endTime) {
    return formatDuration(new Date(endTime).getTime() - new Date(inc.declaredAt).getTime());
  }
  return formatElapsed(inc.claimedAt ?? inc.declaredAt);
}

//  Stat Card

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

//  Filters

interface Filters {
  search: string;
  statuses: IncidentStatus[];
  priorities: IncidentPriority[];
  departments: string[];
  categories: string[];
  dateFrom: string;
  dateTo: string;
  sort: 'newest' | 'oldest' | 'priority' | 'time-in-status';
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  statuses: [],
  priorities: [],
  departments: [],
  categories: [],
  dateFrom: '',
  dateTo: '',
  sort: 'newest',
};

//  Multi-Select Dropdown

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-medium transition-colors whitespace-nowrap',
          selected.length > 0
            ? 'border-primary text-primary'
            : 'border-input text-muted-foreground hover:border-muted-foreground/30',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border bg-popover p-1.5 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <div
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  selected.includes(opt.value)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30',
                )}
              >
                {selected.includes(opt.value) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

//  Chip-style multi-select (mobile filter dialog)

function FilterCheckGroup({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSel = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              isSel
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-input text-muted-foreground hover:border-muted-foreground/30',
            )}
          >
            {isSel && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

//  Active Filter Chips

function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: Filters;
  onRemove: (key: keyof Filters, value?: string) => void;
  onClearAll: () => void;
}) {
  const chips: { key: keyof Filters; value?: string; label: string }[] = [];

  if (filters.search) chips.push({ key: 'search', label: `Recherche: "${filters.search}"` });
  if (filters.dateFrom) chips.push({ key: 'dateFrom', label: `Depuis le ${filters.dateFrom}` });
  if (filters.dateTo) chips.push({ key: 'dateTo', label: `Jusqu'au ${filters.dateTo}` });
  filters.statuses.forEach((s) => chips.push({ key: 'statuses', value: s, label: getStatusConfig(s).labelFr }));
  filters.priorities.forEach((p) => chips.push({ key: 'priorities', value: p, label: PRIORITY_LABELS[p] }));
  filters.departments.forEach((d) => chips.push({ key: 'departments', value: d, label: d }));
  filters.categories.forEach((c) => chips.push({ key: 'categories', value: c, label: c }));

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.key, chip.value)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Effacer tout
      </button>
    </div>
  );
}

//  Page

export default function ChefAtelierIncidentsPage() {
  const router = useRouter();

  // Welcome overlay
  const [showWelcome, setShowWelcome] = useState(true);

  // Filters + list state
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  //  Real data
  const incidentsFetch = useAsync(() => getIncidents({ size: 200 }), []);
  const deptsFetch = useAsync(() => getDepartments(), []);
  const catsFetch = useAsync(() => getCategories(), []);

  const allIncidents = useMemo(() => incidentsFetch.data?.content ?? [], [incidentsFetch.data]);

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filteredIncidents = useMemo(() => {
    let result = [...allIncidents];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((i) =>
        i.reference.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        `${i.user?.firstName ?? ''} ${i.user?.lastName ?? ''}`.toLowerCase().includes(q) ||
        String(i.user?.matricule ?? '').includes(q),
      );
    }

    if (filters.statuses.length > 0) {
      result = result.filter((i) => filters.statuses.includes(i.status));
    }
    if (filters.priorities.length > 0) {
      result = result.filter((i) => filters.priorities.includes(i.priority));
    }
    if (filters.departments.length > 0) {
      result = result.filter((i) => filters.departments.includes(i.department));
    }
    if (filters.categories.length > 0) {
      result = result.filter((i) => filters.categories.includes(i.category));
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((i) => new Date(i.declaredAt).getTime() >= from.getTime());
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((i) => new Date(i.declaredAt).getTime() <= to.getTime());
    }

    switch (filters.sort) {
      case 'newest': result.sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.declaredAt).getTime() - new Date(b.declaredAt).getTime()); break;
      case 'priority': result.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)); break;
      case 'time-in-status': result.sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime()); break;
    }

    return result;
  }, [allIncidents, filters]);

  // Stats — system-wide, unaffected by filters
  const stats = {
    total: allIncidents.length,
    open: allIncidents.filter((i) => i.status === 'DECLARED').length,
    inProgress: allIncidents.filter((i) => i.status === 'IN_PROGRESS').length,
    closed: allIncidents.filter((i) => i.status === 'CLOSED').length,
  };

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE));
  const paginated = filteredIncidents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  //  Zero / empty states
  const systemZero = !incidentsFetch.loading && allIncidents.length === 0;
  const isFiltered = filters.search || filters.statuses.length > 0 || filters.priorities.length > 0 ||
    filters.departments.length > 0 || filters.categories.length > 0 ||
    filters.dateFrom || filters.dateTo;
  const filteredEmpty = !systemZero && filteredIncidents.length === 0 && isFiltered;

  const updateFilter = (key: keyof Filters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const removeFilter = (key: keyof Filters, value?: string) => {
    setFilters((prev) => {
      if (key === 'search' || key === 'dateFrom' || key === 'dateTo') {
        return { ...prev, [key]: '' };
      }
      if (Array.isArray(prev[key])) {
        return { ...prev, [key]: (prev[key] as string[]).filter((v) => v !== value) };
      }
      return prev;
    });
  };

  const clearAllFilters = () => setFilters(DEFAULT_FILTERS);

  const toggleFilterValue = (key: 'statuses' | 'priorities' | 'departments' | 'categories', value: string) => {
    setFilters((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const resetDialogFilters = () => {
    setFilters((prev) => ({
      ...prev,
      statuses: [],
      priorities: [],
      departments: [],
      categories: [],
      dateFrom: '',
      dateTo: '',
      sort: 'newest',
    }));
  };

  const activeFilterCount =
    filters.statuses.length +
    filters.priorities.length +
    filters.departments.length +
    filters.categories.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.sort !== 'newest' ? 1 : 0);

  const departmentOptions = (deptsFetch.data ?? []).map((d) => ({ value: d.name, label: d.name }));
  const categoryOptions = (catsFetch.data ?? []).map((c) => ({ value: c.name, label: c.name }));

  return (
    <>
      {/*  Welcome Overlay  */}
      <WelcomeOverlay
        isVisible={showWelcome}
        onDismiss={() => setShowWelcome(false)}
        autoDismissMs={2100}
      />

      <div className="mx-auto max-w-7xl space-y-6">
        {/*  Page Header  */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mes Incidents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consultez et gérez les incidents du système
            </p>
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => router.push('/sous-chef/incidents/declare')}
          >
            <Plus className="h-3.5 w-3.5" />
            Déclarer
          </Button>
        </div>

        {/*  Statistics Grid  */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Incidents" value={stats.total} icon={FileText} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Open Incidents" value={stats.open} icon={AlertTriangle} color="text-amber-600 dark:text-amber-400" />
          <StatCard label="In Progress" value={stats.inProgress} icon={Activity} color="text-violet-600 dark:text-violet-400" />
          <StatCard label="Closed Incidents" value={stats.closed} icon={CheckCircle2} color="text-emerald-600 dark:text-emerald-400" />
        </div>

        {/*  Multi-Filter Bar  */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search + mobile filter tab */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Rechercher par référence, nom ou description..."
                  className="h-10 w-full pl-9"
                />
              </div>
              {/* Mobile-only filter tab (opens the filter dialog) */}
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-muted sm:hidden"
                aria-label="Filtrer les incidents"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Desktop filters (hidden on mobile — replaced by the filter dialog) */}
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <MultiSelectDropdown
                label="Statut"
                options={STATUS_OPTIONS}
                selected={filters.statuses}
                onChange={(vals) => updateFilter('statuses', vals)}
              />
              <MultiSelectDropdown
                label="Priorité"
                options={PRIORITY_OPTIONS}
                selected={filters.priorities}
                onChange={(vals) => updateFilter('priorities', vals)}
              />
              <MultiSelectDropdown
                label="Département"
                options={departmentOptions}
                selected={filters.departments}
                onChange={(vals) => updateFilter('departments', vals)}
              />
              <MultiSelectDropdown
                label="Catégorie"
                options={categoryOptions}
                selected={filters.categories}
                onChange={(vals) => updateFilter('categories', vals)}
              />

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Du
                </span>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  aria-label="Date de début de déclaration"
                  title="Déclaré depuis le"
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Au
                </span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  aria-label="Date de fin de déclaration"
                  title="Déclaré jusqu'au"
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground outline-none appearance-none cursor-pointer hover:border-muted-foreground/30"
                >
                  <option value="newest">Plus récents</option>
                  <option value="oldest">Plus anciens</option>
                  <option value="priority">Priorité</option>
                  <option value="time-in-status">Temps en statut</option>
                </select>
                <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          <ActiveFilterChips filters={filters} onRemove={removeFilter} onClearAll={clearAllFilters} />
        </div>

        {/*  List  */}
        {/* Loading state */}
        {incidentsFetch.loading && (
          <Card>
            <CardContent className="p-0">
              <TableSkeleton rows={6} columns={8} />
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {!incidentsFetch.loading && incidentsFetch.error && (
          <ErrorState message={incidentsFetch.error} onRetry={incidentsFetch.refetch} />
        )}

        {/* System zero state */}
        {!incidentsFetch.loading && !incidentsFetch.error && systemZero && (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Inbox}
                title="Aucun incident en cours dans le système."
                description="Le système d'incidents est opérationnel. Les incidents apparaîtront ici une fois déclarés par les opérateurs."
                actionLabel="Déclarer un incident"
                onAction={() => router.push('/sous-chef/incidents/declare')}
              />
            </CardContent>
          </Card>
        )}

        {/* Filtered empty state */}
        {!incidentsFetch.loading && !incidentsFetch.error && filteredEmpty && (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Filter}
                title="Aucun résultat ne correspond à vos filtres actuels."
                description="Essayez de modifier vos critères de recherche ou de réinitialiser les filtres."
                actionLabel="Effacer les filtres"
                onAction={clearAllFilters}
              />
            </CardContent>
          </Card>
        )}

        {/* Desktop table */}
        {!incidentsFetch.loading && !incidentsFetch.error && !systemZero && !filteredEmpty && (
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        <th className="px-5 py-4 w-8" />
                        <th className="px-5 py-4">Référence</th>
                        <th className="px-5 py-4">Catégorie</th>
                        <th className="px-5 py-4">Département</th>
                        <th className="px-5 py-4">Priorité</th>
                        <th className="px-5 py-4">Statut</th>
                        <th className="px-5 py-4">Déclaré par</th>
                        <th className="px-5 py-4">Temps</th>
                        <th className="px-5 py-4 w-24" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border whitespace-nowrap">
                      {paginated.map((inc) => {
                        const cfg = getStatusConfig(inc.status);
                        const CatIcon = CATEGORY_ICONS[inc.category] ?? AlertTriangle;
                        return (
                          <tr key={inc.id} className="transition-colors hover:bg-muted/30 group">
                            <td className="px-5 py-4" style={{ boxShadow: `inset 4px 0 0 0 ${cfg.barColor}` }} />
                            <td className="px-5 py-4">
                              <button
                                onClick={() => setDrawerIncidentId(String(inc.id))}
                                className="font-mono text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {inc.reference}
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
                                <CatIcon className="h-4 w-4" />
                                {inc.category}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">{inc.department}</td>
                            <td className="px-5 py-4">
                              <span className={cn('rounded-md px-2 py-1 text-xs font-bold tracking-wide', PRIORITY_CLASSES[inc.priority])}>
                                {PRIORITY_LABELS[inc.priority]}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={cn('text-sm font-semibold', cfg.textClass)}>
                                {cfg.labelFr}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">
                              {inc.user?.firstName ?? '—'} {inc.user?.lastName ?? ''}
                              <span className="font-mono"> #{inc.user?.matricule ?? ''}</span>
                            </td>
                            <td className="px-5 py-4 text-sm text-muted-foreground">
                              {formatIncidentTime(inc)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setDrawerIncidentId(String(inc.id))}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-slate-700"
                                title="Voir les détails"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Voir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredIncidents.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Affichage de {paginated.length} sur {filteredIncidents.length} incidents
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 text-xs">
                        Précédent
                      </Button>
                      <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 text-xs">
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mobile cards */}
        {!incidentsFetch.loading && !incidentsFetch.error && !systemZero && !filteredEmpty && (
          <div className="md:hidden space-y-3">
            {paginated.map((inc) => {
              const cfg = getStatusConfig(inc.status);
              const CatIcon = CATEGORY_ICONS[inc.category] ?? AlertTriangle;
              return (
                <div
                  key={inc.id}
                  className="rounded-xl border bg-card transition-colors hover:bg-muted/20"
                  style={{ borderLeftWidth: '4px', borderLeftColor: cfg.barColor }}
                >
                  <button
                    onClick={() => setDrawerIncidentId(String(inc.id))}
                    className="flex w-full items-center justify-between px-5 py-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">{inc.reference}</span>
                        <span className={cn('rounded-md px-2 py-1 text-xs font-bold', PRIORITY_CLASSES[inc.priority])}>
                          {PRIORITY_LABELS[inc.priority]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <CatIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{inc.category}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground truncate">{inc.department}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className={cn('text-sm font-semibold', cfg.textClass)}>{cfg.labelFr}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">
                          {formatIncidentTime(inc)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              );
            })}

            {filteredIncidents.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">{paginated.length} / {filteredIncidents.length}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 text-xs">
                    Précédent
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 text-xs">
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/*  Mobile filter dialog  */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtres</DialogTitle>
            <DialogDescription>
              Filtrer les incidents par statut, priorité, département et catégorie.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2 pr-1">
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <FilterCheckGroup options={STATUS_OPTIONS} selected={filters.statuses} onToggle={(v) => toggleFilterValue('statuses', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <FilterCheckGroup options={PRIORITY_OPTIONS} selected={filters.priorities} onToggle={(v) => toggleFilterValue('priorities', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Département</Label>
              <FilterCheckGroup options={departmentOptions} selected={filters.departments} onToggle={(v) => toggleFilterValue('departments', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <FilterCheckGroup options={categoryOptions} selected={filters.categories} onToggle={(v) => toggleFilterValue('categories', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de déclaration</Label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  aria-label="Date de début de déclaration"
                  className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  aria-label="Date de fin de déclaration"
                  className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Trier par</Label>
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="flex h-9 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground outline-none appearance-none cursor-pointer hover:border-muted-foreground/30"
                >
                  <option value="newest">Plus récents</option>
                  <option value="oldest">Plus anciens</option>
                  <option value="priority">Priorité</option>
                  <option value="time-in-status">Temps en statut</option>
                </select>
                <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetDialogFilters}>
              Réinitialiser
            </Button>
            <Button
              onClick={() => setFilterOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*  Incident detail drawer  */}
      <IncidentDetailDrawer
        incidentId={drawerIncidentId}
        onClose={() => setDrawerIncidentId(null)}
      />
    </>
  );
}
