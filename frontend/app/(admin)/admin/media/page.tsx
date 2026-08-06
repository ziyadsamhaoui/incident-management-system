'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import {
  Search,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  Image as ImageIcon,
  Film,
  Trash2,
  X,
  Inbox,
  SlidersHorizontal,
  Eye,
  Clock,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync, extractErrorMessage } from '@/lib/use-async';
import { getDepartments } from '@/services/referenceService';
import {
  getAdminMedia,
  getAdminMediaStats,
  deleteMediaItem,
  bulkDeleteMedia,
  formatFileSize,
  formatMediaDate,
} from '@/services/mediaService';
import { StorageSummaryStrip } from '@/components/media/storage-summary-strip';
import { MediaPreviewModal } from '@/components/media/media-preview-modal';
import { BulkDeleteModal } from '@/components/media/bulk-delete-modal';
import type { AdminMediaItem, MediaSort } from '@/types/media';

// ── Constants ──────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tous' },
  { value: 'IMAGE', label: 'Photos' },
  { value: 'VIDEO', label: 'Vidéos' },
] as const;

const SORT_OPTIONS: { value: MediaSort; label: string }[] = [
  { value: 'newest', label: 'Plus récent' },
  { value: 'oldest', label: 'Plus ancien' },
  { value: 'largest', label: 'Taille de fichier (Décroissant)' },
];

type ViewMode = 'grid' | 'list';
type TypeFilter = 'ALL' | 'IMAGE' | 'VIDEO';

const PAGE_SIZE = 24;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function TypeBadge({ fileType }: { fileType: AdminMediaItem['fileType'] }) {
  return fileType === 'IMAGE' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
      <ImageIcon className="h-3 w-3" /> Photo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
      <Film className="h-3 w-3" /> Vidéo
    </span>
  );
}

// ── Page ───────────────────────────────────────────

