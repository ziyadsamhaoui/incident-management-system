'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Eye, EyeOff, Lock, AlertTriangle, Clock, ArrowLeft, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { adminLogin } from '@/services/authService';
import { useTranslation } from '@/lib/i18n';
import { adminLoginSchema, type AdminLoginFormValues } from '@/lib/schemas';

// Shared Input Class

const inputClass = [
  'block w-full rounded-xl border px-4 py-3 text-sm transition-colors',
  'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400',
  'focus:border-[#0F62FE] focus:outline-none focus:ring-2 focus:ring-[#0F62FE]/20',
  'dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500',
  'dark:focus:border-blue-500 dark:focus:ring-blue-500/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const errorTextClass = 'mt-1.5 text-xs font-medium text-red-500 dark:text-red-400';

// Grid animation : moving lines (80px tiles, 12s loop) + pulsing glow

const gridAnimation = {
  backgroundPosition: ['0px 0px', '80px 80px'],
};

const gridTransition = {
  duration: 12,
  ease: 'linear' as const,
  repeat: Infinity,
  repeatType: 'loop' as const,
};

const glowAnimation = {
  opacity: [0.6, 1, 0.6],
};

const glowTransition = {
  duration: 6,
  ease: 'easeInOut' as const,
  repeat: Infinity,
  repeatType: 'mirror' as const,
};

export default function AdminLoginPage() {
  const router = useRouter();
  const loginSucceeded = useAuthStore((s) => s.loginSucceeded);
  const setLockoutEnd = useAuthStore((s) => s.setLockoutEnd);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { resolvedTheme } = useTheme();
  const { lang, setLang, t: fl, isRtl } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate-limit countdown
  const [retryAfter, setRetryAfter] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lockout countdown
  const [lockoutTimer, setLockoutTimer] = useState<string | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Rate-limit interval
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

  // Lockout countdown interval
  useEffect(() => {
    if (!lockoutTimer) {
      setLockoutCountdown('');
      return;
    }
    const end = new Date(lockoutTimer).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (remaining <= 0) {
        setLockoutTimer(null);
        setLockoutCountdown('');
        setErrorMessage(null);
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setLockoutCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockoutTimer]);

  const onSubmit = useCallback(
    async (data: AdminLoginFormValues) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const response = await adminLogin(data.email, data.password);
        loginSucceeded(response, 'ADMIN');
        useAuthStore.getState().setUserIdentity(data.email.split('@')[0], '');
        router.replace('/dashboard');
      } catch (err: any) {
        if (err?.code === 'LOCKED') {
          setLockoutTimer(err.lockoutEnd);
          setErrorMessage(err.message);
          setLockoutEnd(err.lockoutEnd);
        } else if (err?.code === 'RATE_LIMITED') {
          setRetryAfter(err.retryAfterSeconds);
          setErrorMessage(err.message);
        } else {
          setErrorMessage(err?.message ?? fl.errorAuth);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [loginSucceeded, setLockoutEnd, router, fl.errorAuth],
  );

  const isLocked = lockoutTimer !== null;
  const isRateLimited = retryAfter > 0;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6"
    >
      {/* Background layer: solid color + glow + moving grid */}
      <div className="fixed inset-0 z-0">
        {/* Solid base color */}
        <div className="absolute inset-0 bg-white dark:bg-slate-900 lg:bg-slate-50/60 lg:dark:bg-slate-950" />
        {/* Radial glow */}
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: resolvedTheme === 'dark'
              ? `radial-gradient(ellipse at 15% 85%, rgba(59, 130, 246, 0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 15%, rgba(59, 130, 246, 0.05) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.03) 0%, transparent 60%)`
              : `radial-gradient(ellipse at 15% 85%, rgba(15, 98, 254, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 15%, rgba(15, 98, 254, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(3, 83, 233, 0.04) 0%, transparent 60%)`,
          }}
          animate={glowAnimation}
          transition={glowTransition}
        />
        {/* Moving grid */}
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: resolvedTheme === 'dark'
              ? [
                  'repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(59, 130, 246, 0.12) 79px, rgba(59, 130, 246, 0.12) 80px)',
                  'repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(59, 130, 246, 0.12) 79px, rgba(59, 130, 246, 0.12) 80px)',
                ].join(', ')
              : [
                  'repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(15, 98, 254, 0.05) 79px, rgba(15, 98, 254, 0.05) 80px)',
                  'repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(15, 98, 254, 0.05) 79px, rgba(15, 98, 254, 0.05) 80px)',
                ].join(', '),
          }}
          animate={gridAnimation}
          transition={gridTransition}
        />
      </div>
      {/* Back button — minimal floating icon */}
      <div className="fixed left-4 top-4 z-20 lg:left-6 lg:top-6">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm backdrop-blur transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
          aria-label={fl.backToFloor}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Language & Theme Controls */}
      <div className="fixed right-4 top-4 z-20 lg:right-6 lg:top-6">
        <div dir="ltr" className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            {(['FR', 'AR'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={[
                  'px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 lg:px-3 lg:py-2 lg:text-sm',
                  lang === l
                    ? 'bg-[#0F62FE] text-white dark:bg-blue-600'
                    : 'bg-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                ].join(' ')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card / Full-bleed container */}
      <div
        className={[
          'relative z-10',
          'w-full max-w-sm sm:max-w-xl lg:max-w-md',
          // LG+ card mode
          'lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-xl lg:shadow-slate-200/50 lg:dark:border-slate-800 lg:dark:bg-slate-900 lg:dark:shadow-none',
          // SM/MD full-bleed (surface matches outer wrapper)
          'max-lg:min-h-screen max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none',
          'p-6 sm:p-10 lg:p-8',
        ].join(' ')}
      >
        {/* Shield Badge */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F62FE] to-[#0353E9] shadow-md shadow-blue-500/20 dark:shadow-blue-500/30">
            <Shield className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-slate-100">
          {fl.adminLoginTitle}
        </h1>
        <p className="mt-1.5 text-center text-sm text-gray-600 dark:text-slate-400">
          {fl.adminLoginSubtitle}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7" noValidate>
          <div className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.email}
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                placeholder={fl.emailPlaceholder}
                disabled={isSubmitting || isLocked || isRateLimited}
                className={inputClass}
              />
              {errors.email && <p className={errorTextClass}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder={fl.passwordPlaceholder}
                  disabled={isSubmitting || isLocked || isRateLimited}
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
              {errors.password && <p className={errorTextClass}>{errors.password.message}</p>}
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-[#0F62FE] transition-colors hover:text-[#0353E9] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {fl.forgotPassword}
              </button>
            </div>

            {/* Error alert */}
            {errorMessage && (
              <div
                className={[
                  'flex items-start gap-3 rounded-xl px-4 py-3 text-sm',
                  isLocked
                    ? 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
                    : isRateLimited
                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
                ].join(' ')}
              >
                {isLocked ? (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" />
                ) : isRateLimited ? (
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {isLocked ? fl.errorLocked : isRateLimited ? fl.errorRateLimited : fl.errorAuth}
                  </p>
                  <p className="mt-0.5 text-xs opacity-80">
                    {errorMessage}
                    {isLocked && lockoutCountdown && (
                      <span className="ml-1 font-mono font-bold">
                        {fl.unlockIn} {lockoutCountdown}
                      </span>
                    )}
                    {isRateLimited && (
                      <span className="ml-1 font-mono font-bold">
                        {fl.retryIn} {retryAfter}s
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting || isLocked || isRateLimited}
              className={[
                'flex w-full items-center justify-center rounded-xl py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200',
                isSubmitting || isLocked || isRateLimited
                  ? 'cursor-not-allowed bg-[#0F62FE]/60 dark:bg-blue-700/60'
                  : 'bg-[#0F62FE] hover:bg-[#0353E9] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500',
              ].join(' ')}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {fl.adminLoginSubmitting}
                </span>
              ) : isLocked ? (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {fl.locked} ({lockoutCountdown})
                </span>
              ) : isRateLimited ? (
                <span className="flex items-center gap-2">
                  {fl.rateLimited} ({retryAfter}s)
                </span>
              ) : (
                fl.adminLoginSubmit
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
