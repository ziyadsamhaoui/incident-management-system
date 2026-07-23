'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar — hidden on mobile, togglable */}
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
