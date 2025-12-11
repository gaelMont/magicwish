// components/MagicCard.tsx
'use client';

import { useState } from 'react';

type MagicCardProps = {
  name: string;
  imageUrl: string;
  imageBackUrl?: string | null; // Optionnel : Le dos de la carte
  quantity?: number;
  price?: number;
  setName?: string;
  
  // Fonctions d'action
  onDelete?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onMove?: () => void; // Pour la wishlist
  
  // Style
  isWishlist?: boolean;
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
  isWishlist = false
}: MagicCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation(); // Empêche de cliquer sur la carte si on clique sur le bouton flip
    setIsFlipped(!isFlipped);
  };

  const currentImage = isFlipped && imageBackUrl ? imageBackUrl : imageUrl;

  return (
    <div className="relative group flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-3 gap-3 border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors h-full">
      
      {/* --- BOUTONS D'ACTION (Top) --- */}
      <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
        {/* Bouton Wishlist -> Collection */}
        {isWishlist && onMove && (
          <button
            onClick={onMove}
            className="p-1.5 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm"
            title="Déplacer vers Collection"
          >
            📦
          </button>
        )}
        
        {/* Spacer si pas de bouton gauche */}
        {!isWishlist && <div></div>}

        {/* Bouton Supprimer */}
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

      {/* --- IMAGE ET BOUTON FLIP --- */}
      <div className="relative w-full aspect-[2.5/3.5] bg-gray-200 rounded-lg overflow-hidden">
        <img
          src={currentImage || CARD_BACK_URL}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300"
          onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
        />

        {/* BOUTON FLIP (Exactement comme Scryfall) */}
        {imageBackUrl && (
          <button
            onClick={handleFlip}
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm transition-all shadow-lg border border-white/20 z-10"
            title="Retourner la carte"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        )}
      </div>
      
      {/* --- INFO CARTE --- */}
      <div className="flex-1 flex flex-col min-w-0">
        <h3 className="font-bold text-sm md:text-base truncate mb-1" title={name}>
            {/* Si c'est retourné, on peut afficher le nom du dos si on veut, mais gardons le nom principal pour simplifier */}
            {name}
        </h3>
        
        {setName && <p className="text-xs text-blue-600 dark:text-blue-400 mb-2 truncate font-medium">{setName}</p>}
        
        <div className="mt-auto flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-2">
          {/* Compteur */}
          <div className="flex items-center gap-2">
            <button onClick={onDecrement} className="bg-gray-200 dark:bg-gray-700 w-7 h-7 rounded hover:bg-gray-300 font-bold flex items-center justify-center">-</button>
            <span className="font-mono text-lg w-5 text-center">{quantity}</span>
            <button onClick={onIncrement} className="bg-blue-100 dark:bg-blue-900 text-blue-600 font-bold w-7 h-7 rounded hover:bg-blue-200 flex items-center justify-center">+</button>
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