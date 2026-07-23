'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, AlertTriangle, Clock } from 'lucide-react';
import { LoginFormShell } from '@/components/login/login-form-shell';
import { useAuthStore } from '@/store/useAuthStore';
import { login } from '@/services/authService';
import { useTranslation } from '@/lib/i18n';
import { loginSchema, type LoginFormValues } from '@/lib/schemas';
import type { AuthLane } from '@/types/auth';

// Shared Input Class

const inputClass = [
  'block w-full rounded-xl border px-4 py-3 text-sm transition-colors',
  'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400',
  'focus:border-[#0F62FE] focus:outline-none focus:ring-2 focus:ring-[#0F62FE]/20',
  'dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500',
  'dark:focus:border-blue-500 dark:focus:ring-blue-500/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

// Error text class

const errorTextClass = 'mt-1.5 text-xs font-medium text-red-500 dark:text-red-400';

// Page Component

export default function LoginPage() {
  const router = useRouter();
  const loginSucceeded = useAuthStore((s) => s.loginSucceeded);
  const setLockoutEnd = useAuthStore((s) => s.setLockoutEnd);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { lang, setLang, t: fl, laneLabel, isRtl } = useTranslation();

  const [activeLane, setActiveLane] = useState<AuthLane>('SOUS_CHEF');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate-limit countdown
  const [retryAfter, setRetryAfter] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lockout countdown
  const [lockoutTimer, setLockoutTimer] = useState<string | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState('');

  // React Hook Form + Zod
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { lane: 'SOUS_CHEF' } as LoginFormValues,
  });

  // Sync form lane when user switches tabs
  useEffect(() => {
    setValue('lane', activeLane);
  }, [activeLane, setValue]);

  // Clear errors when switching lanes
  useEffect(() => {
    setErrorMessage(null);
  }, [activeLane]);

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

  // Lane switch — reset clears fields, values prop syncs lane automatically
  const handleLaneChange = useCallback((lane: AuthLane) => {
    setActiveLane(lane);
    reset({ lane, matricule: '', firstName: '', lastName: '', email: '', password: '' } as LoginFormValues);
  }, [reset]);

  // Submit handler — react-hook-form validated
  const onSubmit = useCallback(
    async (data: LoginFormValues) => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        // Build credentials based on lane — TS narrows via data.lane directly
        const credentials: Record<string, string> = {};

        if (data.lane === 'SOUS_CHEF' || data.lane === 'CHEF_ATELIER') {
          credentials.matricule = data.matricule;
          credentials.firstName = data.firstName;
          credentials.lastName = data.lastName;
          if (data.lane === 'CHEF_ATELIER') {
            credentials.password = data.password;
          }
        }
        if (data.lane === 'ADMIN') {
          credentials.email = data.email;
          credentials.password = data.password;
        }

        const response = await login(credentials);
        loginSucceeded(response, data.lane);
        const displayName = data.lane === 'ADMIN'
          ? data.email.split('@')[0]
          : data.firstName!;
        useAuthStore.getState().setUserIdentity(displayName, data.lane !== 'ADMIN' ? data.lastName! : '');
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

  // Render per-lane form fields (memoized)
  const fieldSlot = useMemo(
    () => (
      <>
        {/* SOUS_CHEF & CHEF_ATELIER: Identity fields */}
        {(activeLane === 'SOUS_CHEF' || activeLane === 'CHEF_ATELIER') && (
          <>
            <div className="space-y-1.5">
              <label htmlFor="matricule" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {fl.matricule}
              </label>
              <input
                id="matricule"
                type="text"
                {...register('matricule')}
                placeholder={fl.matriculePlaceholder}
                disabled={isSubmitting || isLocked || isRateLimited}
                className={inputClass}
              />
              {(errors as any).matricule && <p className={errorTextClass}>{(errors as any).matricule.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {fl.firstName}
                </label>
                <input
                  id="firstName"
                  type="text"
                  {...register('firstName')}
                  placeholder={fl.firstNamePlaceholder}
                  disabled={isSubmitting || isLocked || isRateLimited}
                  className={inputClass}
                />
                {(errors as any).firstName && <p className={errorTextClass}>{(errors as any).firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {fl.lastName}
                </label>
                <input
                  id="lastName"
                  type="text"
                  {...register('lastName')}
                  placeholder={fl.lastNamePlaceholder}
                  disabled={isSubmitting || isLocked || isRateLimited}
                  className={inputClass}
                />
                {(errors as any).lastName && <p className={errorTextClass}>{(errors as any).lastName.message}</p>}
              </div>
            </div>
          </>
        )}

        {/* ADMIN: Email field (top) then Password field (bottom) */}
        {activeLane === 'ADMIN' && (
          <>
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
              {(errors as any).email && <p className={errorTextClass}>{(errors as any).email.message}</p>}
            </div>
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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {(errors as any).password && <p className={errorTextClass}>{(errors as any).password.message}</p>}
            </div>
          </>
        )}

        {/* CHEF_ATELIER: Password field */}
        {activeLane === 'CHEF_ATELIER' && (
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {fl.password}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder={fl.passwordPlaceholderAlt}
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
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {(errors as any).password && <p className={errorTextClass}>{(errors as any).password.message}</p>}
          </div>
        )}

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
                {isLocked
                  ? fl.errorLocked
                  : isRateLimited
                    ? fl.errorRateLimited
                    : fl.errorAuth}
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
      </>
    ),
    [
      activeLane,
      lang,
      register,
      errors,
      showPassword,
      errorMessage,
      isLocked,
      isRateLimited,
      lockoutCountdown,
      retryAfter,
      isSubmitting,
      fl,
    ],
  );

  return (
    <LoginFormShell
      activeLane={activeLane}
      onLaneChange={handleLaneChange}
      language={lang}
      onLanguageChange={setLang}
      fieldSlot={fieldSlot}
      onSubmit={rhfHandleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      isLocked={isLocked}
      lockoutCountdown={lockoutCountdown}
      isRateLimited={isRateLimited}
      retryAfter={retryAfter}
      t={fl}
      laneLabel={laneLabel}
      isRtl={isRtl}
    />
  );
}
