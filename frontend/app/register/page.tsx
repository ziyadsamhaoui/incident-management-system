'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This page redirects to the Claim Account page (/claim)
 * which is the only way to activate a pre-promoted CHEF_ATELIER account.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/claim');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
