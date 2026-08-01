'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  FolderTree,
  MapPin,
  LayoutGrid,
  Cpu,
  Plus,
  Search,
  Edit3,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  MessageSquare,
  Zap,
  Settings,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync, extractErrorMessage } from '@/lib/use-async';
import {
  getCategories,
  getDepartments,
  getSections,
  getProductionLines,
  getStations,
  createCategory,
  createDepartment,
  createSection,
  createProductionLine,
  createStation,
  updateCategory,
  updateDepartment,
  updateSection,
  updateProductionLine,
  updateStation,
  deleteCategory,
  deleteDepartment,
  deleteSection,
  deleteProductionLine,
  deleteStation,
} from '@/services/referenceService';

// ── Category → Icon Map ───────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Sécurité: ShieldAlert,
  Accident: Wrench,
  Réclamation: MessageSquare,
  Mécanique: Zap,
  Électrique: Settings,
};

function getCategoryIcon(name: string): React.ElementType {
  return CATEGORY_ICONS[name] ?? FolderTree;
}

// ── Tab configuration (real API endpoints) ────────

interface RefTab {
  key: string;
  label: string;
  icon: React.ElementType;
  /** Raw fetch result — each tab maps it to { id, name, parent? } */
  fetch: () => Promise<unknown[]>;
  create: (name: string) => Promise<unknown>;
  update: (id: number, name: string) => Promise<unknown>;
  remove: (id: number) => Promise<void>;
  emptyTitle: string;
  emptyCta: string;
  /** Map a raw record to the display shape */
  toItem: (raw: unknown) => { id: number; name: string; parent?: string };
}

const REF_TABS: RefTab[] = [
  {
    key: 'categories',
    label: 'Catégories',
    icon: FolderTree,
    fetch: getCategories,
    create: createCategory,
    update: updateCategory,
    remove: deleteCategory,
    emptyTitle: 'Aucune catégorie configurée.',
    emptyCta: '+ Ajouter une catégorie',
    toItem: (raw) => ({ id: (raw as { id: number }).id, name: (raw as { name: string }).name }),
  },
  {
    key: 'departments',
    label: 'Départements',
    icon: Building2,
    fetch: getDepartments,
    create: createDepartment,
    update: updateDepartment,
    remove: deleteDepartment,
    emptyTitle: 'Aucun département disponible.',
    emptyCta: '+ Créer un département',
    toItem: (raw) => ({ id: (raw as { id: number }).id, name: (raw as { name: string }).name }),
  },
  {
    key: 'sections',
    label: 'Sections',
    icon: LayoutGrid,
    fetch: getSections,
    create: createSection,
    update: updateSection,
    remove: deleteSection,
    emptyTitle: 'Aucune section enregistrée.',
    emptyCta: '+ Ajouter',
    toItem: (raw) => ({ id: (raw as { id: number }).id, name: (raw as { name: string }).name }),
  },
  {
    key: 'production-lines',
    label: 'Lignes de production',
    icon: MapPin,
    fetch: getProductionLines,
    create: (name) => createProductionLine(name, null),
    update: (id, name) => updateProductionLine(id, name, null),
    remove: deleteProductionLine,
    emptyTitle: 'Aucune ligne de production enregistrée.',
    emptyCta: '+ Ajouter',
    toItem: (raw) => {
      const r = raw as { id: number; name: string; section: { name: string } | null };
      return { id: r.id, name: r.name, parent: r.section?.name ?? undefined };
    },
  },
  {
    key: 'stations',
    label: 'Stations',
    icon: Cpu,
    fetch: getStations,
    create: (name) => createStation(name, null),
    update: (id, name) => updateStation(id, name, null),
    remove: deleteStation,
    emptyTitle: 'Aucune station enregistrée.',
    emptyCta: '+ Ajouter',
    toItem: (raw) => ({
      id: (raw as { id: number }).id,
      name: (raw as { code: string }).code,
    }),
  },
];

// ── Tab Button ────────────────────────────────────

function TabButton({
  tab,
  isActive,
  onClick,
  count,
}: {
  tab: RefTab;
  isActive: boolean;
  onClick: () => void;
  count: number | null;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
        isActive
          ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-r-2 border-blue-600'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{tab.label}</span>
      {count != null && <span className="text-xs text-muted-foreground/60">{count}</span>}
    </button>
  );
}

// ── Inner content (uses searchParams, needs Suspense) ──

function ReferenceDataContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const initialTab = tabParam && REF_TABS.some((t) => t.key === tabParam)
    ? tabParam
    : REF_TABS[0].key;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [deleteGuard, setDeleteGuard] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<number | null>(null);

  const activeSection = REF_TABS.find((t) => t.key === activeTab)!;

  const { data, loading, error, refetch } = useAsync(activeSection.fetch, [activeTab]);

  const items = useMemo(
    () =>
      (data ?? []).map((item) => {
        const mapped = activeSection.toItem(item);
        return { id: String(mapped.id), name: mapped.name, parent: mapped.parent };
      }),
    [data, activeSection],
  );

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setSearch('');
    setDeleteGuard(null);
    router.replace(`/admin/reference?tab=${key}`, { scroll: false });
  };

  const openCreateDialog = () => {
    setEditTarget(null);
    setNewName('');
    setDeleteGuard(null);
    setAddOpen(true);
  };

  const openEditDialog = (item: { id: string; name: string }) => {
    setEditTarget({ id: item.id, name: item.name });
    setNewName(item.name);
    setDeleteGuard(null);
    setAddOpen(true);
  };

  const closeDialog = () => {
    setAddOpen(false);
    setEditTarget(null);
    setNewName('');
  };

  const handleSubmit = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setDeleteGuard(null);
    try {
      if (editTarget) {
        // No-op when the name did not change
        if (name === editTarget.name) {
          closeDialog();
          return;
        }
        await activeSection.update(Number(editTarget.id), name);
      } else {
        await activeSection.create(name);
      }
      closeDialog();
      refetch();
    } catch (err) {
      setDeleteGuard(extractErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteClick = async (id: string, itemName: string) => {
    setBusyDeleteId(Number(id));
    setDeleteGuard(null);
    try {
      await activeSection.remove(Number(id));
      refetch();
    } catch (err) {
      // Friendly guard from the backend's 409 handler
      setDeleteGuard(
        extractErrorMessage(err) ??
          `Impossible de supprimer : « ${itemName} » est référencé par des données existantes.`,
      );
    } finally {
      setBusyDeleteId(null);
    }
  };

  const filteredItems = items.filter((item) =>
    search
      ? item.name.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  const showEmpty = !loading && !error && items.length === 0 && !search;
  const showFilteredEmpty = !loading && !error && search && filteredItems.length === 0;

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Données de référence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérer les catégories, départements, sections, lignes et stations
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left sidebar — section tabs */}
        <div className="w-full lg:w-56 shrink-0 space-y-1">
          {REF_TABS.map((tab) => (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              count={data && tab.key === activeTab ? data.length : null}
            />
          ))}
        </div>

        {/* Right content — items list */}
        <div className="flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2">
              <activeSection.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold">{activeSection.label}</h2>
              {!loading && data && (
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {data.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full pl-9 text-sm"
                />
              </div>
              <Dialog open={addOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreateDialog}>
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Ajouter</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>
                      {editTarget ? `Modifier ${activeSection.label.toLowerCase()}` : `Ajouter ${activeSection.label.toLowerCase()}`}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1.5 py-2">
                    <Label htmlFor="ref-name">Nom</Label>
                    <Input
                      id="ref-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nom..."
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
                      autoFocus
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleSubmit}
                      disabled={!newName.trim() || adding}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                      {editTarget ? 'Modifier' : 'Ajouter'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Deletion guard warning */}
          {deleteGuard && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{deleteGuard}</span>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ))}
                </div>
              ) : showEmpty ? (
                <EmptyState
                  compact
                  icon={activeSection.icon}
                  title={activeSection.emptyTitle}
                  description="Ajoutez un élément pour commencer à l'utiliser dans le système."
                  actionLabel={activeSection.emptyCta}
                  onAction={openCreateDialog}
                />
              ) : showFilteredEmpty ? (
                <EmptyState
                  compact
                  icon={activeSection.icon}
                  title="Aucun résultat ne correspond à vos filtres actuels."
                  actionLabel="Effacer les filtres"
                  onAction={() => setSearch('')}
                />
              ) : (
                <div className="divide-y divide-border">
                  {filteredItems.map((item) => {
                    const ItemIcon = activeTab === 'categories'
                      ? getCategoryIcon(item.name)
                      : activeSection.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <ItemIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.name}
                            </p>
                            {item.parent && (
                              <p className="text-[10px] text-muted-foreground">
                                {item.parent}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEditDialog(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Modifier"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busyDeleteId === Number(item.id)}
                            onClick={() => handleDeleteClick(item.id, item.name)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Supprimer"
                          >
                            {busyDeleteId === Number(item.id) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// ── Page with Suspense boundary ────────────────────

export default function AdminReferenceDataPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Suspense fallback={<div className="flex justify-center py-12"><p className="text-sm text-muted-foreground">Chargement...</p></div>}>
          <ReferenceDataContent />
        </Suspense>
      </div>
    </div>
  );
}
