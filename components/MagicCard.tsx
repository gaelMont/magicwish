// components/MagicCard.tsx
'use client';

import { useState } from 'react';

type MagicCardProps = {
  name: string;
  imageUrl: string;
  imageBackUrl?: string | null;
  quantity?: number;
  price?: number;
  setName?: string;
  
  // Fonctions d'action
  onDelete?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onMove?: () => void;
  
  // Style & Mode
  isWishlist?: boolean;
  readOnly?: boolean; // <--- NOUVEAU
};

const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

export default function MagicCard({
  name,
  imageUrl,
  imageBackUrl,
  quantity = 1,
  price,
  setName,
  onDelete,
  onIncrement,
  onDecrement,
  onMove,
  isWishlist = false,
  readOnly = false // par défaut false
}: MagicCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };

  const currentImage = isFlipped && imageBackUrl ? imageBackUrl : imageUrl;

  return (
    <div className="relative group flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-3 gap-3 border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors h-full">
      
      {/* --- BOUTONS D'ACTION (Top) --- */}
      {/* On masque tout si readOnly */}
      {!readOnly && (
        <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
            {isWishlist && onMove && (
            <button
                onClick={onMove}
                className="p-1.5 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm"
                title="Déplacer vers Collection"
            >
                📦
            </button>
            )}
            
            {!isWishlist && <div></div>}

            {onDelete && (
            <button
                onClick={onDelete}
                className="p-1.5 bg-red-50 text-gray-400 hover:text-white hover:bg-red-600 rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
                title="Supprimer"
            >
                🗑️
            </button>
            )}
        </div>
      )}

      {/* --- IMAGE --- */}
      <div className="relative w-full aspect-[2.5/3.5] bg-gray-200 rounded-lg overflow-hidden">
        <img
          src={currentImage || CARD_BACK_URL}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300"
          onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
        />

        {imageBackUrl && (
          <button
            onClick={handleFlip}
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm transition-all shadow-lg border border-white/20 z-10"
          >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        )}
      </div>
      
      {/* --- INFO CARTE --- */}
      <div className="flex-1 flex flex-col min-w-0">
        <h3 className="font-bold text-sm md:text-base truncate mb-1" title={name}>{name}</h3>
        {setName && <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 truncate font-medium">{setName}</p>}
        
        <div className="mt-auto flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-2">
          
          {/* Compteur : Si readOnly, on affiche juste le chiffre */}
          <div className="flex items-center gap-2">
            {!readOnly && (
                <button onClick={onDecrement} className="bg-gray-200 dark:bg-gray-700 w-7 h-7 rounded hover:bg-gray-300 font-bold flex items-center justify-center">-</button>
            )}
            
            <span className={`font-mono text-lg ${readOnly ? 'font-bold text-gray-800 dark:text-white' : 'w-5 text-center'}`}>
                {readOnly && "x"}{quantity}
            </span>
            
            {!readOnly && (
                <button onClick={onIncrement} className="bg-blue-100 dark:bg-blue-900 text-blue-600 font-bold w-7 h-7 rounded hover:bg-blue-200 flex items-center justify-center">+</button>
            )}
          </div>
          
          {/* Prix */}
          <div className="text-right">
             <p className="text-[10px] text-gray-400">Unit: {price}€</p>
             <p className="font-bold text-gray-700 dark:text-gray-200">{(price ? price * quantity : 0).toFixed(2)} €</p>
          </div>
        </div>
      </div>
    </div>
  );
}