import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer'; 
import { Toaster } from 'react-hot-toast';
import UsernameSetupModal from '@/components/UsernameSetupModal'; 
import Script from 'next/script'; 
import { Suspense } from 'react';
import VerificationBlocker from '@/components/auth/VerificationBlocker'; // 1. IMPORT DU BLOQUEUR

const inter = Inter({ subsets: ['latin'] });

const adsensePubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID; 
const cmpMessageId = process.env.NEXT_PUBLIC_CMP_MESSAGE_ID; 

export const metadata: Metadata = {
  title: 'MagicWish',
  description: 'Gérez votre collection Magic the Gathering et echangez avec vos amis facilement !',
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
  const cleanPubId = adsensePubId?.replace('pub-', ''); 
  const dataId = cmpMessageId || cleanPubId; 

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* CMP Script */}
        {(isProd && adsensePubId && dataId) && (
          <>
            <Script
              async
              src={`https://fundingchoicesmessages.google.com/i/${cleanPubId}?hl=fr`}
              data-id={dataId} 
              strategy="beforeInteractive" 
              crossOrigin="anonymous"
            />
            <Script
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

        {/* AdSense Script */}
        {(isProd && adsensePubId) && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePubId}`}
            strategy="beforeInteractive" 
            crossOrigin="anonymous"
          />
        )}
      </head>

      <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground`}>
        <ThemeProvider 
            attribute="class" 
            defaultTheme="light" 
            enableSystem={false} 
            disableTransitionOnChange 
        >
          <AuthProvider>
            
            {/* 2. ON ENGLOBE TOUT LE CONTENU VISIBLE */}
            <VerificationBlocker>
                <Suspense fallback={<div className="h-16 w-full bg-background border-b border-border" />}>
                    <Header />
                </Suspense>

                <main className="flex-1">
                    {children}
                </main>
                
                <UsernameSetupModal />
                
                <Footer />
            </VerificationBlocker>

            {/* Le Toaster reste en dehors pour afficher les notifs même si bloqué */}
            <Toaster position="bottom-right" toastOptions={{
                style: {
                  background: '#333',
                  color: '#fff',
                },
            }} />
            
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}