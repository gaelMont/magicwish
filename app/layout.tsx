import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import Header from '@/components/Header'; 
import { Toaster } from 'react-hot-toast';
import UsernameSetupModal from '@/components/UsernameSetupModal'; 
import Script from 'next/script'; // Import de Script pour AdSense

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MagicWish',
  description: 'Gérez vos cartes Magic the Gathering',
};
// ---------------------------------------------------

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // On s'assure que les publicités ne s'affichent qu'en production 
  // et seulement si l'ID AdSense est configuré.
  const isProd = process.env.NODE_ENV === 'production';
  const adsensePubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;

  return (
    <html lang="fr" suppressHydrationWarning>
      
      {/* SCRIPT GOOGLE ADSENSE (Intégré dans le HEAD de la page) */}
      {isProd && adsensePubId && (
        <Script
          async
          // Utilise l'ID de publication de la variable d'environnement
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePubId}`}
          // 'afterInteractive' est une bonne stratégie pour les scripts publicitaires
          strategy="afterInteractive" 
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