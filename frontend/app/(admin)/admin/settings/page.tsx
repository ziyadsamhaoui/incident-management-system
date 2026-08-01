'use client';

import { useState } from 'react';
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
  Mail,
  Lock,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ── Language options ──────────────────────────────

const LANG_OPTIONS = [
  { value: 'FR', label: 'FR - Français', flag: '🇫🇷' },
  { value: 'AR', label: 'AR - العربية', flag: '🇲🇦' },
];

// ── Theme options ──────────────────────────────────

const THEME_OPTIONS = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
];

// ── PickerCard ─────────────────────────────────────

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

// ── Page ───────────────────────────────────────────

export default function AdminSettingsPage() {
  const router = useRouter();
  const {
    firstName,
    lastName,
    matricule,
    departmentName,
  } = useAuthStore();

  const { lang, setLang } = useTranslation();
  const { theme, setTheme } = useTheme();

  // ── Form state ──────────────────────────────────
  const [formValues, setFormValues] = useState({
    firstName: firstName ?? '',
    lastName: lastName ?? '',
    email: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);

    // Validate password
    if (newPassword && newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    // Mock save
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-0 sm:py-8 space-y-5">
      {/* ── Back button + header ──────────────────── */}
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
          Gérez votre profil administrateur
        </p>
      </div>

      {/* ── Error banner ─────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Profile Card ─────────────────────────── */}
      <Card>
        <CardHeader className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:h-10 sm:w-10">
              <User className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Profil</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Vos informations personnelles
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          {/* Prénom · Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Prénom
              </label>
              <input
                type="text"
                value={formValues.firstName}
                onChange={(e) => setFormValues((v) => ({ ...v, firstName: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Votre prénom"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Nom
              </label>
              <input
                type="text"
                value={formValues.lastName}
                onChange={(e) => setFormValues((v) => ({ ...v, lastName: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Votre nom"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={formValues.email}
                onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))}
                className="w-full rounded-lg border bg-background pl-10 pr-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="admin@icglma.ma"
              />
            </div>
          </div>

          {/* Matricule + Département (same row) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Matricule
              </label>
              <div className="flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-3 font-mono text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Shield className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>#{matricule ?? '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Département
              </label>
              <div className="flex h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>{departmentName ?? 'Non assigné'}</span>
              </div>
            </div>
          </div>

          {/* Rôle */}
          <div className="space-y-1">
            <label className="mb-2 block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Rôle :
            </label>
            <Badge variant="secondary" className="mt-0.5 gap-1.5 capitalize">
              <Shield className="h-3 w-3" />
              Administrateur
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Password Card ────────────────────────── */}
      <Card>
        <CardHeader className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:h-10 sm:w-10">
              <Lock className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Mot de passe</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Modifiez votre mot de passe de connexion
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          {/* Current password */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Mot de passe actuel
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border bg-background pl-10 pr-10 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Votre mot de passe actuel"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Nouveau mot de passe
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Minimum 6 caractères"
            />
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Confirmer le mot de passe
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Répétez le nouveau mot de passe"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ──────────────────────────── */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className={cn(
            'gap-2 transition-all',
            saved
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white',
          )}
          size="sm"
        >
          <Save className="h-4 w-4" />
          {saved ? 'Enregistré ✓' : 'Enregistrer les modifications'}
        </Button>
      </div>

      {/* ── Language & Theme Card ─────────────────── */}
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
          {/* Language */}
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

          {/* Theme */}
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
