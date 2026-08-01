'use client';

import { useState, useEffect, useCallback } from 'react';

/** Extract a human-readable message from an unknown error (Axios/network). */
export function extractErrorMessage(err: unknown): string {
  const anyErr = err as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return (
    anyErr?.response?.data?.message ??
    anyErr?.message ??
    'Une erreur est survenue lors de la requête.'
  );
}

export interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Standardized data-fetching hook used across all API-bound views.
 * Re-runs the fetcher when `deps` change or when `refetch()` is called.
 * No mock/fallback data is ever returned — callers render dedicated
 * loading skeletons, error banners and empty states instead.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, refetch, setData };
}
