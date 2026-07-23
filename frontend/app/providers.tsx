'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@/components/ui/toast';
import { useAuthStore } from '@/store/useAuthStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="app-theme"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function useAppInit() {
  const hydrate = useAuthStore((s) => s.hydrate);
  hydrate();
}
