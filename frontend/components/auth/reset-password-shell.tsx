'use client';

import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
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

interface ResetPasswordShellProps {
  language: Lang;
  onLanguageChange: (lang: Lang) => void;
  isRtl: boolean;
  /** Lucide icon rendered in the badge above the title. */
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Form OR success-state content — the page controls what renders here. */
  children: React.ReactNode;
  /** Optional footer (e.g. back-to-login link). */
  footer?: React.ReactNode;
}

// Sub-component: Header Controls (language + theme)

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

export function ResetPasswordShell({
  language,
  onLanguageChange,
  isRtl,
  icon,
  title,
  subtitle,
  children,
  footer,
}: ResetPasswordShellProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6"
    >
      {/* Background layer: solid color + glow + moving grid */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-white dark:bg-slate-900 lg:bg-slate-50/60 lg:dark:bg-slate-950" />
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

      {/* Header Controls */}
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
        <HeaderControls language={language} onLanguageChange={onLanguageChange} />
      </div>

      {/* Card / Full-bleed container */}
      <div
        className={[
          'relative z-10',
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
            {icon}
          </div>
        </div>

        {/* 2. Title */}
        <h1 className="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-slate-100">
          {title}
        </h1>

        {/* 3. Subtitle */}
        {subtitle && (
          <p className="mt-1.5 text-center text-sm text-gray-600 dark:text-slate-400">
            {subtitle}
          </p>
        )}

        {/* 4. Content */}
        <div className="mt-7">{children}</div>

        {/* 5. Footer */}
        {footer && <div className="mt-8">{footer}</div>}
      </div>
    </div>
  );
}
