'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Lock, Sun, Moon } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import type { AuthLane } from '@/types/auth';


export type { AuthLane };

const LANE_ORDER: AuthLane[] = ['SOUS_CHEF', 'CHEF_ATELIER'];

// Props

interface LoginFormShellProps {
  activeLane: AuthLane;
  onLaneChange: (lane: AuthLane) => void;
  language: Lang;
  onLanguageChange: (lang: Lang) => void;
  fieldSlot: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  isLocked?: boolean;
  lockoutCountdown?: string;
  isRateLimited?: boolean;
  retryAfter?: number;
  accountUnclaimed?: boolean;
  onClaimRedirect?: () => void;
  // Translation strings (injected from useTranslation)
  t: Record<string, string>;
  laneLabel: Record<string, string>;
  isRtl: boolean;
}

// Animation Variants

const slotVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 12 : -12,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -12 : 12,
    opacity: 0,
  }),
};

// Grid animation — moving lines + subtle pulsing glow

const gridAnimation = {
  backgroundPosition: ['0px 0px', '80px 80px'],
};

const gridTransition = {
  duration: 12,
  ease: 'linear' as const,
  repeat: Infinity,
  repeatType: 'loop' as const,
};

// Radial glow pulsing animation (subtle opacity oscillation)

const glowAnimation = {
  opacity: [0.6, 1, 0.6],
};

const glowTransition = {
  duration: 6,
  ease: 'easeInOut' as const,
  repeat: Infinity,
  repeatType: 'mirror' as const,
};

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
    // dir="ltr" prevents RTL from swapping FR/AR buttons positions
    <div dir="ltr" className="flex items-center gap-2">
      {/* Language toggle: FR | AR */}
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

      {/* Dark mode toggle */}
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

