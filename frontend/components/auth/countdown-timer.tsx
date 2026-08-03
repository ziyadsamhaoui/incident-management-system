'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  /** ISO timestamp at which the countdown reaches zero. */
  expiresAt: string;
  /** Invoked once when the countdown reaches zero. */
  onExpire?: () => void;
  className?: string;
  /** When true the "Expire dans" label is omitted — only mm:ss renders. */
  bare?: boolean;
}

function format(remainingSeconds: number): string {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Live mm:ss countdown for reset-code expiration (15-minute TTL). Ticks every
 * second from the `expiresAt` timestamp and fires `onExpire` exactly once when
 * it hits zero.
 */
export function CountdownTimer({
  expiresAt,
  onExpire,
  className,
  bare = false,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [expired, setExpired] = useState(
    () => new Date(expiresAt).getTime() - Date.now() <= 0,
  );

  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const seconds = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds <= 0) {
        setExpired(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Fire onExpire exactly once when the countdown crosses zero.
  useEffect(() => {
    if (expired) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono font-bold tabular-nums',
        expired ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400',
        className,
      )}
    >
      {!bare && !expired && <span className="font-sans font-medium opacity-70">—</span>}
      {format(remaining)}
    </span>
  );
}
