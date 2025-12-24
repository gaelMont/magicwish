// components/LockedListModal.tsx
'use client';

import { useState } from 'react';
import StripeButton from '@/components/StripeButton'; // Import

type LockedListModalProps = {
  isOpen: boolean;
  listName?: string;
};

export function LockedListModal({ isOpen, listName }: LockedListModalProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isOpen || !isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 transform transition-all scale-100">
        
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
            {/* Remplacement emoji par texte ou icone Lucide si dispo */}
            <span className="text-2xl font-bold text-amber-600">🔒</span>
          </div>
          
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Liste Verrouillée
          </h3>
          
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            La liste <strong>{listName}</strong> dépasse la limite de votre compte gratuit.
            <br/><br/>
            Vous pouvez <strong>consulter</strong> vos cartes, mais vous ne pouvez plus en ajouter ni en modifier.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {/* BOUTON D'ACHAT DIRECT */}
          <StripeButton 
            className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            Déverrouiller maintenant (1€)
          </StripeButton>
          
          <button
            onClick={() => setIsVisible(false)}
            className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Voir en lecture seule
          </button>
        </div>
      </div>
    </div>
  );
}