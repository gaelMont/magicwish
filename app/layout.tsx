// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
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
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider 
            attribute="class" 
            defaultTheme="light"      // Force le mode clair
            enableSystem={false}      // Ignore les préférences de l'ordinateur
            disableTransitionOnChange // Évite les flashs de couleur au chargement
        >
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