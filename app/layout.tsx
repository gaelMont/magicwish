// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import Header from '@/components/Header'; 
import { Toaster } from 'react-hot-toast';
import UsernameSetupModal from '@/components/UsernameSetupModal'; // <--- IMPORT

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MagicWish',
  description: 'Votre wishlist de cartes Magic',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AuthProvider>
          <Header />
          {children}
          
          {/* Composants Globaux */}
          <UsernameSetupModal /> {/* <--- AJOUTE ÇA ICI */}
          <Toaster position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}