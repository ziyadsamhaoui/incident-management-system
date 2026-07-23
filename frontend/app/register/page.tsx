'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { RegisterFormShell } from '@/components/register/register-form-shell';
import { useTranslation, LANE_LABELS } from '@/lib/i18n';
import { registerSchema, type RegisterFormValues } from '@/lib/schemas';
import apiClient from '@/lib/api-client';

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

// Page Component

export default function RegisterPage() {
  const router = useRouter();
  const { lang, setLang, t: fl, isRtl } = useTranslation();
  const laneLabels = LANE_LABELS[lang];
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Matricule availability state
  const [matriculeStatus, setMatriculeStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
    watch,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      matricule: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'SOUS_CHEF',
    },
  });

  const currentMatricule = watch('matricule');

  // onBlur: check matricule availability
  const handleMatriculeBlur = useCallback(async () => {
    const value = currentMatricule?.trim();
    if (!value || value.length < 1) {
      setMatriculeStatus('idle');
      return;
    }

    setMatriculeStatus('checking');
    clearErrors('matricule');

    try {
      const { data } = await apiClient.get<{ exists: boolean; available: boolean }>(
        '/api/auth/check-matricule',
        { params: { matricule: value } },
      );

      if (data.exists) {
        setMatriculeStatus('taken');
        setError('matricule', { message: fl.matriculeTaken });
      } else {
        setMatriculeStatus('available');
      }
    } catch {
      // Network error — don't block registration, clear status
      setMatriculeStatus('idle');
    }
  }, [currentMatricule, clearErrors, setError, fl.matriculeTaken]);

  // Submit handler
  const onSubmit = useCallback(
    async (data: RegisterFormValues) => {
      setIsSubmitting(true);
      setServerError(null);
      setSuccessMessage(null);

      try {
        await apiClient.post('/api/auth/register', {
          fullName: data.fullName,
          matricule: data.matricule,
          email: data.email,
          password: data.password,
          role: data.role,
        });

        setSuccessMessage(fl.registerSuccess);
        // Redirect to login after short delay
        setTimeout(() => router.push('/login'), 1500);
      } catch (err: any) {
        const code = err?.response?.data?.code;
        const message = err?.response?.data?.message;

        if (code === 'MATRICULE_ALREADY_EXISTS') {
          setError('matricule', { message: fl.matriculeTaken });
          setMatriculeStatus('taken');
        } else if (code === 'REGISTRATION_CONFLICT') {
          setServerError(message || 'Conflit lors de l\'inscription');
        } else {
          setServerError(message || fl.errorAuth);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [fl, setError, router],
  );

  const roleOptions = [
    { value: 'SOUS_CHEF', label: laneLabels.SOUS_CHEF },
    { value: 'CHEF_ATELIER', label: laneLabels.CHEF_ATELIER },
    { value: 'ADMIN', label: laneLabels.ADMIN },
  ];

  return (
    <RegisterFormShell
      language={lang}
      onLanguageChange={setLang}
      fieldSlot={
        <>
          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {fl.fullName}
            </label>
            <input
              id="fullName"
              type="text"
              {...register('fullName')}
              placeholder={fl.fullNamePlaceholder}
              disabled={isSubmitting}
              className={`${inputClass} ${(errors as any).fullName ? inputErrorClass : ''}`}
            />
            {(errors as any).fullName && <p className={errorTextClass}>{(errors as any).fullName.message}</p>}
          </div>

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
                {matriculeStatus === 'available' && (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                )}
                {matriculeStatus === 'taken' && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            {(errors as any).matricule && <p className={errorTextClass}>{(errors as any).matricule.message}</p>}
          </div>

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
              disabled={isSubmitting}
              className={`${inputClass} ${(errors as any).email ? inputErrorClass : ''}`}
            />
            {(errors as any).email && <p className={errorTextClass}>{(errors as any).email.message}</p>}
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
                disabled={isSubmitting}
                className={`${inputClass} pe-12 ${(errors as any).password ? inputErrorClass : ''}`}
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
            {(errors as any).password && <p className={errorTextClass}>{(errors as any).password.message}</p>}
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
                placeholder={fl.passwordPlaceholder}
                disabled={isSubmitting}
                className={`${inputClass} pe-12 ${(errors as any).confirmPassword ? inputErrorClass : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                tabIndex={-1}
                aria-label={showPassword ? fl.hidePassword : fl.showPassword}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {(errors as any).confirmPassword && <p className={errorTextClass}>{(errors as any).confirmPassword.message}</p>}
          </div>

          {/* Role Selection */}
          <div className="space-y-1.5">
            <label htmlFor="role" className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {fl.roleSelect}
            </label>
            <select
              id="role"
              {...register('role')}
              disabled={isSubmitting}
              className={`${inputClass} ${(errors as any).role ? inputErrorClass : ''}`}
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {(errors as any).role && <p className={errorTextClass}>{(errors as any).role.message}</p>}
          </div>

          {/* Server error / Success message */}
          {serverError && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
              <p>{serverError}</p>
            </div>
          )}
          {successMessage && (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <p>{successMessage}</p>
            </div>
          )}
        </>
      }
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      disabled={isSubmitting || matriculeStatus === 'checking' || matriculeStatus === 'taken'}
      t={fl}
      isRtl={isRtl}
    />
  );
}
