'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  ArrowUpDown,
  LayoutList,
  Columns3,
  Plus,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Eye,
  UserCheck,
  X,
  ShieldAlert,
  Wrench,
  MessageSquare,
  Zap,
  Settings,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getStatusConfig } from '@/lib/constants/incidentStatus';
import type { IncidentStatus, IncidentPriority } from '@/types/incident';
import type { IncidentDTO } from '@/types/incident';
import {
  getIncidents,
  claimIncident,
  evaluateIncident,
} from '@/services/incidentService';
import { getCategories, getDepartments } from '@/services/referenceService';
import { useAuthStore } from '@/store/useAuthStore';
import { useAsync, extractErrorMessage } from '@/lib/use-async';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TableSkeleton } from '@/components/ui/skeleton';

// ── Helpers ───────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée', CRITICAL: 'Critique' };
const PRIORITY_CLASSES: Record<string, string> = { LOW: 'text-slate-500 bg-slate-100 dark:bg-slate-800', MEDIUM: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', HIGH: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', CRITICAL: 'text-red-600 bg-red-50 dark:bg-red-900/20' };
const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

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

// ── Types ─────────────────────────────────────────

interface Filters {
  search: string;
  statuses: IncidentStatus[];
  priorities: IncidentPriority[];
  departments: string[];
  categories: string[];
  scope: 'mine' | 'all';
  sort: 'newest' | 'oldest' | 'priority' | 'time-in-status';
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  statuses: [],
  priorities: [],
  departments: [],
  categories: [],
  scope: 'all',
  sort: 'newest',
};

type ViewMode = 'list' | 'board';

// ── Multi-Select Dropdown ─────────────────────────

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

// ── Active Filter Chips ───────────────────────────

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

// ── Evaluate Modal ────────────────────────────────

