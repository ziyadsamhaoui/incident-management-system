import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { RootLayoutClient } from './layout-client';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Incident Management System',
    template: '%s — ICGLMA',
  },
  description: 'ICGLMA Industrial Incident Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
