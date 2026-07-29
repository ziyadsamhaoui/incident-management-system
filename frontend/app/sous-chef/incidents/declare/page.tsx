'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Mic,
  MicOff,
  PlusCircle,
  Check,
  Wrench,
  Shield,
  Zap,
  MessageSquare,
  Factory,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';


// ── Constants ─────────────────────────────────────

const DRAFT_KEY = 'sous_chef_incident_draft';

const STATIONS = [
  'Poste 1 — Assemblage',
  'Poste 2 — Soudure',
  'Poste 3 — Contrôle',
  'Poste 4 — Emballage',
];

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  defaultPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  presets: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'Sécurité',
    label: 'Sécurité',
    icon: <Shield className="h-8 w-8" />,
    defaultPriority: 'CRITICAL',
    presets: ['Sol glissant', 'Équipement défectueux', 'Zone non sécurisée', 'Fuite de produit'],
  },
  {
    id: 'Accident',
    label: 'Accident',
    icon: <Wrench className="h-8 w-8" />,
    defaultPriority: 'HIGH',
    presets: ['Coupure légère', 'Choc/impact', 'Brûlure', 'Malaise'],
  },
  {
    id: 'Panne',
    label: 'Panne technique',
    icon: <Zap className="h-8 w-8" />,
    defaultPriority: 'MEDIUM',
    presets: ['Ligne arrêtée', 'Surchauffe moteur', 'Fuite d\'huile', 'Défaut électrique'],
  },
  {
    id: 'Réclamation',
    label: 'Réclamation',
    icon: <MessageSquare className="h-8 w-8" />,
    defaultPriority: 'LOW',
    presets: ['Pièce non conforme', 'Retard livraison', 'Document manquant', 'Défaut qualité'],
  },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Faible' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'HIGH', label: 'Élevée' },
  { value: 'CRITICAL', label: 'Critique' },
] as const;

// ── Types ─────────────────────────────────────────

interface DraftState {
  station: string;
  category: string;
  priority: string;
  description: string;
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
  def: CategoryDef;
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

// ── Page ──────────────────────────────────────────

export default function DeclareIncidentPage() {
  const router = useRouter();
  const { departmentName } = useAuthStore();
  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();

  // ── Form state ──────────────────────────────────
  const [station, setStation] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');

  // ── Submit / toast ──────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isValid = station !== '' && category !== '';

  // ── Auto-priority from category ─────────────────
  useEffect(() => {
    if (!category) return;
    const def = CATEGORIES.find((c) => c.id === category);
    if (def) setPriority(def.defaultPriority);
  }, [category]);

  // ── Draft persistence ───────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: DraftState = JSON.parse(raw);
        if (draft.station) setStation(draft.station);
        if (draft.category) setCategory(draft.category);
        if (draft.priority) setPriority(draft.priority);
        if (draft.description) setDescription(draft.description);
      }
    } catch {
      // Corrupted draft — ignore
    }
  }, []);

  // Auto-save on every change
  useEffect(() => {
    const draft: DraftState = { station, category, priority, description };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [station, category, priority, description]);

  // ── Voice transcript integration ────────────────
  useEffect(() => {
    if (transcript) {
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // ── Submit handler ──────────────────────────────
  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));

    // Clear draft
    localStorage.removeItem(DRAFT_KEY);

    // Generate reference number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const refNumber = Math.floor(Math.random() * 9) + 1;
    const reference = `INC-${today}-000${refNumber}`;

    // Show success toast and redirect
    setToastMessage(`Incident ${reference} créé avec succès`);
    setTimeout(() => {
      router.push('/sous-chef');
    }, 200);
  };

  return (
    <>
      {/* ── Page Header ──────────────────────────── */}
      <div className="max-w-2xl mx-auto">
        <div className="space-y-5 pb-36">
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

          {/* ── A. Department Chip ────────────────── */}
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <Factory className="h-3.5 w-3.5" />
            Département : {departmentName ?? 'Non assigné'}
          </div>

          {/* ── B. Station Selector ───────────────── */}
          <section>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Poste de travail
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {STATIONS.map((s) => (
                <StationChip
                  key={s}
                  label={s}
                  selected={station === s}
                  onSelect={() => setStation(s)}
                />
              ))}
            </div>
          </section>

          {/* ── C. Category Selector ──────────────── */}
          <section>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Type d&apos;incident
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <CategoryTile
                  key={cat.id}
                  def={cat}
                  selected={category === cat.id}
                  onSelect={() => setCategory(cat.id)}
                />
              ))}
            </div>
          </section>

          {/* ── D. Priority Segmented Control ─────── */}
          <section>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Priorité
            </label>
            <PriorityControl value={priority} onChange={setPriority} />
            {category && (
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
            {category && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {CATEGORIES.find((c) => c.id === category)?.presets.map((phrase) => (
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
      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between z-50">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(DRAFT_KEY);
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
