'use client';

import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { UserPlus, Sun, Moon } from 'lucide-react';
import type { Lang } from '@/lib/i18n';

// Grid animation — moving lines (80px tiles, 12s loop) + pulsing glow

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

// Props

interface RegisterFormShellProps {
  language: Lang;
  onLanguageChange: (lang: Lang) => void;
  fieldSlot: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  t: Record<string, string>;
  isRtl: boolean;
}

// Sub-component: Header Controls

function HeaderControls({
  language,
  onLanguageChange,
}: {
  language: Lang;
  onLanguageChange: (lang: Lang) => void;
}) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div dir="ltr" className="flex items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        {(['FR', 'AR'] as Lang[]).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => onLanguageChange(lang)}
            className={[
              'font-semibold uppercase tracking-wider transition-colors duration-150',
              'px-2 py-1 text-[11px] lg:px-3 lg:py-2 lg:text-sm',
              language === lang
                ? 'bg-[#0F62FE] text-white dark:bg-blue-600'
                : 'bg-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            ].join(' ')}
          >
            {lang}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className={[
          'flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
          'h-7 w-7 lg:h-9 lg:w-9',
        ].join(' ')}
        aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      >
        {isDark ? <Sun className="h-3.5 w-3.5 lg:h-4 lg:w-4" /> : <Moon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />}
      </button>
    </div>
  );
}

// Main Component

export function RegisterFormShell({
  language,
  onLanguageChange,
  fieldSlot,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  t,
  isRtl,
}: RegisterFormShellProps) {
  const { theme } = useTheme();

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        'relative flex min-h-screen items-center justify-center',
        'bg-white dark:bg-slate-900',
        'lg:bg-slate-50/60 lg:dark:bg-slate-950',
        'px-4 py-8 sm:px-6',
      ].join(' ')}
    >
      {/* Background: diagonal gradient mesh + moving grid */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: theme === 'dark'
              ? `radial-gradient(ellipse at 15% 85%, rgba(59, 130, 246, 0.10) 0%, transparent 55%), radial-gradient(ellipse at 80% 15%, rgba(59, 130, 246, 0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.06) 0%, transparent 60%)`
              : `radial-gradient(ellipse at 15% 85%, rgba(15, 98, 254, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 15%, rgba(15, 98, 254, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(3, 83, 233, 0.04) 0%, transparent 60%)`,
          }}
          animate={glowAnimation}
          transition={glowTransition}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: theme === 'dark'
              ? [
                  'repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(59, 130, 246, 0.18) 79px, rgba(59, 130, 246, 0.18) 80px)',
                  'repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(59, 130, 246, 0.18) 79px, rgba(59, 130, 246, 0.18) 80px)',
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

      {/* Header Controls */}
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
        <HeaderControls language={language} onLanguageChange={onLanguageChange} />
      </div>

      {/* Card / Full-bleed container */}
      <div
        className={[
          'w-full max-w-sm sm:max-w-xl lg:max-w-lg',
          'lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-xl lg:shadow-slate-200/50 lg:dark:border-slate-800 lg:dark:bg-slate-900 lg:dark:shadow-none',
          'max-lg:min-h-screen max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none',
          'p-6 sm:p-10 lg:p-8',
          isRtl ? 'text-right' : 'text-left',
        ].join(' ')}
      >
        {/* 1. Badge */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F62FE] to-[#0353E9] shadow-md shadow-blue-500/20 dark:shadow-blue-500/30">
            <UserPlus className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
        </div>

        {/* 2. Title */}
        <h1 className="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-slate-100">
          {t.registerTitle}
        </h1>

        {/* 3. Subtitle */}
        <p className="mt-1.5 text-center text-sm text-gray-600 dark:text-slate-400">
          {t.registerSubtitle}
        </p>

        {/* 4. Form */}
        <form onSubmit={onSubmit} className="mt-7" noValidate>
          <div className="space-y-5">{fieldSlot}</div>

          {/* 5. Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting || disabled}
              className={[
                'flex w-full items-center justify-center rounded-xl py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200',
                isSubmitting
                  ? 'cursor-not-allowed bg-[#0F62FE]/60 dark:bg-blue-700/60'
                  : 'bg-[#0F62FE] hover:bg-[#0353E9] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500',
              ].join(' ')}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t.submittingRegister}
                </span>
              ) : (
                t.submitRegister
              )}
            </button>
          </div>
        </form>

        {/* 6. Login Link */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-slate-400">
          {t.alreadyHaveAccount}{' '}
          <a
            href="/login"
            className="ms-1 font-semibold text-[#0F62FE] transition-colors hover:text-[#0353E9] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t.loginLink}
          </a>
        </div>
      </div>
    </div>
  );
}
