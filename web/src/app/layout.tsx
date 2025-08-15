// apps/web/src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/providers/AuthProvider';
import { Notifications } from '@/components/ui/Notifications';

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
  return (
    <html lang="en">
      <body className={inter.className}
      suppressHydrationWarning={true} 
      >
        <AuthProvider>
          {children}
          <Notifications />
        </AuthProvider>
      </body>
    </html>
  );
}