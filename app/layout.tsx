// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider'; // <-- IMPORT
import Header from '@/components/Header'; 
import { Toaster } from 'react-hot-toast';
import UsernameSetupModal from '@/components/UsernameSetupModal'; 

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MagicWish',
  description: 'Votre wishlist de cartes Magic',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Ajout de suppressHydrationWarning pour éviter les warnings liés au thème
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        {/* On enveloppe tout avec le ThemeProvider */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <Header />
            {children}
            <UsernameSetupModal />
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}