export function LoginFormShell({
  activeLane,
  onLaneChange,
  language,
  onLanguageChange,
  fieldSlot,
  onSubmit,
  isSubmitting = false,
  errorMessage = null,
  isLocked = false,
  lockoutCountdown = '',
  isRateLimited = false,
  retryAfter = 0,
  accountUnclaimed = false,
  onClaimRedirect,
  t,
  laneLabel,
  isRtl,
}: LoginFormShellProps) {
  const { resolvedTheme } = useTheme();

  const prevIndexRef = useRef(0);
  const currentIndex = LANE_ORDER.indexOf(activeLane);
  const direction = currentIndex - prevIndexRef.current;
  prevIndexRef.current = currentIndex;

  const isDisabled = isSubmitting || isLocked || isRateLimited;

  // Conditional: hide forgot-password link for SOUS_CHEF (operator lane)
  const showForgotPassword = activeLane !== 'SOUS_CHEF';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6"
    >
      {/* Background layer: solid color + glow + moving grid */}
      <div className="fixed inset-0 z-0">
        {/* Solid base color */}
        <div className="absolute inset-0 bg-white dark:bg-slate-900 lg:bg-slate-50/60 lg:dark:bg-slate-950" />
        {/* Radial glow — subtle pulsing opacity animation */}
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
        {/* Moving grid: Framer Motion animated backgroundPosition */}
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

      {/* Header Controls: single instance — always top-right, responsive sizing */}
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
        <HeaderControls language={language} onLanguageChange={onLanguageChange} />
      </div>

      {/* Card / Full-bleed container */}
      <div
        className={[
          'relative z-10',
          // SM: compact full-bleed
          'w-full max-w-sm sm:max-w-xl lg:max-w-md',
          // LG+ card mode
          'lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-xl lg:shadow-slate-200/50 lg:dark:border-slate-800 lg:dark:bg-slate-900 lg:dark:shadow-none',
          // SM/MD full-bleed (surface matches outer wrapper)
          'max-lg:min-h-screen max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none',
          // SM compact spacing vs MD expanded spacing
          'p-6 sm:p-10 lg:p-8',
          isRtl ? 'text-right' : 'text-left',
        ].join(' ')}
      >
        {/* 1. Lock Badge */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F62FE] to-[#0353E9] shadow-md shadow-blue-500/20 dark:shadow-blue-500/30">
            <Lock className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
        </div>

        {/* 2. Title */}
        <h1 className="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-slate-100">
          {t.title}
        </h1>

        {/* 3. Subtitle */}
        <p className="mt-1.5 text-center text-sm text-gray-600 dark:text-slate-400">
          {t.subtitle}
        </p>

        {/* 4. Connected Sliding Role Switcher (2 lanes) */}
        <div className="mt-8" dir="ltr">
          <div className="relative rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
            <div className="relative flex">
              <motion.div
                className="absolute left-0 top-0 z-10 h-full rounded-[10px] bg-[#0F62FE] shadow-sm dark:bg-blue-600"
                animate={{
                  left: `${(currentIndex / LANE_ORDER.length) * 100}%`,
                  width: `${100 / LANE_ORDER.length}%`,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />

              {LANE_ORDER.map((lane) => {
                const isActive = activeLane === lane;
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => onLaneChange(lane)}
                    className={[
                      'relative z-20 flex-1 rounded-[10px] py-2 text-center text-sm font-medium transition-colors duration-200',
                      isActive
                        ? 'text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
                    ].join(' ')}
                    aria-pressed={isActive}
                  >
                    {laneLabel[lane]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 5. Form with animated Field Slot */}
        <form onSubmit={onSubmit} className="mt-7" noValidate>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeLane}
              custom={direction}
              variants={slotVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {/* FORM FIELD SLOT */}
              <div className="space-y-5">{fieldSlot}</div>

              {/* 6. Auxiliary Row */}
              <div className="mt-5 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#0F62FE] accent-[#0F62FE] focus:ring-2 focus:ring-[#0F62FE]/20 focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-800 dark:focus:ring-offset-slate-900"
                  />
                  {t.rememberMe}
                </label>
                {/* Hide forgot-password link for SOUS_CHEF (operator) lane */}
                {showForgotPassword && (
                  <button
                    type="button"
                    className="text-sm font-medium text-[#0F62FE] transition-colors hover:text-[#0353E9] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {t.forgotPassword}
                  </button>
                )}
              </div>

              {/* 7. Account Unclaimed Banner */}
              {accountUnclaimed && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {t.unclaimedTitle}
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    {t.unclaimedMessage}
                  </p>
                  {onClaimRedirect && (
                    <button
                      type="button"
                      onClick={onClaimRedirect}
                      className="mt-3 w-full rounded-lg bg-[#0F62FE] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0353E9] dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      {t.claimAccount}
                    </button>
                  )}
                </div>
              )}

              {/* 8. Submit Button */}
              <div className="mt-5">
                <button
                  type="submit"
                  disabled={isDisabled}
                  className={[
                    'flex w-full items-center justify-center rounded-xl py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200',
                    isDisabled
                      ? 'cursor-not-allowed bg-[#0F62FE]/60 dark:bg-blue-700/60'
                      : 'bg-[#0F62FE] hover:bg-[#0353E9] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500',
                  ].join(' ')}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t.submitting}
                    </span>
                  ) : isLocked ? (
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      {t.locked} ({lockoutCountdown})
                    </span>
                  ) : isRateLimited ? (
                    <span className="flex items-center gap-2">
                      {t.rateLimited} ({retryAfter}s)
                    </span>
                  ) : (
                    t.submit
                  )}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </form>

        {/* 9. Lane-specific footer */}
        {activeLane === 'SOUS_CHEF' && (
          <div className="mt-8 text-center text-xs text-gray-400 dark:text-slate-500">
            {t.sousChefHelp}
          </div>
        )}
        {activeLane === 'CHEF_ATELIER' && onClaimRedirect && (
          <div className="mt-8 text-center text-xs text-gray-400 dark:text-slate-500">
            <span>{t.chefAtelierClaimPrompt}{' '}</span>
            <button
              type="button"
              onClick={onClaimRedirect}
              className="font-semibold text-[#0F62FE] transition-colors hover:text-[#0353E9] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              {t.chefAtelierClaimAction}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