function EvaluateModal({
  incident,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  incident: IncidentDTO;
  onClose: () => void;
  onSubmit: (status: 'RESOLVED' | 'NON_RESOLVED', note: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [selectedStatus, setSelectedStatus] = useState<'RESOLVED' | 'NON_RESOLVED'>('RESOLVED');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  async function handleSubmit() {
    if (selectedStatus === 'NON_RESOLVED' && !note.trim()) {
      setNoteError('Une note est requise pour les incidents non résolus.');
      return;
    }
    setNoteError(null);
    await onSubmit(selectedStatus, note.trim());
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Évaluer l'incident</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{incident.reference}</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Résultat</label>
          <div className="grid grid-cols-2 gap-2">
            {(['RESOLVED', 'NON_RESOLVED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedStatus(s)}
                className={cn(
                  'rounded-xl border-2 p-3 text-left transition-all',
                  selectedStatus === s
                    ? s === 'RESOLVED' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-border',
                )}
              >
                <p className="text-sm font-medium">{s === 'RESOLVED' ? 'Résolu' : 'Non résolu'}</p>
                <p className="text-[10px] text-muted-foreground">{s === 'RESOLVED' ? "L'incident a été traité" : "N'a pas pu être résolu"}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Note de résolution <span className="text-destructive">*</span>
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => { setNote(e.target.value); if (noteError) setNoteError(null); }}
            placeholder="Actions prises pour résoudre l'incident..."
            disabled={isSubmitting}
            className={cn(
              'w-full resize-none rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30',
              noteError ? 'border-destructive' : 'border-input',
            )}
          />
          {noteError && <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />{noteError}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className={cn('gap-2', selectedStatus === 'NON_RESOLVED' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700')}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {selectedStatus === 'RESOLVED' ? 'Confirmer résolution' : 'Confirmer non-résolution'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────

function KanbanCard({ incident, onDragStart }: { incident: IncidentDTO; onDragStart?: (e: React.DragEvent, id: number) => void }) {
  const cfg = getStatusConfig(incident.status);
  const Icon = CATEGORY_ICONS[incident.category] ?? AlertTriangle;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, incident.id)}
      className="cursor-grab active:cursor-grabbing rounded-lg border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <span className="font-mono text-base font-semibold text-foreground">{incident.reference}</span>
        <span className={cn('rounded-md px-3 py-1.5 text-sm font-bold tracking-wide', PRIORITY_CLASSES[incident.priority])}>{PRIORITY_LABELS[incident.priority]}</span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-base text-muted-foreground font-medium">{incident.category}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('text-base font-semibold', cfg.textClass)}>{cfg.labelFr}</span>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────

function KanbanColumn({
  title,
  incidents,
  onDrop,
  onDragStart,
}: {
  title: string;
  incidents: IncidentDTO[];
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, id: number) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div
      className={cn(
        'flex w-80 shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors',
        dragOver && 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/20',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => { setDragOver(false); onDrop(e); }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <span className="text-base font-semibold uppercase tracking-wider text-foreground/70">{title}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-medium">{incidents.length}</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-base text-muted-foreground/50">Aucun incident</p>
          </div>
        ) : (
          incidents.map((inc) => (
            <KanbanCard key={inc.id} incident={inc} onDragStart={onDragStart} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────

export default function AdminIncidentsPage() {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const searchParams = useSearchParams();
  const currentMatricule = useAuthStore((s) => s.matricule);

  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [evaluateTarget, setEvaluateTarget] = useState<IncidentDTO | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Real data ─────────────────────────────────────
  const incidentsFetch = useAsync(() => getIncidents({ size: 200 }), []);
  const deptsFetch = useAsync(() => getDepartments(), []);
  const catsFetch = useAsync(() => getCategories(), []);

  useEffect(() => setMounted(true), []);

  // ── Persist view mode to localStorage ────────────
  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = localStorage.getItem('admin_incidents_view_mode');
      if (stored === 'list' || stored === 'board') setViewMode(stored);
    } catch { /* ignore */ }
  }, [mounted]);

  useEffect(() => {
    try { localStorage.setItem('admin_incidents_view_mode', viewMode); }
    catch { /* ignore */ }
  }, [viewMode]);

  // ── Pre-filter from dashboard deep-links ─────────
  useEffect(() => {
    if (!mounted) return;
    const ref = searchParams.get('ref');
    if (ref) setFilters((prev) => ({ ...prev, search: ref }));
  }, [mounted, searchParams]);

  const allIncidents = incidentsFetch.data?.content ?? [];

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

    if (filters.scope === 'mine') {
      result = result.filter((i) => i.user?.matricule === currentMatricule);
    }

    switch (filters.sort) {
      case 'newest': result.sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.declaredAt).getTime() - new Date(b.declaredAt).getTime()); break;
      case 'priority': result.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)); break;
      case 'time-in-status': result.sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime()); break;
    }

    return result;
  }, [allIncidents, filters, currentMatricule]);

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, IncidentDTO[]> = {
      DECLARED: [],
      CLAIMED: [],
      IN_PROGRESS: [],
      RESOLVED: [],
      NON_RESOLVED: [],
      CLOSED: [],
    };
    filteredIncidents.forEach((i) => { if (groups[i.status]) groups[i.status].push(i); });
    return groups;
  }, [filteredIncidents]);

  // ── Action handlers ─────────────────────────────

  const handleClaim = async (id: number) => {
    setActionError(null);
    try {
      await claimIncident(id);
      await incidentsFetch.refetch();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const handleEvaluate = async (status: 'RESOLVED' | 'NON_RESOLVED', note: string) => {
    if (!evaluateTarget) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await evaluateIncident(evaluateTarget.id, { status, note });
      await incidentsFetch.refetch();
      setEvaluateTarget(null);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', String(id));
  };

  const handleDrop = (targetStatus: string) => async (e: React.DragEvent) => {
    const rawId = e.dataTransfer.getData('text/plain');
    const id = Number(rawId);
    const incident = allIncidents.find((i) => i.id === id);
    if (!incident || !rawId) return;

    // State machine rules
    if (targetStatus === 'IN_PROGRESS') return; // BLOCKED
    if (incident.status === 'DECLARED' && targetStatus === 'CLAIMED') {
      await handleClaim(id);
      return;
    }
    if ((incident.status === 'IN_PROGRESS') && (targetStatus === 'RESOLVED' || targetStatus === 'NON_RESOLVED')) {
      const target = allIncidents.find((i) => i.id === id);
      if (target) setEvaluateTarget(target);
      return;
    }
  };

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const removeFilter = (key: keyof Filters, value?: string) => {
    setFilters((prev) => {
      if (key === 'search') return { ...prev, search: '' };
      if (Array.isArray(prev[key])) {
        return { ...prev, [key]: (prev[key] as string[]).filter((v) => v !== value) };
      }
      return prev;
    });
  };

  const clearAllFilters = () => setFilters(DEFAULT_FILTERS);

  // ── Pagination ──────────────────────────────────
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE));
  const paginated = filteredIncidents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── System zero state ───────────────────────────
  const systemZero = !incidentsFetch.loading && allIncidents.length === 0;

  // ── Filter empty state ──────────────────────────
  const isFiltered = filters.search || filters.statuses.length > 0 || filters.priorities.length > 0 ||
    filters.departments.length > 0 || filters.categories.length > 0 || filters.scope === 'mine';
  const filteredEmpty = !systemZero && filteredIncidents.length === 0 && isFiltered;

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const departmentOptions = (deptsFetch.data ?? []).map((d) => ({ value: d.name, label: d.name }));
  const categoryOptions = (catsFetch.data ?? []).map((c) => ({ value: c.name, label: c.name }));

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── 2.1 — Page Header ─────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
            <p className="mt-1 text-sm text-muted-foreground">Vue globale, tous départements</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Liste</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'board' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tableau</span>
              </button>
            </div>
            <Button size="sm" className="h-9 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push('/sous-chef/incidents/declare')}>
              <Plus className="h-3.5 w-3.5" />
              Déclarer
            </Button>
          </div>
        </div>

        {/* ── 2.2 — Multi-Filter Bar ────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-48 lg:w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Réf., description, nom..."
                className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <MultiSelectDropdown
              label="Statut"
              options={[
                { value: 'DECLARED', label: 'Déclaré' },
                { value: 'CLAIMED', label: 'Pris en charge' },
                { value: 'IN_PROGRESS', label: 'En cours' },
                { value: 'RESOLVED', label: 'Résolu' },
                { value: 'NON_RESOLVED', label: 'Non résolu' },
                { value: 'CLOSED', label: 'Clôturé' },
              ]}
              selected={filters.statuses}
              onChange={(vals) => updateFilter('statuses', vals)}
            />

            <MultiSelectDropdown
              label="Priorité"
              options={[
                { value: 'CRITICAL', label: 'Critique' },
                { value: 'HIGH', label: 'Élevée' },
                { value: 'MEDIUM', label: 'Moyenne' },
                { value: 'LOW', label: 'Faible' },
              ]}
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

            <button
              type="button"
              onClick={() => updateFilter('scope', filters.scope === 'mine' ? 'all' : 'mine')}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap',
                filters.scope === 'mine'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-input text-muted-foreground hover:border-muted-foreground/30',
              )}
            >
              <UserCheck className="h-3.5 w-3.5" />
              {filters.scope === 'mine' ? 'Mes incidents' : 'Tous'}
            </button>

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

          <ActiveFilterChips filters={filters} onRemove={removeFilter} onClearAll={clearAllFilters} />
        </div>

        {/* ── Action error banner ───────────────────── */}
        {actionError && (
          <ErrorState message={actionError} compact onRetry={() => setActionError(null)} />
        )}

        {/* ── Board View (Kanban) ───────────────────── */}
        {!incidentsFetch.loading && !incidentsFetch.error && !systemZero && viewMode === 'board' && (
          <div className="hidden md:block">
            <div className="flex gap-4 overflow-x-auto pb-4">
              <KanbanColumn
                title="Déclaré"
                incidents={groupedByStatus.DECLARED}
                onDrop={handleDrop('DECLARED')}
                onDragStart={handleDragStart}
              />
              <KanbanColumn
                title="Pris en charge"
                incidents={groupedByStatus.CLAIMED}
                onDrop={handleDrop('CLAIMED')}
                onDragStart={handleDragStart}
              />
              <KanbanColumn
                title="En cours"
                incidents={groupedByStatus.IN_PROGRESS}
                onDrop={handleDrop('IN_PROGRESS')}
                onDragStart={handleDragStart}
              />
              <KanbanColumn
                title="Résolu / Non résolu"
                incidents={[...groupedByStatus.RESOLVED, ...groupedByStatus.NON_RESOLVED]}
                onDrop={handleDrop('RESOLVED')}
                onDragStart={handleDragStart}
              />
              <KanbanColumn
                title="Clôturé"
                incidents={groupedByStatus.CLOSED}
                onDrop={handleDrop('CLOSED')}
                onDragStart={handleDragStart}
              />
            </div>
          </div>
        )}

        {/* ── List View ────────────────────────────── */}
        {viewMode === 'list' && (
          <>
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
                            <th className="px-5 py-4">Actions</th>
                            <th className="px-5 py-4 w-14" />
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
                                    onClick={() => {
                                      startNavigation();
                                      router.push(`/admin/incidents/${inc.id}`);
                                    }}
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
                                  {formatElapsed(inc.claimedAt ?? inc.declaredAt)}
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-2">
                                    {inc.status === 'DECLARED' && (
                                      <button
                                        type="button"
                                        onClick={() => handleClaim(inc.id)}
                                        className="flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                                      >
                                        <UserCheck className="h-3.5 w-3.5" />
                                        Prendre
                                      </button>
                                    )}
                                    {inc.status === 'IN_PROGRESS' && (
                                      <button
                                        type="button"
                                        onClick={() => setEvaluateTarget(inc)}
                                        className="flex h-8 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                                      >
                                        Évaluer
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      startNavigation();
                                      router.push(`/admin/incidents/${inc.id}`);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    title="Voir les détails"
                                  >
                                    <Eye className="h-4 w-4" />
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
                        onClick={() => router.push(`/admin/incidents/${inc.id}`)}
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
                            <span className="text-sm text-muted-foreground">{inc.department}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className={cn('text-sm font-semibold', cfg.textClass)}>{cfg.labelFr}</span>
                            <span className="text-sm text-muted-foreground">·</span>
                            <span className="text-sm text-muted-foreground font-mono">#{inc.user?.matricule ?? ''}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </button>
                      {(inc.status === 'DECLARED' || inc.status === 'IN_PROGRESS') && (
                        <div className="flex items-center gap-3 border-t px-5 py-3">
                          {inc.status === 'DECLARED' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleClaim(inc.id); }}
                              className="flex h-9 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                            >
                              <UserCheck className="h-4 w-4" />
                              Prendre en charge
                            </button>
                          )}
                          {inc.status === 'IN_PROGRESS' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEvaluateTarget(inc); }}
                              className="flex h-9 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                            >
                              Évaluer
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => router.push(`/admin/incidents/${inc.id}`)}
                            className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                          >
                            Détails
                          </button>
                        </div>
                      )}
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
          </>
        )}

        {/* ── Board view mobile fallback ─────────────── */}
        {!incidentsFetch.loading && !incidentsFetch.error && viewMode === 'board' && (
          <div className="md:hidden rounded-lg border bg-muted/30 p-6 text-center">
            <Columns3 className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Le mode tableau est disponible sur les écrans plus larges.</p>
            <Button variant="outline" size="sm" onClick={() => setViewMode('list')} className="mt-3">
              <LayoutList className="h-3.5 w-3.5 mr-1.5" />
              Passer en mode liste
            </Button>
          </div>
        )}

        {/* ── Evaluate Modal ─────────────────────────── */}
        {evaluateTarget && (
          <EvaluateModal
            incident={evaluateTarget}
            onClose={() => setEvaluateTarget(null)}
            onSubmit={handleEvaluate}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
