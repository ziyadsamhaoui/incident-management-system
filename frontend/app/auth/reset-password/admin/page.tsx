'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { AxiosError } from 'axios';
import { ResetPasswordShell } from '@/components/auth/reset-password-shell';
import { useTranslation } from '@/lib/i18n';
import { requestPasswordResetEmail } from '@/services/authService';

const inputClass = [
  'block w-full rounded-xl border px-4 py-3 text-sm transition-colors',
  'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400',
  'focus:border-[#0F62FE] focus:outline-none focus:ring-2 focus:ring-[#0F62FE]/20',
  'dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500',
  'dark:focus:border-blue-500 dark:focus:ring-blue-500/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const errorTextClass = 'mt-1.5 text-xs font-medium text-red-500 dark:text-red-400';

export default function AdminResetPage() {
  const { lang, setLang, t: fl, isRtl } = useTranslation();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Neutral success state — identical whether or not the address exists.
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

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

      const trimmed = email.trim();
      // Local format guard only — it does not reveal DB state (anti-enumeration).
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setFieldError(fl.resetFieldRequired);
        return;
      }

      setIsSubmitting(true);
      setFieldError(null);

      try {
        const data = await requestPasswordResetEmail(trimmed);
        // ALWAYS the same neutral outcome — the backend never distinguishes.
        setSent(true);
        setDevToken(data.token ?? null);
      } catch (err) {
        const axiosErr = err as AxiosError;
        if (axiosErr?.response?.status === 429) {
          const retryAfterHeader = axiosErr.response.headers?.['retry-after'];
          const seconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : 60;
          setRetryAfter(Number.isNaN(seconds) ? 60 : seconds);
          return;
        }
        // Any other failure (network, 4xx, 5xx) → neutral notice anyway:
        // the response shape must never leak email existence.
        setSent(true);
        setDevToken(null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, fl],
  );

  const isRateLimited = retryAfter > 0;

  return (
    <ResetPasswordShell
      language={lang}
      onLanguageChange={setLang}
      isRtl={isRtl}
      icon={<ShieldCheck className="h-7 w-7 text-white" aria-hidden="true" />}
      title={fl.adminResetTitle}
      subtitle={fl.adminResetSubtitle}
      footer={
        <div className="text-center">
          <a
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F62FE] transition-colors hover:text-[#0353E9] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {fl.resetBackToLogin}
          </a>
        </div>
      }
    >
      {!sent ? (
        /* ── Email form ────────────────────────────── */
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.email}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={fl.emailPlaceholder}
                disabled={isSubmitting || isRateLimited}
                className={inputClass}
              />
              {fieldError && <p className={errorTextClass}>{fieldError}</p>}
            </div>

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
                'flex w-full items-center justify-center rounded-xl py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200',
                isSubmitting || isRateLimited
                  ? 'cursor-not-allowed bg-[#0F62FE]/60 dark:bg-blue-700/60'
                  : 'bg-[#0F62FE] hover:bg-[#0353E9] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500',
              ].join(' ')}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {fl.adminResetSubmitting}
                </span>
              ) : (
                fl.adminResetSubmit
              )}
            </button>
          </div>
        </form>
      ) : (
        /* ── Neutral success notice (always identical) ── */
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-semibold">{fl.adminResetSentTitle}</p>
            </div>
            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
              {fl.adminResetSent}
            </p>
          </div>

          {/* Dev-only stub token — only rendered when the backend echoes one. */}
          {devToken && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {fl.adminResetDevToken}
              </p>
              <p className="mt-1.5 break-all font-mono text-xs text-amber-800 dark:text-amber-300">
                {devToken}
              </p>
            </div>
          )}
        </div>
      )}
    </ResetPasswordShell>
  );
}
