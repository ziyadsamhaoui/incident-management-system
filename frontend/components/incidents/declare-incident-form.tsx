'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Mic,
  MicOff,
  Check,
  Wrench,
  Shield,
  Zap,
  MessageSquare,
  Factory,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useAsync } from '@/lib/use-async';
import { getCategories, getStations, getDepartments } from '@/services/referenceService';
import { createIncident } from '@/services/incidentService';
import { getMe } from '@/services/userService';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';


// ── Constants ─────────────────────────────────────

const DRAFT_KEY = 'incident_draft';
// Legacy pre-namespacing key used by the sous-chef declare flow.
const LEGACY_SOUS_CHEF_DRAFT_KEY = 'sous_chef_incident_draft';

// Default priority suggestions keyed by category name (used only as a UX
// helper — the real category list is fetched from /api/reference-data/categories).
const CATEGORY_PRIORITY_SUGGESTIONS: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
  Sécurité: 'CRITICAL',
  Accident: 'HIGH',
  Panne: 'MEDIUM',
  Mécanique: 'MEDIUM',
  Électrique: 'HIGH',
  Réclamation: 'LOW',
};

// Optional description presets per category label (UI convenience only).
const CATEGORY_PRESETS: Record<string, string[]> = {
  Sécurité: ['Sol glissant', 'Équipement défectueux', 'Zone non sécurisée', 'Fuite de produit'],
  Accident: ['Coupure légère', 'Choc/impact', 'Brûlure', 'Malaise'],
  Panne: ['Ligne arrêtée', 'Surchauffe moteur', 'Fuite d\'huile', 'Défaut électrique'],
  Mécanique: ['Pièce usée', 'Bruit anormal', 'Vibration excessive'],
  Électrique: ['Coupure de courant', 'Défaut de câblage', 'Fusible grillé'],
  Réclamation: ['Pièce non conforme', 'Retard livraison', 'Document manquant', 'Défaut qualité'],
};

// Category label → icon mapping (visual only, derived from real data).
function categoryIcon(label: string): React.ReactNode {
  const key = label.toLowerCase();
  if (key.includes('sécur') || key.includes('secur')) return <Shield className="h-8 w-8" />;
  if (key.includes('accident')) return <Wrench className="h-8 w-8" />;
  if (key.includes('réclam') || key.includes('reclam')) return <MessageSquare className="h-8 w-8" />;
  if (key.includes('électr') || key.includes('electr')) return <Zap className="h-8 w-8" />;
  if (key.includes('mécan') || key.includes('mecan')) return <Wrench className="h-8 w-8" />;
  if (key.includes('panne')) return <Zap className="h-8 w-8" />;
  return <Factory className="h-8 w-8" />;
}

const PRIORITIES = [
  { value: 'LOW', label: 'Faible' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'HIGH', label: 'Élevée' },
  { value: 'CRITICAL', label: 'Critique' },
] as const;

// ── Types ─────────────────────────────────────────

interface DraftState {
  departmentId: number | null;
  stationId: number | null;
  categoryId: number | null;
  priority: string;
  description: string;
}

interface CategoryTileDef {
  id: number;
  label: string;
  icon: React.ReactNode;
  defaultPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  presets: string[];
}

interface StationOption {
  id: number;
  label: string;
}

// ── Voice Dictation Hook ──────────────────────────

function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { isListening, transcript, startListening, stopListening };
}

// ── Station Chip ──────────────────────────────────

function StationChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150',
        'border-2',
        selected
          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600',
        'active:scale-[0.97] cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
      )}
    >
      {selected && <Check className="h-4 w-4 shrink-0" />}
      {label}
    </button>
  );
}

// ── Category Tile ─────────────────────────────────

function CategoryTile({
  def,
  selected,
  onSelect,
}: {
  def: CategoryTileDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition-all duration-150',
        'border-2 min-h-[100px]',
        selected
          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600',
        'active:scale-[0.97] cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-lg w-14 h-14',
          selected
            ? 'bg-blue-100 dark:bg-blue-900/40'
            : 'bg-slate-100 dark:bg-slate-800',
        )}
      >
        {def.icon}
      </div>
      <span className="text-sm font-semibold text-center leading-tight">{def.label}</span>
    </button>
  );
}

// ── Priority Segmented Control ────────────────────

function PriorityControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
      {PRIORITIES.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={cn(
              'rounded-lg px-2 py-2 text-xs font-semibold transition-all duration-150',
              active
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              'active:scale-[0.95] cursor-pointer select-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Shared Form ───────────────────────────────────

export function DeclareIncidentForm({
  homePath = '/sous-chef',
  draftKey = DRAFT_KEY,
}: {
  /** Where to redirect after a successful declaration. */
  homePath?: string;
  /** localStorage key for draft persistence — namespace per role to avoid leaks. */
  draftKey?: string;
}) {
  const router = useRouter();
  const { departmentId, departmentName } = useAuthStore();
  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();

  // ── Current user + reference data (real API) ───
  const { data: me } = useAsync(getMe, []);
  const { data: categoriesData, loading: loadingCategories, error: categoriesError, refetch: refetchCategories } =
    useAsync(getCategories, []);
  const { data: stationsData, loading: loadingStations, error: stationsError, refetch: refetchStations } =
    useAsync(getStations, []);
  // Departments — only used when the current user has none assigned (e.g. ADMIN).
  const { data: departmentsData, loading: loadingDepartments, error: departmentsError, refetch: refetchDepartments } =
    useAsync(getDepartments, []);

  const stations: StationOption[] = useMemo(
    () => (stationsData ?? []).map((s) => ({ id: s.id, label: s.code })),
    [stationsData],
  );

  const categories: CategoryTileDef[] = useMemo(
    () =>
      (categoriesData ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        icon: categoryIcon(c.name),
        defaultPriority: CATEGORY_PRIORITY_SUGGESTIONS[c.name] ?? 'MEDIUM',
        presets: CATEGORY_PRESETS[c.name] ?? [],
      })),
    [categoriesData],
  );

  const departments: StationOption[] = useMemo(
    () => (departmentsData ?? []).map((d) => ({ id: d.id, label: d.name })),
    [departmentsData],
  );

  // ── Form state (real ids) ───────────────────────
  const [departmentChoice, setDepartmentChoice] = useState<number | null>(
    departmentId ? Number(departmentId) : null,
  );
  const [stationId, setStationId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');

  const effectiveDepartmentId = departmentId ? Number(departmentId) : departmentChoice;

  // ── Submit / toast ──────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isValid = stationId != null && categoryId != null && effectiveDepartmentId != null;

  // ── Auto-priority from category ─────────────────
  useEffect(() => {
    if (categoryId == null) return;
    const def = categories.find((c) => c.id === categoryId);
    if (def) setPriority(def.defaultPriority);
  }, [categoryId, categories]);

  // ── Draft persistence ───────────────────────────
  useEffect(() => {
    try {
      let raw = localStorage.getItem(draftKey);
      // One-time migration: the sous-chef flow previously stored under a
      // non-namespaced key — fall back to it (and consume it) so in-progress
      // drafts survive. Only the sous-chef flow ever wrote that key, so the
      // fallback is scoped there to preserve cross-role isolation.
      if (!raw && draftKey === 'incident_draft_sous_chef') {
        raw = localStorage.getItem(LEGACY_SOUS_CHEF_DRAFT_KEY);
        if (raw) localStorage.removeItem(LEGACY_SOUS_CHEF_DRAFT_KEY);
      }
      if (raw) {
        const draft: DraftState = JSON.parse(raw);
        if (draft.departmentId != null) setDepartmentChoice(draft.departmentId);
        if (draft.stationId != null) setStationId(draft.stationId);
        if (draft.categoryId != null) setCategoryId(draft.categoryId);
        if (draft.priority) setPriority(draft.priority);
        if (draft.description) setDescription(draft.description);
      }
    } catch {
      // Corrupted draft — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on every change
  useEffect(() => {
    const draft: DraftState = {
      departmentId: effectiveDepartmentId,
      stationId,
      categoryId,
      priority,
      description,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftKey, effectiveDepartmentId, stationId, categoryId, priority, description]);

  // ── Voice transcript integration ────────────────
  useEffect(() => {
    if (transcript) {
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // ── Submit handler (real API) ───────────────────
  const handleSubmit = async () => {
    if (!isValid || !stationId || !categoryId || !effectiveDepartmentId) return;
    setIsSubmitting(true);
    try {
      const created = await createIncident({
        userId: me?.id ?? 0, // real user id from GET /api/me
        departmentId: effectiveDepartmentId,
        stationId,
        categoryId,
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        description: description.trim(),
      });

      // Clear draft
      localStorage.removeItem(draftKey);

      // Show success toast and redirect
      setToastMessage(`Incident ${created.reference} créé avec succès`);
      setTimeout(() => {
        router.push(homePath);
      }, 200);
    } catch {
      setToastMessage("Échec de la déclaration. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* ── Page Header ──────────────────────────── */}
      <div className="max-w-2xl mx-auto">
        <div className="space-y-5 pb-4">
          {/* Back button */}
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>

          {/* Title */}
          <div>
            <h1 className="text-xl font-bold tracking-tight">Déclarer un incident</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Remplissez les champs ci-dessous en {`<`}15 secondes
            </p>
          </div>

          {/* ── A. Department ────────────────────── */}
          {departmentId ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Factory className="h-3.5 w-3.5" />
              Département : {departmentName ?? 'Non assigné'}
            </div>
          ) : (
            <section>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Département
              </label>
              {loadingDepartments ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : departmentsError ? (
                <ErrorState compact message={departmentsError} onRetry={refetchDepartments} />
              ) : departments.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  Aucun département enregistré. Contactez un administrateur.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {departments.map((d) => (
                    <StationChip
                      key={d.id}
                      label={d.label}
                      selected={departmentChoice === d.id}
                      onSelect={() => setDepartmentChoice(d.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── B. Station Selector ───────────────── */}
          <section>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Poste de travail
            </label>
            {loadingStations ? (
              <div className="grid grid-cols-2 gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : stationsError ? (
              <ErrorState compact message={stationsError} onRetry={refetchStations} />
            ) : stations.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Aucune station enregistrée. Contactez un administrateur.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {stations.map((s) => (
                  <StationChip
                    key={s.id}
                    label={s.label}
                    selected={stationId === s.id}
                    onSelect={() => setStationId(s.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── C. Category Selector ──────────────── */}
          <section>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Type d&apos;incident
            </label>
            {loadingCategories ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : categoriesError ? (
              <ErrorState compact message={categoriesError} onRetry={refetchCategories} />
            ) : categories.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                Aucune catégorie configurée. Contactez un administrateur.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    def={cat}
                    selected={categoryId === cat.id}
                    onSelect={() => setCategoryId(cat.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── D. Priority Segmented Control ─────── */}
          <section>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Priorité
            </label>
            <PriorityControl value={priority} onChange={setPriority} />
            {categoryId != null && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Suggestion automatique basée sur la catégorie sélectionnée
              </p>
            )}
          </section>

          {/* ── E. Description + Voice + Presets ──── */}
          <section>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description
            </label>

            {/* Category-scoped preset chips */}
            {categoryId != null && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {categories.find((c) => c.id === categoryId)?.presets.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() =>
                      setDescription((prev) =>
                        prev ? `${prev}. ${phrase}` : phrase,
                      )
                    }
                    className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-[0.95]"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            )}

            {/* Textarea + Mic button */}
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'incident…"
                rows={3}
                className={cn(
                  'w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700',
                  'bg-white dark:bg-slate-900 p-3 pr-12 text-sm',
                  'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent',
                )}
              />
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                title={isListening ? 'Arrêter la dictée' : 'Dicter'}
                className={cn(
                  'absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                  'active:scale-[0.9]',
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
          </section>

          {/* Spacer for sticky bar */}
          <div className="h-4" />
        </div>
      </div>

      {/* ── F. Sticky Action Bar ─────────────────── */}
      {/* Sticky (not fixed) so it stays inside the scroll container and never
          overlaps the admin sidebar or the mobile bottom nav. */}
      <div className="sticky bottom-0 z-50 border-t border-slate-200 dark:border-slate-800 bg-white/95 p-4 backdrop-blur dark:bg-slate-900/95 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(draftKey);
            router.back();
          }}
          className="rounded-xl px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className={cn(
            'rounded-lg px-5 py-2.5 text-sm font-medium transition-colors',
            isValid && !isSubmitting
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          )}
        >
          <span className="inline-flex items-center justify-center gap-1.5 min-w-[80px]">
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Envoi…
              </>
            ) : (
              <>Confirmer</>
            )}
          </span>
        </button>
      </div>

      {/* ── Success Toast ────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-2 fade-in">
          <div className="rounded-xl bg-emerald-600 text-white px-5 py-3 shadow-2xl flex items-center gap-3">
            <Check className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}
    </>
  );
}