export default function AdminMediaPage() {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();

  // ── Filters ──
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [fileType, setFileType] = useState<TypeFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<MediaSort>('newest');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  // ── View & selection ──
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selection, setSelection] = useState<Map<number, number>>(new Map()); // id → bytes
  const [previewItem, setPreviewItem] = useState<AdminMediaItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const deptsFetch = useAsync(() => getDepartments(), []);
  const statsFetch = useAsync(() => getAdminMediaStats(), []);
  const listFetch = useAsync(
    () =>
      getAdminMedia({
        search: debouncedSearch || undefined,
        departmentId: departmentId !== 'all' ? Number(departmentId) : undefined,
        fileType: fileType !== 'ALL' ? fileType : undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        sort,
        page: page - 1,
        size: PAGE_SIZE,
      }),
    [debouncedSearch, departmentId, fileType, dateFrom, dateTo, sort, page],
  );

  // ── Persist view mode ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem('admin_media_view_mode');
      if (stored === 'grid' || stored === 'list') setViewMode(stored);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('admin_media_view_mode', viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  // ── Derived ──
  // Memoized so the selection callbacks below keep stable deps (stable reference).
  const items = useMemo(() => listFetch.data?.content ?? [], [listFetch.data]);
  const totalElements = listFetch.data?.totalElements ?? 0;
  const totalPages = Math.max(1, listFetch.data?.totalPages ?? 1);
  const hasActiveFilters =
    search.trim() !== '' ||
    departmentId !== 'all' ||
    fileType !== 'ALL' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    sort !== 'newest';

  // Badge count for the mobile filter tab (excludes search — it has its own input)
  const activeFilterCount =
    (departmentId !== 'all' ? 1 : 0) +
    (fileType !== 'ALL' ? 1 : 0) +
    (dateFrom !== '' ? 1 : 0) +
    (dateTo !== '' ? 1 : 0) +
    (sort !== 'newest' ? 1 : 0);

  const systemZero = !listFetch.loading && totalElements === 0 && !hasActiveFilters;
  const filteredEmpty = !listFetch.loading && !listFetch.error && totalElements === 0 && hasActiveFilters;

  const selectedCount = selection.size;
  const selectedBytes = useMemo(
    () => Array.from(selection.values()).reduce((sum, b) => sum + b, 0),
    [selection],
  );
  const allPageSelected = items.length > 0 && items.every((i) => selection.has(i.id));
  const somePageSelected = items.some((i) => selection.has(i.id));

  const resetFilters = () => {
    setSearch('');
    setDepartmentId('all');
    setFileType('ALL');
    setDateFrom('');
    setDateTo('');
    setSort('newest');
    setPage(1);
  };

  // Reset only the filters exposed inside the mobile dialog (search stays intact)
  const resetDialogFilters = () => {
    setDepartmentId('all');
    setFileType('ALL');
    setDateFrom('');
    setDateTo('');
    setSort('newest');
    setPage(1);
  };

  const changePage = (next: number) => {
    setPage(Math.min(Math.max(1, next), totalPages));
  };

  // ── Selection helpers ──
  const toggleItem = useCallback((item: AdminMediaItem) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item.fileSizeBytes);
      return next;
    });
  }, []);

  const togglePage = useCallback(() => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (allPageSelected) {
        items.forEach((i) => next.delete(i.id));
      } else {
        items.forEach((i) => next.set(i.id, i.fileSizeBytes));
      }
      return next;
    });
  }, [allPageSelected, items]);

  const clearSelection = () => setSelection(new Map());

  // "Tout sélectionner" — fetches the full filtered set (capped) and adds every
  // matching id, so the bulk bar can act on all results, not only the current page.
  const selectAllFiltered = async () => {
    const total = listFetch.data?.totalElements ?? 0;
    if (total === 0) return;
    const size = Math.min(total, 500);
    try {
      const all = await getAdminMedia({
        search: debouncedSearch || undefined,
        departmentId: departmentId !== 'all' ? Number(departmentId) : undefined,
        fileType: fileType !== 'ALL' ? fileType : undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
        sort,
        page: 0,
        size,
      });
      setSelection((prev) => {
        const next = new Map(prev);
        all.content.forEach((i) => next.set(i.id, i.fileSizeBytes));
        return next;
      });
      if (size < total) {
        setNotice(`Sélection plafonnée à ${size} fichiers (${total} résultats au total).`);
      } else {
        setNotice(null);
      }
    } catch { /* silent — selection is best effort */ }
  };

  // ── Deletion ──
  const handleSingleDelete = async (item: AdminMediaItem) => {
    setDeletingId(item.id);
    setActionError(null);
    try {
      await deleteMediaItem(item.id);
      setSelection((prev) => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
      setPreviewItem(null);
      await Promise.all([listFetch.refetch(), statsFetch.refetch()]);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selection.size === 0) return;
    setBulkDeleting(true);
    setActionError(null);
    try {
      const result = await bulkDeleteMedia(Array.from(selection.keys()));
      clearSelection();
      setBulkOpen(false);
      if (result.skippedIds.length > 0) {
        setNotice(
          `${result.skippedIds.length} fichier(s) déjà supprimé(s) ont été ignorés. ${result.deletedCount} fichier(s) supprimé(s), ${formatFileSize(result.freedBytes)} libérés.`,
        );
      } else {
        setNotice(`${result.deletedCount} fichier(s) supprimé(s), ${formatFileSize(result.freedBytes)} libérés.`);
      }
      await Promise.all([listFetch.refetch(), statsFetch.refetch()]);
    } catch (err) {
      setActionError(extractErrorMessage(err));
      setBulkOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const departmentOptions = deptsFetch.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des médias</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Photos et vidéos stockées sur le serveur : consultation, audit et nettoyage
            </p>
          </div>
        </div>

        {/* ── 2. Storage summary strip ── */}
        <StorageSummaryStrip
          stats={statsFetch.data}
          loading={statsFetch.loading}
          onRetry={statsFetch.refetch}
        />

        {/* ── 3. Filters + view toggle ── */}
        <div className="space-y-3">
          {/* Search line — search + mobile filter tab + view toggle (all displays) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Rechercher par référence d'incident..."
                className="h-10 w-full pl-9"
              />
            </div>

            {/* Mobile-only filter tab (opens the filter dialog) — small & medium displays */}
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-muted lg:hidden"
              aria-label="Filtrer les médias"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* View toggle — always on the same line as the search bar */}
            <div className="ml-auto flex shrink-0 rounded-lg border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Grille</span>
              </button>
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
            </div>
          </div>

          {/* Desktop filters (hidden below lg — replaced by the filter dialog) */}
          <div className="hidden lg:flex flex-wrap items-center gap-2">
            <div className="w-44">
              <Select
                value={departmentId}
                onValueChange={(v) => { setDepartmentId(v); setPage(1); }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Tous les départements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type segmented control */}
            <div className="flex rounded-lg border bg-muted p-0.5">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setFileType(opt.value); setPage(1); }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    fileType === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.value === 'IMAGE' && <ImageIcon className="h-3.5 w-3.5" />}
                  {opt.value === 'VIDEO' && <Film className="h-3.5 w-3.5" />}
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                aria-label="Téléversé depuis le"
                title="Téléversé depuis le"
                className="h-10 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              <span className="text-xs text-muted-foreground">·</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                aria-label="Téléversé jusqu'au"
                title="Téléversé jusqu'au"
                className="h-10 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as MediaSort); setPage(1); }}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-input bg-background pl-3 pr-8 text-xs font-medium text-muted-foreground outline-none appearance-none cursor-pointer hover:border-muted-foreground/30"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* ── Action error / notice banners ── */}
        {actionError && (
          <ErrorState message={actionError} compact onRetry={() => setActionError(null)} />
        )}
        {notice && !actionError && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── 5. Bulk action bar ── */}
        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <SlidersHorizontal className="h-4 w-4" />
              {selectedCount} fichier{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
              <span className="font-normal text-blue-600/80 dark:text-blue-300/70">
                · {formatFileSize(selectedBytes)}
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {selection.size < totalElements && (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Tout sélectionner ({totalElements})
                </button>
              )}
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
              >
                <Square className="h-3.5 w-3.5" />
                Désélectionner
              </button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={() => setBulkOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer les fichiers sélectionnés
              </Button>
            </div>
          </div>
        )}

        {/* ── 3. Content ── */}
        {listFetch.loading ? (
          <div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="space-y-2 rounded-xl border p-3">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <Skeleton className="h-4 flex-1" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : listFetch.error ? (
          <ErrorState message={listFetch.error} onRetry={listFetch.refetch} />
        ) : systemZero ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Inbox}
                title="Aucun média stocké pour le moment."
                description="Les photos et vidéos jointes aux incidents apparaîtront ici une fois déclarées par les équipes."
              />
            </CardContent>
          </Card>
        ) : filteredEmpty ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Search}
                title="Aucun résultat ne correspond à vos filtres actuels."
                description="Essayez de modifier vos critères de recherche ou de réinitialiser les filtres."
                actionLabel="Réinitialiser les filtres"
                onAction={resetFilters}
              />
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <GridView
            items={items}
            selection={selection}
            onToggle={toggleItem}
            onOpen={setPreviewItem}
            onNavigate={(id) => { startNavigation(); router.push(`/admin/incidents/${id}`); }}
          />
        ) : (
          <ListView
            items={items}
            selection={selection}
            allPageSelected={allPageSelected}
            somePageSelected={somePageSelected}
            onTogglePage={togglePage}
            onToggle={toggleItem}
            onOpen={setPreviewItem}
            onNavigate={(id) => { startNavigation(); router.push(`/admin/incidents/${id}`); }}
          />
        )}

        {/* ── Pagination ── */}
        {!listFetch.loading && !listFetch.error && totalElements > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Affichage de {items.length} sur {totalElements} fichier{totalElements > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page <= 1} onClick={() => changePage(page - 1)}>
                Précédent
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Media inspector modal ── */}
      {previewItem && (
        <MediaPreviewModal
          key={previewItem.id}
          item={previewItem}
          deleting={deletingId === previewItem.id}
          onClose={() => setPreviewItem(null)}
          onConfirmDelete={handleSingleDelete}
        />
      )}

      {/* ── 5. Bulk deletion confirmation ── */}
      <BulkDeleteModal
        open={bulkOpen}
        count={selectedCount}
        freedBytes={selectedBytes}
        deleting={bulkDeleting}
        onCancel={() => setBulkOpen(false)}
        onConfirm={handleBulkDelete}
      />

      {/* ── Mobile filter dialog (small & medium displays) ── */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtres</DialogTitle>
            <DialogDescription>
              Filtrer les médias par département, type et date de téléversement.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2 pr-1">
            <div className="space-y-1.5">
              <Label>Département</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Tous les départements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={fileType} onValueChange={(v) => { setFileType(v as TypeFilter); setPage(1); }}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  <SelectItem value="IMAGE">Photos</SelectItem>
                  <SelectItem value="VIDEO">Vidéos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date de téléversement</Label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  aria-label="Téléversé depuis le"
                  className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                <span className="text-xs text-muted-foreground">·</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  aria-label="Téléversé jusqu'au"
                  className="h-9 flex-1 min-w-0 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Trier par</Label>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value as MediaSort); setPage(1); }}
                  className="flex h-9 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground outline-none appearance-none cursor-pointer hover:border-muted-foreground/30"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
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
    </div>
  );
}

