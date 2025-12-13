import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import Header from '@/components/Header'; 
import { Toaster } from 'react-hot-toast';
import UsernameSetupModal from '@/components/UsernameSetupModal'; 
import Script from 'next/script'; 

const inter = Inter({ subsets: ['latin'] });

const adsensePubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;

export const metadata: Metadata = {
  title: 'MagicWish',
  description: 'Gérez vos cartes Magic the Gathering',

  verification: adsensePubId ? {
      google: adsensePubId 
  } : undefined,

};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // Maintenu pour le script de chargement (à faire uniquement en production)
  const isProd = process.env.NODE_ENV === 'production';

  return (
    <html lang="fr" suppressHydrationWarning>
      
      {/* SCRIPT GOOGLE ADSENSE (Pour l'affichage des publicités) */}
      {isProd && adsensePubId && (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePubId}`}
          strategy="beforeInteractive" // 3. CHANGEMENT : Injection plus précoce
          crossOrigin="anonymous"
        />
      )}
      {/* FIN SCRIPT ADSENSE */}

      <body className={inter.className}>
        <ThemeProvider 
            attribute="class" 
            defaultTheme="light" 
            enableSystem={false} 
            disableTransitionOnChange 
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