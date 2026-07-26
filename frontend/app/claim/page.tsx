'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ClaimFormShell } from '@/components/claim/claim-form-shell';
import { useTranslation } from '@/lib/i18n';
import { claimSchema, type ClaimFormValues } from '@/lib/schemas';
import { claimAccount, checkMatricule } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';

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
const inputErrorClass = 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/20';

export default function ClaimPage() {
  const router = useRouter();
  const loginSucceeded = useAuthStore((s) => s.loginSucceeded);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { lang, setLang, t: fl, isRtl } = useTranslation();

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Matricule eligibility state
  const [matriculeStatus, setMatriculeStatus] = useState<'idle' | 'checking' | 'eligible' | 'ineligible'>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
    watch,
  } = useForm<ClaimFormValues>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      matricule: '',
      firstName: '',
      lastName: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const currentMatricule = watch('matricule');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  // onBlur: check matricule eligibility
  const handleMatriculeBlur = useCallback(async () => {
    const value = currentMatricule?.trim();
    if (!value || value.length < 1) {
      setMatriculeStatus('idle');
      return;
    }

    setMatriculeStatus('checking');
    clearErrors('matricule');

    try {
      const data = await checkMatricule(value);

      if (data.eligibleToClaim) {
        setMatriculeStatus('eligible');
      } else if (data.exists) {
        setMatriculeStatus('ineligible');
        setError('matricule', { message: fl.matriculeNotEligible });
      } else {
        setMatriculeStatus('ineligible');
        setError('matricule', { message: fl.matriculeNotEligible });
      }
    } catch {
      // Network error — don't block registration, clear status
      setMatriculeStatus('idle');
    }
  }, [currentMatricule, clearErrors, setError, fl.matriculeNotEligible]);

  // Submit handler
  const onSubmit = useCallback(
    async (data: ClaimFormValues) => {
      setIsSubmitting(true);
      setServerError(null);
      setSuccessMessage(null);

      try {
        const response = await claimAccount({
          matricule: data.matricule.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          newPassword: data.newPassword,
        });

        loginSucceeded(response, 'CHEF_ATELIER');
        useAuthStore.getState().setUserIdentity(data.firstName.trim(), data.lastName.trim());

        setSuccessMessage(fl.claimSuccess);
        setTimeout(() => router.replace('/dashboard'), 1500);
      } catch (err: any) {
        const code = err?.code;
        const message = err?.message;

        if (code === 'ALREADY_CLAIMED') {
          setServerError(fl.alreadyClaimed);
        } else if (code === 'IDENTITY_MISMATCH') {
          setError('firstName', { message: fl.identityMismatch });
          setError('lastName', { message: fl.identityMismatch });
        } else if (code === 'NOT_ELIGIBLE') {
          setServerError(fl.matriculeNotEligible);
        } else {
          setServerError(message || fl.claimError);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [fl, setError, loginSucceeded, router],
  );

  const isSubmitDisabled = isSubmitting || matriculeStatus === 'checking' || matriculeStatus === 'ineligible';

  return (
    <ClaimFormShell
      language={lang}
      onLanguageChange={setLang}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      disabled={isSubmitDisabled}
      t={fl}
      isRtl={isRtl}
      fieldSlot={
        <>
          {/* Matricule with onBlur check */}
          <div className="space-y-1.5">
            <label htmlFor="matricule" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {fl.matricule}
            </label>
            <div className="relative">
              <input
                id="matricule"
                type="text"
                {...register('matricule')}
                placeholder={fl.matriculePlaceholder}
                disabled={isSubmitting}
                onBlur={handleMatriculeBlur}
                className={`${inputClass} pe-10 ${(errors as any).matricule ? inputErrorClass : ''}`}
              />
              {/* Status indicator inside input */}
              <div className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
                {matriculeStatus === 'checking' && (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                )}
                {matriculeStatus === 'eligible' && (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                )}
                {matriculeStatus === 'ineligible' && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            {(errors as any).matricule && <p className={errorTextClass}>{(errors as any).matricule.message}</p>}
            {matriculeStatus === 'checking' && (
              <p className="mt-1 text-xs text-blue-500">{fl.checkMatricule}</p>
            )}
          </div>

          {/* First Name & Last Name — same line */}
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
                disabled={isSubmitting}
                className={`${inputClass} ${(errors as any).firstName ? inputErrorClass : ''}`}
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
                disabled={isSubmitting}
                className={`${inputClass} ${(errors as any).lastName ? inputErrorClass : ''}`}
              />
              {(errors as any).lastName && <p className={errorTextClass}>{(errors as any).lastName.message}</p>}
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {fl.newPassword}
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                {...register('newPassword')}
                placeholder={fl.newPasswordPlaceholder}
                disabled={isSubmitting}
                className={`${inputClass} pe-12 ${(errors as any).newPassword ? inputErrorClass : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                tabIndex={-1}
                aria-label={showNewPassword ? fl.hidePassword : fl.showPassword}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {(errors as any).newPassword && <p className={errorTextClass}>{(errors as any).newPassword.message}</p>}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {fl.confirmPassword}
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword')}
                placeholder={fl.confirmPasswordPlaceholder}
                disabled={isSubmitting}
                className={`${inputClass} pe-12 ${(errors as any).confirmPassword ? inputErrorClass : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                tabIndex={-1}
                aria-label={showConfirmPassword ? fl.hidePassword : fl.showPassword}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {(errors as any).confirmPassword && <p className={errorTextClass}>{(errors as any).confirmPassword.message}</p>}
          </div>

          {/* Server error / Success message */}
          {serverError && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
              <p>{serverError}</p>
            </div>
          )}
          {successMessage && (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <p>{successMessage}</p>
            </div>
          )}
        </>
      }
    />
  );
}