// ── Grid View ──────────────────────────────────────

function GridView({
  items,
  selection,
  onToggle,
  onOpen,
  onNavigate,
}: {
  items: AdminMediaItem[];
  selection: Map<number, number>;
  onToggle: (item: AdminMediaItem) => void;
  onOpen: (item: AdminMediaItem) => void;
  onNavigate: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const isImage = item.fileType === 'IMAGE';
        const selected = selection.has(item.id);
        return (
          <div
            key={item.id}
            onClick={() => onOpen(item)}
            className={cn(
              'group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md',
              selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-border',
            )}
          >
            {/* Thumbnail */}
            <div className="relative h-36 overflow-hidden bg-slate-100 dark:bg-slate-900">
              {isImage && item.fileUrl ? (
                <img
                  src={item.fileUrl}
                  alt={item.fileName}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 dark:from-slate-900 dark:to-slate-800 dark:text-slate-500">
                  <Film className="h-9 w-9" />
                  <span className="text-[10px] font-medium">{formatFileSize(item.fileSizeBytes)}</span>
                </div>
              )}
              {/* Checkbox */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggle(item); }}
                className={cn(
                  'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border transition-colors',
                  selected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-white/80 bg-black/30 text-transparent hover:bg-black/40',
                )}
                aria-label={selected ? 'Désélectionner' : 'Sélectionner'}
              >
                {selected && <span className="text-[10px] font-bold">✓</span>}
              </button>
              <span className="absolute right-2 top-2">
                <TypeBadge fileType={item.fileType} />
              </span>
            </div>

            {/* Meta */}
            <div className="space-y-1 p-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigate(item.incidentId); }}
                className="block max-w-full truncate text-left font-mono text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                title={item.incidentReference}
              >
                {item.incidentReference}
              </button>
              <p className="truncate text-[11px] text-muted-foreground">
                {item.departmentName ?? '—'}
                {item.categoryName ? ` · ${item.categoryName}` : ''}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-foreground/80">
                  {formatFileSize(item.fileSizeBytes)}
                </span>
                {item.retentionDaysRemaining != null && item.retentionDaysRemaining <= 30 ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-semibold',
                      item.retentionDaysRemaining <= 7 ? 'text-red-500' : 'text-amber-500',
                    )}
                    title={`Suppression automatique dans ${item.retentionDaysRemaining} jour(s)`}
                  >
                    <Clock className="h-3 w-3" />
                    {item.retentionDaysRemaining === 0 ? 'auj.' : `${item.retentionDaysRemaining} j`}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List / Table View ──────────────────────────────

function ListView({
  items,
  selection,
  allPageSelected,
  somePageSelected,
  onTogglePage,
  onToggle,
  onOpen,
  onNavigate,
}: {
  items: AdminMediaItem[];
  selection: Map<number, number>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onTogglePage: () => void;
  onToggle: (item: AdminMediaItem) => void;
  onOpen: (item: AdminMediaItem) => void;
  onNavigate: (id: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                <th className="px-4 py-4 w-10">
                  <button
                    type="button"
                    onClick={onTogglePage}
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                      allPageSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : somePageSelected
                          ? 'border-blue-400 bg-blue-400/40 text-white'
                          : 'border-muted-foreground/40 hover:border-muted-foreground',
                    )}
                    title="Tout sélectionner"
                  >
                    {allPageSelected ? (
                      <span className="text-[10px] font-bold">✓</span>
                    ) : somePageSelected ? (
                      <span className="text-[10px] font-bold">–</span>
                    ) : null}
                  </button>
                </th>
                <th className="px-4 py-4">Média</th>
                <th className="px-4 py-4">Référence</th>
                <th className="px-4 py-4">Département</th>
                <th className="px-4 py-4">Catégorie</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4">Taille</th>
                <th className="px-4 py-4">Téléversé le</th>
                <th className="px-4 py-4">Par</th>
                <th className="px-4 py-4 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border whitespace-nowrap">
              {items.map((item) => {
                const isImage = item.fileType === 'IMAGE';
                const selected = selection.has(item.id);
                return (
                  <tr
                    key={item.id}
                    onClick={() => onOpen(item)}
                    className={cn('cursor-pointer transition-colors hover:bg-muted/30', selected && 'bg-blue-50/50 dark:bg-blue-950/20')}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onToggle(item)}
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-muted-foreground/40 hover:border-muted-foreground',
                        )}
                        aria-label={selected ? 'Désélectionner' : 'Sélectionner'}
                      >
                        {selected && <span className="text-[10px] font-bold">✓</span>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                          {isImage && item.fileUrl ? (
                            <img src={item.fileUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <Film className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <span className="max-w-44 truncate text-xs font-medium">{item.fileName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onNavigate(item.incidentId); }}
                        className="font-mono text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {item.incidentReference}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.departmentName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.categoryName ?? '—'}</td>
                    <td className="px-4 py-3"><TypeBadge fileType={item.fileType} /></td>
                    <td className="px-4 py-3 text-xs font-semibold">{formatFileSize(item.fileSizeBytes)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatMediaDate(item.uploadedAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.uploadedBy ? `${item.uploadedBy.firstName} ${item.uploadedBy.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        role="button"
                        tabIndex={0}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Voir
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
