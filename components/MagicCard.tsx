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
  isForTrade?: boolean; 
  
  onDelete?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onMove?: () => void;
  
  onEditPrice?: (newPrice: number) => void;
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
                    {isSpecificVersion && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1 rounded text-[9px] border border-blue-200" title="Édition exacte requise">🔒 EXACT</span>}
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
    <div className={`relative group flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-3 gap-2 border transition-colors h-full ${isFoil ? 'border-purple-300 dark:border-purple-800 shadow-purple-100 dark:shadow-none' : 'border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500'}`}>
      
      {/* IMAGE (Sans boutons flottants) */}
      <div className="relative w-full aspect-[2.5/3.5] bg-gray-200 rounded-lg overflow-hidden shrink-0">
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
        <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold text-sm md:text-base truncate flex-grow" title={name}>{name}</h3>
        </div>
        
        <p className="text-xs text-blue-600 dark:text-blue-400 truncate font-medium mb-2">{setName}</p>

        {/* --- ZONE D'OPTIONS TEXTUELLES --- */}
        <div className="flex flex-wrap gap-1.5 mb-2">
            
            {/* 1. TOGGLE FOIL */}
            {onToggleAttribute ? (
                <button 
                    onClick={() => onToggleAttribute('isFoil', !!isFoil)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-medium flex-1 text-center ${
                        isFoil 
                        ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300' 
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600'
                    }`}
                >
                    {isFoil ? '✨ Foil' : 'Normal'}
                </button>
            ) : isFoil && (
                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-medium">✨ Foil</span>
            )}

            {/* 2. WISHLIST : VERSION & ACHAT */}
            {isWishlist && (
                <>
                    {/* Version */}
                    {onToggleAttribute && (
                        <button 
                            onClick={() => onToggleAttribute('isSpecificVersion', !!isSpecificVersion)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-medium flex-1 text-center ${
                                isSpecificVersion 
                                ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300' 
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600'
                            }`}
                            title="Exiger cette version exacte"
                        >
                            {isSpecificVersion ? '🔒 Exact' : 'Auto'}
                        </button>
                    )}
                    {/* BOUTON J'AI ACHETÉ */}
                    {!readOnly && onMove && (
                        <button 
                            onClick={onMove}
                            className="text-[10px] px-2 py-0.5 rounded border transition-colors font-bold flex-1 text-center bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                            title="Déplacer vers Collection"
                        >
                            J&apos;ai acheté
                        </button>
                    )}
                </>
            )}

            {/* 3. COLLECTION : ÉCHANGE */}
            {!isWishlist && (
                onToggleAttribute ? (
                    <button 
                        onClick={() => onToggleAttribute('isForTrade', !!isForTrade)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-medium flex-1 text-center ${
                            isForTrade 
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600'
                        }`}
                        title="Disponible dans les échanges ?"
                    >
                        {isForTrade ? '🤝 Échange' : 'Privé'}
                    </button>
                ) : isForTrade && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200 font-medium">🤝 Échange</span>
                )
            )}
        </div>
        
        {/* --- FOOTER (Quantité & Prix) --- */}
        <div className="mt-auto flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-2">
          
          <div className="flex items-center gap-1.5">
            {!readOnly && <button onClick={onDecrement} className="bg-gray-200 dark:bg-gray-700 w-6 h-6 rounded hover:bg-gray-300 font-bold flex items-center justify-center text-sm">-</button>}
            <span className={`font-mono text-base ${readOnly ? 'font-bold text-gray-800 dark:text-white' : 'w-4 text-center'}`}>{readOnly && "x"}{quantity}</span>
            {!readOnly && <button onClick={onIncrement} className="bg-blue-100 dark:bg-blue-900 text-blue-600 font-bold w-6 h-6 rounded hover:bg-blue-200 flex items-center justify-center text-sm">+</button>}
          </div>
          
          <div className="text-right cursor-help" title="Prix unitaire Scryfall ou Perso">
             <p className="text-[10px] text-gray-400">Unit: {effectivePrice.toFixed(2)}€</p>
             <p className={`font-bold text-sm ${customPrice ? 'text-orange-600' : 'text-gray-700 dark:text-gray-200'}`}>
                 {(effectivePrice * quantity).toFixed(2)} €
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}