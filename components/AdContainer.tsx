// components/AdContainer.tsx
'use client';
import { usePremium } from '@/hooks/usePremium';
import Link from 'next/link';
import { useEffect } from 'react';

// Type pour les paramètres passés aux endroits où la pub s'affiche
type Props = {
    message?: string;
    adSlotId?: string; 
};

export default function AdContainer({ message = "Publicité", adSlotId = "YOUR_ADSENSE_SLOT_ID" }: Props) {
  const { isPremium, loading } = usePremium();

  // Déclencher le rafraîchissement AdSense après le rendu
  useEffect(() => {
    // Vérifie si l'API AdSense est disponible et si nous ne sommes pas Premium
    if (window.adsbygoogle && !isPremium) {
      try {
        // Appelle la méthode push sur la variable globale adsbygoogle, maintenant typée
        window.adsbygoogle.push({}); 
      } catch (e) {
        console.warn("Erreur chargement AdSense", e);
      }
    }
  }, [isPremium, adSlotId]);


  if (loading || isPremium || !process.env.NEXT_PUBLIC_ADSENSE_PUB_ID) return null;

  return (
    <div className="w-full my-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-surface border-2 border-dashed border-primary/30 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            
            <div className="relative z-10 w-full">
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">{message}</p>
                
                {/* BLOC DE CODE ADSENSE */}
                <div className="w-full flex justify-center min-h-[100px] mb-2">
                  <ins 
                    className="adsbygoogle"
                    style={{ display: 'block', width: '100%', minHeight: '100px' }}
                    data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_PUB_ID}
                    data-ad-slot={adSlotId}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                  ></ins>
                </div>
                {/* FIN DU BLOC ADSENSE */}

                <Link 
                    href="/premium" 
                    className="inline-block bg-primary hover:opacity-90 text-primary-foreground px-6 py-2 rounded-full text-xs font-bold shadow-md transition transform active:scale-95"
                >
                    Retirer les pubs (1€/mois)
                </Link>
            </div>
        </div>
    </div>
  );
}