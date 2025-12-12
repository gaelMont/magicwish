// components/CollectionToolsModal.tsx
'use client';

import { useState } from 'react';
import AdContainer from './AdContainer';

type CollectionToolsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefreshPrices: () => Promise<void>;
  onBulkTrade: (action: 'excess' | 'all' | 'reset', threshold?: number) => void;
  totalCards: number;
};

export default function CollectionToolsModal({ 
    isOpen, onClose, onRefreshPrices, onBulkTrade, totalCards 
}: CollectionToolsModalProps) {
  
  const [threshold, setThreshold] = useState(4);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
      setIsRefreshing(true);
      await onRefreshPrices();
      setIsRefreshing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                ⚙️ Gestion Collection
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>

        <div className="space-y-8">
            
            {/* SECTION 1 : CLASSEUR D'ÉCHANGE */}
            <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">Automatisations Échange</h3>
                
                {/* Option Playset */}
                <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-800 mb-3">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 block">
                        Mettre en échange le surplus (Playset)
                    </label>
                    <div className="flex gap-2">
                        <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-2">
                            <span className="text-xs text-gray-500 mr-2">Qté &gt;</span>
                            <input 
                                type="number" 
                                min="1" 
                                max="100" 
                                value={threshold} 
                                onChange={(e) => setThreshold(parseInt(e.target.value) || 4)}
                                className="w-10 text-center font-bold outline-none bg-transparent text-gray-900 dark:text-white"
                            />
                        </div>
                        <button 
                            onClick={() => onBulkTrade('excess', threshold)}
                            className="flex-grow bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 rounded-lg transition"
                        >
                            Appliquer
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                        Exemple : Si Qté &gt; 4, la carte est marquée &quot;Disponible à l&apos;échange&quot;.
                    </p>
                </div>

                {/* Actions Rapides */}
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => onBulkTrade('all')}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition"
                    >
                        Tout mettre en Trade
                    </button>
                    <button 
                        onClick={() => onBulkTrade('reset')}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-red-100 hover:text-red-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition"
                    >
                        Tout retirer (Reset)
                    </button>
                </div>
            </div>

            {/* SECTION 2 : ACTUALISATION */}
            <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">Données & Prix</h3>
                
                {isRefreshing && (
                    <div className="mb-4">
                        <AdContainer /> {/* <--- LA PUB APPARAIT PENDANT L'ATTENTE */}
                        <p className="text-center text-sm text-blue-600 animate-pulse mt-2">
                            Analyse des prix en cours...
                        </p>
                    </div>
                )}
                
                <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="w-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                    {isRefreshing ? 'Mise à jour en cours...' : '🔄 Actualiser Scryfall (Prix)'}
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-2">
                    Met à jour les prix et informations de vos {totalCards} cartes.
                </p>
            </div>

        </div>
      </div>
    </div>
  );
}