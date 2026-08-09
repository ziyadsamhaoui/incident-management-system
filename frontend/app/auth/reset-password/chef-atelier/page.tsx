'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import type { AxiosError } from 'axios';
import { ResetPasswordShell } from '@/components/auth/reset-password-shell';
import { CountdownTimer } from '@/components/auth/countdown-timer';
import { useTranslation } from '@/lib/i18n';
import { requestPasswordResetManual } from '@/services/authService';

const inputClass = [
  'block w-full rounded-xl border px-4 py-3 text-sm transition-colors',
  'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400',
  'focus:border-[#0F62FE] focus:outline-none focus:ring-2 focus:ring-[#0F62FE]/20',
  'dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500',
  'dark:focus:border-blue-500 dark:focus:ring-blue-500/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const errorTextClass = 'mt-1.5 text-xs font-medium text-red-500 dark:text-red-400';

export default function ChefAtelierResetPage() {
  const router = useRouter();
  const { lang, setLang, t: fl, isRtl } = useTranslation();

  const [matricule, setMatricule] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generic error — NEVER reveals which field failed (anti-enumeration).
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state — the one-shot code + 15-minute countdown.
  const [code, setCode] = useState<{ token: string; expiresAt: string } | null>(null);
  const [expired, setExpired] = useState(false);

  // 429 retry-after countdown
  const [retryAfter, setRetryAfter] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (retryAfter > 0) {
      countdownRef.current = setInterval(() => {
        setRetryAfter((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [retryAfter]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const errs: Record<string, string> = {};
      if (!matricule.trim() || !/^\d+$/.test(matricule.trim())) errs.matricule = fl.resetFieldRequired;
      if (!firstName.trim()) errs.firstName = fl.resetFieldRequired;
      if (!lastName.trim()) errs.lastName = fl.resetFieldRequired;
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      setFieldErrors({});
      setExpired(false);

      try {
        const data = await requestPasswordResetManual(
          Number(matricule.trim()),
          firstName.trim(),
          lastName.trim(),
        );
        setCode({
          token: data.token,
          expiresAt: new Date(Date.now() + data.expiresInMinutes * 60_000).toISOString(),
        });
      } catch (err) {
        const axiosErr = err as AxiosError;
        if (axiosErr?.response?.status === 429) {
          const retryAfterHeader = axiosErr.response.headers?.['retry-after'];
          const seconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : 60;
          setRetryAfter(Number.isNaN(seconds) ? 60 : seconds);
          return; // Rate-limited — never show the generic identity error for this.
        }
        // Mismatch / unknown matricule / any other failure → identical generic copy.
        setErrorMessage(fl.invalidIdentifiers);
      } finally {
        setIsSubmitting(false);
      }
    },
    [matricule, firstName, lastName, fl],
  );

  const continueToConfirm = useCallback(() => {
    if (!code) return;
    router.push(
      `/auth/reset-password/confirm?code=${encodeURIComponent(code.token)}&matricule=${encodeURIComponent(matricule.trim())}`,
    );
  }, [code, matricule, router]);

  const resetForm = useCallback(() => {
    setCode(null);
    setExpired(false);
    setErrorMessage(null);
  }, []);

  const isRateLimited = retryAfter > 0;
  const canContinue = code !== null && !expired;

  return (
    <ResetPasswordShell
      language={lang}
      onLanguageChange={setLang}
      isRtl={isRtl}
      icon={<KeyRound className="h-7 w-7 text-white" aria-hidden="true" />}
      title={fl.chefResetTitle}
      subtitle={fl.chefResetSubtitle}
      footer={
        <div className="text-center">
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F62FE] transition-colors hover:text-[#0353E9] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {fl.resetBackToLogin}
          </a>
        </div>
      }
    >
      {code === null ? (
        /* ── Identity bar form ─────────────────────── */
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="matricule" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.matricule}
              </label>
              <input
                id="matricule"
                type="text"
                inputMode="numeric"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder={fl.matriculePlaceholder}
                disabled={isSubmitting || isRateLimited}
                className={inputClass}
              />
              {fieldErrors.matricule && <p className={errorTextClass}>{fieldErrors.matricule}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {fl.firstName}
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={fl.firstNamePlaceholder}
                  disabled={isSubmitting || isRateLimited}
                  className={inputClass}
                />
                {fieldErrors.firstName && <p className={errorTextClass}>{fieldErrors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {fl.lastName}
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={fl.lastNamePlaceholder}
                  disabled={isSubmitting || isRateLimited}
                  className={inputClass}
                />
                {fieldErrors.lastName && <p className={errorTextClass}>{fieldErrors.lastName}</p>}
              </div>
            </div>

            {/* Generic error — no field-specific disclosure */}
            {errorMessage && !isRateLimited && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                <p>{errorMessage}</p>
              </div>
            )}

            {isRateLimited && (
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                <p>
                  {fl.resetRateLimited}{' '}
                  <span className="font-mono font-bold">{retryAfter}s</span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isRateLimited}
              className={[
                'flex w-full items-center justify-center rounded-xl py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 dark:shadow-none transition-all duration-200',
                isSubmitting || isRateLimited
                  ? 'cursor-not-allowed bg-[#0F62FE]/60 dark:bg-blue-700/60'
                  : 'bg-[#0F62FE] hover:bg-[#0353E9] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500',
              ].join(' ')}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {fl.chefResetSubmitting}
                </span>
              ) : (
                fl.chefResetSubmit
              )}
            </button>

            {/* Secondary guidance copy */}
            <p className="text-center text-xs text-gray-400 dark:text-slate-500">
              {fl.resetBlockedHelp}
            </p>
          </div>
        </form>
      ) : (
        /* ── Code issued — one-shot display + countdown ── */
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-medium">{fl.resetCodeBadge}</p>
            </div>
            <p className="mt-4 font-mono text-4xl font-bold tracking-[0.3em] text-gray-900 dark:text-slate-100">
              {code.token}
            </p>
            {/* Active 15-minute expiration countdown */}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-muted-foreground text-gray-600 dark:text-slate-400">
                {fl.resetCodeExpiresLabel}
              </span>
              <CountdownTimer expiresAt={code.expiresAt} onExpire={() => setExpired(true)} />
            </div>
          </div>

          {expired ? (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
              <p>{fl.resetCodeExpired}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={continueToConfirm}
              className="flex w-full items-center justify-center rounded-xl bg-[#0F62FE] py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 dark:shadow-none transition-all duration-200 hover:bg-[#0353E9] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {fl.resetContinue}
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            {fl.resetRequestNewCode}
          </button>

          <p className="text-center text-xs text-gray-400 dark:text-slate-500">
            {fl.resetBlockedHelp}
          </p>
        </div>
      )}
    </ResetPasswordShell>
  );
}
