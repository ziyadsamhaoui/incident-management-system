'use client';

import { Providers } from './providers';
import { ToastViewport } from '@/components/ui/toast';

export function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {children}
      <ToastViewport />
    </Providers>
  );
}
