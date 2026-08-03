'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  User,
  Building2,
  Shield,
  Sun,
  Moon,
  ArrowLeft,
  Languages,
  CheckCircle2,
  Globe,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n';
import { useAsync, extractErrorMessage } from '@/lib/use-async';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDepartments } from '@/services/referenceService';
import { setMyDepartment } from '@/services/userService';

//  Language options

const LANG_OPTIONS = [
  { value: 'FR', label: 'FR - Français', flag: '🇫🇷' },
  { value: 'AR', label: 'AR - العربية', flag: '🇲🇦' },
];

//  Theme options (no System mode)

const THEME_OPTIONS = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
];

//  Card-based picker

interface PickerCardProps {
  value: string;
  current: string;
  onChange: (val: string) => void;
  children: React.ReactNode;
}

function PickerCard({ value, current, onChange, children }: PickerCardProps) {
  const isActive = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-150 w-full',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600',
      )}
    >
      {children}
      {isActive && (
        <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-primary" />
      )}
    </button>
  );
}

//  Page

export default function ChefAtelierSettingsPage() {
  const router = useRouter();
  const {
    firstName,
    lastName,
    matricule,
    roles,
    departmentName,
    departmentId,
    setDepartment,
  } = useAuthStore();

  const { lang, setLang } = useTranslation();
  const { theme, setTheme } = useTheme();

  // Department state — real list from the API + save feedback
  const {
    data: departments,
    loading: depsLoading,
    error: depsError,
    refetch: refetchDeps,
  } = useAsync(getDepartments, []);
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptSuccess, setDeptSuccess] = useState(false);

  const primaryRole = (roles[0]?.replace('ROLE_', '') ?? '') as string;

  const roleLabel =
    primaryRole === 'CHEF_ATELIER'
      ? "Chef d'atelier"
      : 'Opérateur';

  //  Department change — persisted to the backend, not definitive
  const handleDepartmentChange = useCallback(
    async (value: string) => {
      if (!value || value === departmentId) return;
      const deptId = Number(value);
      const dept = departments?.find((d) => d.id === deptId);

      setDeptSaving(true);
      setDeptError(null);
      setDeptSuccess(false);
      try {
        await setMyDepartment({ departmentId: deptId });
        setDepartment(String(deptId), dept?.name ?? value);
        setDeptSuccess(true);
        window.setTimeout(() => setDeptSuccess(false), 2500);
      } catch (err) {
        setDeptError(extractErrorMessage(err));
      } finally {
        setDeptSaving(false);
      }
    },
    [departmentId, departments, setDepartment],
  );

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-0 sm:py-8 space-y-5">
      {/*  Back button + header  */}
      <div>
        <button
          onClick={() => router.back()}
          className="group mb-3 inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Retour
        </button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Paramètres</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Gérez votre profil et vos préférences
        </p>
      </div>

      {/*  Identity Card  */}
      <Card>
        <CardHeader className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:h-10 sm:w-10">
              <User className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Identité</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Vos informations personnelles
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          {/* Row 1: Prénom · Nom (locked for chef-atelier) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Prénom
              </label>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium truncate">
                {firstName ?? '—'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Nom
              </label>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium truncate">
                {lastName ?? '—'}
              </div>
            </div>
          </div>

          {/* Row 2: Matricule · Département (changeable) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Matricule
              </label>
              <div className="flex h-9 w-full items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-3 font-mono text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Shield className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>#{matricule ?? '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Département
              </label>
              {depsLoading ? (
                <div className="flex h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Chargement...</span>
                </div>
              ) : depsError ? (
                <div className="flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Échec du chargement</span>
                  <button
                    type="button"
                    onClick={refetchDeps}
                    className="shrink-0 font-medium underline underline-offset-2 hover:text-red-900 dark:hover:text-red-300"
                  >
                    Réessayer
                  </button>
                </div>
              ) : departments && departments.length > 0 ? (
                <Select
                  value={departmentId ?? ''}
                  onValueChange={handleDepartmentChange}
                  disabled={deptSaving}
                >
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue placeholder="Sélectionner un département..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-xs italic">
                    {departmentName ?? 'Aucun département disponible'}
                  </span>
                </div>
              )}
              {deptSaving && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enregistrement...
                </p>
              )}
              {deptSuccess && (
                <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Département mis à jour.
                </p>
              )}
              {deptError && (
                <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{deptError}</span>
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Vous pouvez changer de département à tout moment.
              </p>
            </div>
          </div>

          {/* Rôle */}
          <div className="space-y-2">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Rôle :
            </label>
            <Badge variant="secondary" className="mt-0.5 gap-1.5 capitalize">
              <Shield className="h-3 w-3" />
              {roleLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/*  Language & Theme Card  */}
      <Card>
        <CardHeader className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:h-10 sm:w-10">
              <Globe className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Langue & Thème</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Personnalisez l&apos;affichage
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-4 pb-5 sm:px-6">
          {/*  Language  */}
          <div className="space-y-2.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              Langue d&apos;affichage
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {LANG_OPTIONS.map((opt) => (
                <PickerCard
                  key={opt.value}
                  value={opt.value}
                  current={lang}
                  onChange={(v) => setLang(v as 'FR' | 'AR')}
                >
                  <span className="text-xl sm:text-2xl">{opt.flag}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {opt.value === 'FR' ? 'Français' : 'العربية'}
                    </p>
                  </div>
                </PickerCard>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700" />

          {/*  Theme  */}
          <div className="space-y-2.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              Thème
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <PickerCard
                    key={opt.value}
                    value={opt.value}
                    current={theme ?? 'light'}
                    onChange={(v) => setTheme(v)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted sm:h-10 sm:w-10">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-sm font-medium">{opt.label}</p>
                  </PickerCard>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
