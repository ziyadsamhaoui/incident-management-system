'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// ── Context ───────────────────────────────────────

interface NavigationContextValue {
  /** Call this BEFORE navigating to show the loading bar immediately */
  startNavigation: () => void;
}

const NavigationCtx = createContext<NavigationContextValue>({
  startNavigation: () => {},
});

export function useNavigationProgress() {
  return useContext(NavigationCtx);
}

// ── Provider ──────────────────────────────────────

export function NavigationProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathRef = useRef(pathname);
  const frameRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // When pathname changes, complete the bar and hide
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      completedRef.current = true;
      // Cancel any pending animation frames
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      // Complete to 100%
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
        completedRef.current = false;
      }, 350);
      return () => clearTimeout(hideTimer);
    }
  }, [pathname]);

  const startNavigation = useCallback(() => {
    // Cancel any existing animation
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    completedRef.current = false;

    setVisible(true);
    setProgress(8);

    // Animate progress smoothly up to ~85% over ~1s
    const startTime = Date.now();
    const animate = () => {
      // If navigation completed already, stop animating
      if (completedRef.current) {
        frameRef.current = null;
        return;
      }
      const elapsed = Date.now() - startTime;
      // Ease-out curve: fast start, slow finish
      const raw = Math.min(85, 8 + (elapsed / 1200) * 85);
      setProgress(raw);
      if (elapsed < 1500) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <NavigationCtx.Provider value={{ startNavigation }}>
      {/* Progress bar — fixed at the very top, above everything */}
      <div
        className={cn(
          'fixed left-0 right-0 top-0 z-[9999] h-[3px] bg-transparent',
          !visible && 'pointer-events-none',
        )}
      >
        <div
          className="h-full bg-blue-500 transition-[width] duration-200 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)]"
          style={{
            width: `${progress}%`,
            opacity: visible ? 1 : 0,
            transition: visible
              ? 'width 200ms ease-out, opacity 300ms ease-out'
              : 'opacity 300ms ease-out',
          }}
        />
      </div>
      {children}
    </NavigationCtx.Provider>
  );
}
