// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import Header from '@/components/Header'; 
import { Toaster } from 'react-hot-toast';
import UsernameSetupModal from '@/components/UsernameSetupModal'; 
import Script from 'next/script'; 
import { Suspense } from 'react'; // <--- IMPORTANT : Import de Suspense

const inter = Inter({ subsets: ['latin'] });

// 1. Récupération des IDs depuis l'environnement
const adsensePubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID; 
const cmpMessageId = process.env.NEXT_PUBLIC_CMP_MESSAGE_ID; 

export const metadata: Metadata = {
  title: 'MagicWish',
  description: 'Gérez vos cartes Pokémon, Yu-Gi-Oh! et Magic the Gathering',

  // Balise Méta de vérification (gardée pour la propreté)
  verification: adsensePubId ? {
      google: adsensePubId 
  } : undefined,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isProd = process.env.NODE_ENV === 'production';
  // L'ID du CMP sans le préfixe 'pub-'
  const cleanPubId = adsensePubId?.replace('pub-', ''); 
  // L'ID de l'extrait du script CMP (souvent le pubId sans préfixe ou un ID spécifique)
  const dataId = cmpMessageId || cleanPubId; 

  return (
    <html lang="fr" suppressHydrationWarning>
      
      {/* 1. SCRIPT DE GESTION DU CONSENTEMENT (CMP) - DOIT ÊTRE EN PREMIER */}
      {(isProd && adsensePubId && dataId) && (
        <>
          <Script
            // Premier extrait : Charge le message CMP 
            async
            src={`https://fundingchoicesmessages.google.com/i/${cleanPubId}?hl=fr`}
            data-id={dataId!} 
            strategy="beforeInteractive" 
            crossOrigin="anonymous"
          />
          <Script
            // Deuxième extrait : Démarre le CMP
            id="cmp-starter-script"   
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  var s = document.createElement('script'); 
                  s.async = true; 
                  s.src = 'https://fundingchoicesmessages.google.com/start.js?id=${adsensePubId}';
                  document.head.appendChild(s);
                })();
              `,
            }}
          />
        </>
      )}

      {/* 2. SCRIPT GOOGLE ADSENSE (Pour l'affichage des publicités) - DOIT ÊTRE EN SECOND */}
      {isProd && adsensePubId && (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePubId}`}
          strategy="beforeInteractive" 
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
            
            {/* CORRECTION DU BUILD : On enveloppe le Header qui utilise useSearchParams */}
            <Suspense fallback={<div className="h-16 w-full bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800" />}>
               <Header />
            </Suspense>

            {children}
            <UsernameSetupModal />
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}