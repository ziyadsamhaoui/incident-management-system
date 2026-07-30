'use client';

import { useState, Suspense } from 'react';
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
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  MessageSquare,
  Zap,
  Settings,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Reference Data Types ──────────────────────────

interface RefDataItem {
  id: string;
  name: string;
  parent?: string;
}

interface RefDataTab {
  key: string;
  label: string;
  icon: React.ElementType;
  items: RefDataItem[];
}

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

// ── Mock Data ─────────────────────────────────────

const REF_DATA: RefDataTab[] = [
  {
    key: 'categories',
    label: 'Catégories',
    icon: FolderTree,
    items: [
      { id: '1', name: 'Sécurité' },
      { id: '2', name: 'Accident' },
      { id: '3', name: 'Réclamation' },
      { id: '4', name: 'Mécanique' },
      { id: '5', name: 'Électrique' },
    ],
  },
  {
    key: 'departments',
    label: 'Départements',
    icon: Building2,
    items: [
      { id: '1', name: 'Assemblage' },
      { id: '2', name: 'Usinage' },
      { id: '3', name: 'Peinture' },
      { id: '4', name: 'Soudure' },
      { id: '5', name: 'Logistique' },
    ],
  },
  {
    key: 'sections',
    label: 'Sections',
    icon: LayoutGrid,
    items: [
      { id: '1', name: 'Section A', parent: 'Assemblage' },
      { id: '2', name: 'Section B', parent: 'Usinage' },
      { id: '3', name: 'Section C', parent: 'Peinture' },
    ],
  },
  {
    key: 'production-lines',
    label: 'Lignes de production',
    icon: MapPin,
    items: [
      { id: '1', name: 'Ligne 1', parent: 'Assemblage' },
      { id: '2', name: 'Ligne 2', parent: 'Usinage' },
      { id: '3', name: 'Ligne 3', parent: 'Peinture' },
    ],
  },
  {
    key: 'stations',
    label: 'Stations',
    icon: Cpu,
    items: [
      { id: '1', name: 'Station 1-1', parent: 'Ligne 1' },
      { id: '2', name: 'Station 1-2', parent: 'Ligne 1' },
      { id: '3', name: 'Station 2-1', parent: 'Ligne 2' },
    ],
  },
];

// ── Tab Button ────────────────────────────────────

function TabButton({
  tab,
  isActive,
  onClick,
  count,
}: {
  tab: RefDataTab;
  isActive: boolean;
  onClick: () => void;
  count: number;
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
      <span className="text-xs text-muted-foreground/60">{count}</span>
    </button>
  );
}

// ── Inner content (uses searchParams, needs Suspense) ──

function ReferenceDataContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const initialTab = tabParam && REF_DATA.find((t) => t.key === tabParam)
    ? tabParam
    : REF_DATA[0].key;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [deleteGuard, setDeleteGuard] = useState<string | null>(null);

  const activeSection = REF_DATA.find((t) => t.key === activeTab)!;

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setSearch('');
    setDeleteGuard(null);
    router.replace(`/admin/reference?tab=${key}`, { scroll: false });
  };

  const handleDeleteClick = (itemName: string) => {
    // Simulate checking if item is referenced by incidents
    const linkedIncidents = Math.floor(Math.random() * 3); // Mock
    if (linkedIncidents > 0) {
      setDeleteGuard(
        `Impossible de supprimer : « ${itemName} » est lié à ${linkedIncidents} incident(s). Supprimez d'abord les incidents associés.`,
      );
      setTimeout(() => setDeleteGuard(null), 4000);
    } else {
      // Proceed with deletion (mock)
      setDeleteGuard(null);
    }
  };

  const filteredItems = activeSection.items.filter((item) =>
    search
      ? item.name.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Données de référence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérer les catégories, départements, sections, lignes et stations
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left sidebar — section tabs */}
        <div className="w-full lg:w-56 shrink-0 space-y-1">
          {REF_DATA.map((tab) => (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              count={tab.items.length}
            />
          ))}
        </div>

        {/* Right content — items list */}
        <div className="flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2">
              <activeSection.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold">{activeSection.label}</h2>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {activeSection.items.length}
              </span>
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
              <Button size="sm" className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ajouter</span>
              </Button>
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
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <activeSection.icon className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Aucun élément trouvé.
                  </p>
                </div>
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
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(item.name)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </button>

        <Suspense fallback={<div className="flex justify-center py-12"><p className="text-sm text-muted-foreground">Chargement...</p></div>}>
          <ReferenceDataContent />
        </Suspense>
      </div>
    </div>
  );
}
