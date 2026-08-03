'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldQuestion,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  LockKeyhole,
} from 'lucide-react';
import type { AxiosError } from 'axios';
import { ResetPasswordShell } from '@/components/auth/reset-password-shell';
import { useTranslation } from '@/lib/i18n';
import { confirmPasswordReset } from '@/services/authService';

const inputClass = [
  'block w-full rounded-xl border px-4 py-3 text-sm transition-colors',
  'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400',
  'focus:border-[#0F62FE] focus:outline-none focus:ring-2 focus:ring-[#0F62FE]/20',
  'dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500',
  'dark:focus:border-blue-500 dark:focus:ring-blue-500/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const errorTextClass = 'mt-1.5 text-xs font-medium text-red-500 dark:text-red-400';

/**
 * Heuristic: 6-char alphanumeric codes come from Track A / admin handoff
 * (CHEF_ATELIER lane); UUID tokens arrive via the Track B email deep link
 * (ADMIN lane). Used only to point the "request a new one" link to the right
 * request screen when the code turns out to be invalid/expired.
 */
function isChefCode(token: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(token.trim());
}

export default function ConfirmResetPage() {
  const router = useRouter();
  const { lang, setLang, t: fl, isRtl } = useTranslation();

  const [token, setToken] = useState('');
  const [matricule, setMatricule] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 400 → invalid/expired token; success → post-reset notice + redirect.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  // 429 retry-after countdown
  const [retryAfter, setRetryAfter] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill from query params (Track A: ?code=&matricule=, Track B: ?token=).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') ?? params.get('token') ?? '';
    if (code) setToken(code.trim());
    const mat = params.get('matricule');
    if (mat) setMatricule(mat.trim());
  }, []);

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

  // Live strength feedback (STRICT minimum: 8 characters, passwords must match).
  const lengthOk = newPassword.length >= 8;
  const matchOk = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = token.trim().length > 0 && lengthOk && matchOk && !isSubmitting;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const data = await confirmPasswordReset(token.trim(), newPassword);
        setSucceeded(true);
        // NO auto-login — route to the correct login lane with the identifier
        // pre-filled, then show the success notice during the transition.
        const target =
          data.role === 'ADMIN'
            ? `/admin/login?email=${encodeURIComponent(data.loginIdentifier)}`
            : `/login?lane=CHEF_ATELIER&matricule=${encodeURIComponent(data.loginIdentifier)}`;
        window.setTimeout(() => router.replace(target), 1800);
      } catch (err) {
        const axiosErr = err as AxiosError;
        if (axiosErr?.response?.status === 429) {
          const retryAfterHeader = axiosErr.response.headers?.['retry-after'];
          const seconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : 60;
          setRetryAfter(Number.isNaN(seconds) ? 60 : seconds);
          return;
        }
        // Client-side validation prevents short passwords, so any other 400
        // here is an invalid/expired/used token → explicit expired copy.
        setErrorMessage(fl.resetTokenExpired);
      } finally {
        setIsSubmitting(false);
      }
    },
    [canSubmit, token, newPassword, fl, router],
  );

  const isRateLimited = retryAfter > 0;
  // No token pre-filled → most likely an admin verbal handoff for a
  // CHEF_ATELIER account, so default the request-screen link to Track A.
  const fromChef = token.trim().length === 0 ? true : isChefCode(token);

  return (
    <ResetPasswordShell
      language={lang}
      onLanguageChange={setLang}
      isRtl={isRtl}
      icon={<ShieldQuestion className="h-7 w-7 text-white" aria-hidden="true" />}
      title={fl.confirmResetTitle}
      subtitle={fl.confirmResetSubtitle}
      footer={
        !succeeded && (
          <div className="text-center">
            <a
              href={fromChef ? '/auth/reset-password/chef-atelier' : '/auth/reset-password/admin'}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F62FE] transition-colors hover:text-[#0353E9] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {fl.resetBackToLogin}
            </a>
          </div>
        )
      }
    >
      {succeeded ? (
        /* ── Success — NO auto-login, explicit login required ── */
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {fl.resetSuccessTitle}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400/80">
              {fl.resetSuccessSubtitle}
            </p>
            <Loader2 className="mx-auto mt-4 h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5">
            {/* Token / code — pre-filled but editable */}
            <div className="space-y-1.5">
              <label htmlFor="reset-token" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.resetTokenLabel}
              </label>
              <input
                id="reset-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={fl.resetTokenPlaceholder}
                disabled={isSubmitting || isRateLimited}
                autoCapitalize="characters"
                className={`${inputClass} text-center font-mono text-base tracking-widest`}
              />
              {token.trim().length === 0 && (
                <p className={errorTextClass}>{fl.resetTokenRequired}</p>
              )}
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.newPassword}
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={fl.newPasswordPlaceholder}
                  disabled={isSubmitting || isRateLimited}
                  className={`${inputClass} pe-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                  tabIndex={-1}
                  aria-label={showPassword ? fl.hidePassword : fl.showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Inline strength feedback — length requirement */}
              <p
                className={[
                  'flex items-center gap-1.5 text-xs font-medium',
                  newPassword.length === 0
                    ? 'text-gray-400 dark:text-slate-500'
                    : lengthOk
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400',
                ].join(' ')}
              >
                {newPassword.length === 0 ? (
                  <LockKeyhole className="h-3.5 w-3.5" />
                ) : lengthOk ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {fl.resetPasswordMin}
              </p>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.confirmPassword}
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={fl.confirmPasswordPlaceholder}
                  disabled={isSubmitting || isRateLimited}
                  className={`${inputClass} pe-12`}
                />
              </div>
              {/* Inline strength feedback — match requirement */}
              {confirmPassword.length > 0 && (
                <p
                  className={[
                    'flex items-center gap-1.5 text-xs font-medium',
                    matchOk
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400',
                  ].join(' ')}
                >
                  {matchOk ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {matchOk ? fl.resetPasswordMatch : fl.resetPasswordMismatch}
                </p>
              )}
            </div>

            {/* Expired / invalid token — explicit copy + links back */}
            {errorMessage && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                <div className="space-y-1">
                  <p>{errorMessage}</p>
                  <p className="text-xs opacity-90">
                    <a
                      href="/auth/reset-password/chef-atelier"
                      className="font-semibold underline decoration-red-400 underline-offset-2 hover:text-red-900 dark:hover:text-red-200"
                    >
                      {fl.resetRequestChefLink}
                    </a>
                    {' · '}
                    <a
                      href="/auth/reset-password/admin"
                      className="font-semibold underline decoration-red-400 underline-offset-2 hover:text-red-900 dark:hover:text-red-200"
                    >
                      {fl.resetRequestAdminLink}
                    </a>
                  </p>
                </div>
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

            {/* Submit — kept disabled until length + match requirements pass */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={[
                'flex w-full items-center justify-center rounded-xl py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200',
                !canSubmit
                  ? 'cursor-not-allowed bg-[#0F62FE]/50 dark:bg-blue-700/50'
                  : 'bg-[#0F62FE] hover:bg-[#0353E9] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500',
              ].join(' ')}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {fl.resetConfirmSubmitting}
                </span>
              ) : (
                fl.resetConfirmSubmit
              )}
            </button>

            <p className="text-center text-xs text-gray-400 dark:text-slate-500">
              {fl.resetPasswordMinHint}
            </p>
          </div>
        </form>
      )}
    </ResetPasswordShell>
  );
}
