// apps/web/src/app/layout.tsx - FIXED: Restore AuthProvider wrapper
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/providers/AuthProvider';
import { HUDProvider } from '@/providers/HUDProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Property Sync - Mission Control',
  description: 'Modern real estate client engagement platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('🔵 LAYOUT: Loading with AuthProvider');

  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <AuthProvider>
          <HUDProvider>
            {children}
          </HUDProvider>
        </AuthProvider>
      </body>
    </html>
  );
}