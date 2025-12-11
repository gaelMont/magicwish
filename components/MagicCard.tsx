// components/MagicCard.tsx
'use client';

import { useState, useEffect } from 'react';

type MagicCardProps = {
  id?: string;
  name: string;
  imageUrl: string;
  imageBackUrl?: string | null;
  quantity?: number;
  price?: number;
  customPrice?: number; 
  setName?: string;
  
  isFoil?: boolean;
  isSpecificVersion?: boolean;
  isForTrade?: boolean; // <--- Nouveau
  
  onDelete?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onMove?: () => void;
  
  onEditPrice?: (newPrice: number) => void;
  // Signature mise à jour pour accepter isForTrade
  onToggleAttribute?: (field: 'isFoil' | 'isSpecificVersion' | 'isForTrade', currentValue: boolean) => void;
  
  isWishlist?: boolean;
  readOnly?: boolean;
  isTradeView?: boolean;
  allowPriceEdit?: boolean;
};

const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

export default function MagicCard(props: MagicCardProps) {
  const { 
      id, name, imageUrl, imageBackUrl, quantity = 1, 
      price, customPrice, setName, 
      isFoil, isSpecificVersion, isForTrade,
      isTradeView, allowPriceEdit, 
      onEditPrice, onToggleAttribute, 
      readOnly, isWishlist,
      onDelete, onIncrement, onDecrement, onMove
  } = props;
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  
  const [tempPrice, setTempPrice] = useState(customPrice?.toString() || price?.toString() || "0");

  // Synchronisation du prix
  useEffect(() => {
    if (!isEditingPrice) {
        const newVal = customPrice?.toString() || price?.toString() || "0";
        setTempPrice(newVal);
    }
  }, [customPrice, price, isEditingPrice]);

  const effectivePrice = customPrice !== undefined ? customPrice : (price || 0);

  const handleSavePrice = () => {
      if (onEditPrice) {
          onEditPrice(parseFloat(tempPrice));
          setIsEditingPrice(false);
      }
  };

  const currentImage = isFlipped && imageBackUrl ? imageBackUrl : imageUrl;

  // --- VUE LISTE COMPACTE (TRADE) ---
  if (isTradeView) {
      return (
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="w-10 h-14 bg-gray-200 rounded overflow-hidden flex-shrink-0 relative group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                 <img src={currentImage} className="w-full h-full object-cover" alt={name} />
                 {isFoil && <div className="absolute top-0 right-0 bg-purple-600/80 text-white text-[8px] px-1 font-bold">✨</div>}
            </div>
            
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate" title={name}>{name}</p>
                    {isFoil && <span className="text-xs" title="Foil">✨</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <p className="truncate">{setName}</p>
                    {isSpecificVersion && <span className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-[9px] border border-gray-400" title="Édition exacte requise">🔒 EXACT</span>}
                </div>
            </div>

            <div className="text-right flex flex-col items-end">
                {isEditingPrice ? (
                    <div className="flex items-center gap-1">
                        <input type="number" value={tempPrice} onChange={(e) => setTempPrice(e.target.value)} className="w-16 p-1 text-xs border rounded text-black" autoFocus />
                        <button onClick={handleSavePrice} className="text-green-600 text-xs font-bold">OK</button>
                    </div>
                ) : (
                    <div 
                        className={`font-bold text-sm ${customPrice ? 'text-orange-600' : 'text-gray-700 dark:text-gray-300'} ${allowPriceEdit ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => { if (allowPriceEdit) { setTempPrice(effectivePrice.toString()); setIsEditingPrice(true); }}}
                        title={customPrice ? "Prix personnalisé" : "Prix Scryfall"}
                    >
                        {effectivePrice.toFixed(2)} €
                        {customPrice && <span className="text-[8px] align-top ml-0.5">*</span>}
                    </div>
                )}
            </div>
        </div>
      );
  }

  // --- VUE NORMALE (GRILLE) ---
  return (
    <div className={`relative group flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-3 gap-3 border transition-colors h-full ${isFoil ? 'border-purple-300 dark:border-purple-800 shadow-purple-100 dark:shadow-none' : 'border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500'}`}>
      
      {/* --- BADGES ET TOGGLES --- */}
      <div className="absolute top-14 left-4 z-10 flex flex-col gap-1">
        
        {/* BOUTON FOIL */}
        {isWishlist && !readOnly && onToggleAttribute && (
            <button 
                onClick={() => onToggleAttribute('isFoil', !!isFoil)}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border ${isFoil ? 'bg-purple-600 text-white border-purple-400' : 'bg-white/80 text-gray-400 border-gray-300 hover:text-purple-600'}`}
                title="Basculer Foil"
            >
                ✨
            </button>
        )}

        {/* BOUTON VERSION EXACTE */}
        {isWishlist && !readOnly && onToggleAttribute && (
            <button 
                onClick={() => onToggleAttribute('isSpecificVersion', !!isSpecificVersion)}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border ${isSpecificVersion ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/80 text-gray-400 border-gray-300 hover:text-blue-600'}`}
                title={isSpecificVersion ? "Version exacte requise" : "N'importe quelle version"}
            >
                {isSpecificVersion ? '🔒' : '🌍'}
            </button>
        )}

        {/* --- NOUVEAU : BOUTON TRADE (COLLECTION SEULEMENT) --- */}
        {!isWishlist && !readOnly && onToggleAttribute && (
            <button 
                onClick={() => onToggleAttribute('isForTrade', !!isForTrade)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md border transition-all ${
                    isForTrade 
                    ? 'bg-green-500 text-white border-green-600 scale-110' 
                    : 'bg-white/90 text-gray-300 border-gray-300 hover:text-green-500 grayscale'
                }`}
                title={isForTrade ? "Disponible à l'échange" : "Non disponible à l'échange"}
            >
                🤝
            </button>
        )}
      </div>

      {/* --- BOUTONS D'ACTION (Delete/Move) --- */}
      {!readOnly && (
        <div className="absolute top-2 left-2 right-2 flex justify-between z-20 pointer-events-none">
            {isWishlist && onMove && (
            <button onClick={onMove} className="pointer-events-auto p-1.5 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm" title="Déplacer vers Collection">📦</button>
            )}
            
            {!isWishlist && <div></div>} 

            {onDelete && (
            <button onClick={onDelete} className="pointer-events-auto p-1.5 bg-red-50 text-gray-400 hover:text-white hover:bg-red-600 rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100" title="Supprimer">🗑️</button>
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
        {isFoil && <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-transparent pointer-events-none mix-blend-overlay"></div>}

        {imageBackUrl && (
          <button onClick={() => setIsFlipped(!isFlipped)} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-all shadow-lg border border-white/20 z-10 pointer-events-auto">
            🔄
          </button>
        )}
      </div>
      
      {/* --- INFO CARTE --- */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-start">
            <h3 className="font-bold text-sm md:text-base truncate mb-1 flex-grow" title={name}>{name}</h3>
        </div>
        
        <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-blue-600 dark:text-blue-400 truncate font-medium max-w-[70%]">{setName}</p>
            {readOnly && isFoil && <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200">Foil</span>}
            {readOnly && isSpecificVersion && <span className="text-[10px] bg-gray-100 text-gray-700 px-1 rounded border border-gray-200">Exact</span>}
            {/* BADGE TRADE */}
            {isForTrade && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded border border-green-200 font-bold flex items-center gap-1">🤝 Échange</span>}
        </div>
        
        <div className="mt-auto flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-2">
          
          <div className="flex items-center gap-2">
            {!readOnly && <button onClick={onDecrement} className="bg-gray-200 dark:bg-gray-700 w-7 h-7 rounded hover:bg-gray-300 font-bold flex items-center justify-center">-</button>}
            <span className={`font-mono text-lg ${readOnly ? 'font-bold text-gray-800 dark:text-white' : 'w-5 text-center'}`}>{readOnly && "x"}{quantity}</span>
            {!readOnly && <button onClick={onIncrement} className="bg-blue-100 dark:bg-blue-900 text-blue-600 font-bold w-7 h-7 rounded hover:bg-blue-200 flex items-center justify-center">+</button>}
          </div>
          
          <div className="text-right cursor-help" title="Prix unitaire Scryfall ou Perso">
             <p className="text-[10px] text-gray-400">Unit: {effectivePrice.toFixed(2)}€</p>
             <p className={`font-bold ${customPrice ? 'text-orange-600' : 'text-gray-700 dark:text-gray-200'}`}>
                 {(effectivePrice * quantity).toFixed(2)} €
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}