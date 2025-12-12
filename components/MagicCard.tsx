'use client';

import { useState, useEffect, memo } from 'react';

// ... (Garde les Types MagicCardProps inchangés) ...
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
  onIncrement?: () => void;
  onDecrement?: () => void;
  onMove?: () => void;
  onEditPrice?: (newPrice: number) => void;
  onToggleAttribute?: (field: 'isFoil' | 'isSpecificVersion' | 'isForTrade', currentValue: boolean) => void;
  isWishlist?: boolean;
  readOnly?: boolean;
  isTradeView?: boolean;
  allowPriceEdit?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
};

const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

function MagicCard(props: MagicCardProps) {
  // ... (Garde toute la logique JS inchangée : destructuring, hooks, handlers...) ...
  const { 
      name, imageUrl, imageBackUrl, quantity = 1, 
      price, customPrice, setName, 
      isFoil, isSpecificVersion, isForTrade,
      isTradeView, allowPriceEdit, 
      onEditPrice, onToggleAttribute, 
      readOnly, isWishlist,
      onIncrement, onDecrement, onMove,
      isSelectMode, isSelected, onSelect
  } = props;
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState(customPrice?.toString() || price?.toString() || "0");

  useEffect(() => {
    if (!isEditingPrice) {
        const newVal = customPrice?.toString() || price?.toString() || "0";
        setTempPrice(prev => (prev !== newVal ? newVal : prev));
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

  const handleCardClick = () => {
      if (isSelectMode && onSelect) {
          onSelect();
      } else if (imageBackUrl) {
          setIsFlipped(!isFlipped);
      }
  };

  // --- VUE LISTE (TRADE) ---
  if (isTradeView) {
      return (
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 content-visibility-auto">
            <div className="w-10 h-14 bg-zinc-100 rounded overflow-hidden flex-shrink-0 relative group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                 <img src={currentImage} className="w-full h-full object-cover" alt={name} loading="lazy" />
            </div>
            
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate text-zinc-900 dark:text-zinc-100" title={name}>{name}</p>
                    {isFoil && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">FOIL</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <p className="truncate">{setName}</p>
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
                        className={`font-medium text-sm ${customPrice ? 'text-orange-600' : 'text-zinc-700 dark:text-zinc-300'} ${allowPriceEdit ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => { if (allowPriceEdit) { setTempPrice(effectivePrice.toString()); setIsEditingPrice(true); }}}
                    >
                        {effectivePrice.toFixed(2)} €
                    </div>
                )}
            </div>
        </div>
      );
  }

  // --- VUE NORMALE (GRILLE) ---
  return (
    <div 
        onClick={handleCardClick}
        className={`relative group flex flex-col rounded-xl overflow-hidden p-3 gap-2 h-full content-visibility-auto
        
        /* DESIGN NEUTRE : Fond blanc, bordure gris clair, ombre douce */
        bg-white dark:bg-zinc-900 
        border transition-all duration-200
        shadow-sm hover:shadow-md
        
        /* SÉLECTION : Juste une bordure bleue simple, pas de fond coloré agressif */
        ${isSelected 
            ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10' 
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
        }
        ${isSelectMode ? 'cursor-pointer' : ''}
        `}
    >

      {isSelectMode && (
          <div className="absolute top-2 right-2 z-30 pointer-events-none">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-zinc-300'}`}>
                  {isSelected && <span className="text-white text-xs font-bold">✓</span>}
              </div>
          </div>
      )}

      {/* Image */}
      <div className="relative w-full aspect-[2.5/3.5] bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden shrink-0">
        <img
          src={currentImage || CARD_BACK_URL}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
        />
        
        {/* Badge Foil discret en bas à droite de l'image */}
        {isFoil && <div className="absolute bottom-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-tl-md shadow-sm">FOIL</div>}

        {imageBackUrl && !isSelectMode && (
          <button onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100 z-10 text-[9px] font-bold">
            ↻
          </button>
        )}
      </div>
      
      {/* Contenu */}
      <div className="flex-1 flex flex-col min-w-0 pt-1">
        <div className="flex justify-between items-start mb-0.5">
            <h3 className="font-semibold text-sm leading-tight text-zinc-900 dark:text-zinc-100 truncate flex-grow" title={name}>{name}</h3>
        </div>
        
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mb-2">{setName}</p>

        {/* Boutons Actions (Plus petits, gris neutres qui passent au bleu/vert au clic) */}
        <div className={`flex flex-wrap gap-1 mb-2 ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
            
            {onToggleAttribute ? (
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleAttribute('isFoil', !!isFoil); }}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors font-medium flex-1 text-center ${
                        isFoil 
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' 
                        : 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700'
                    }`}
                >
                    {isFoil ? 'Foil' : 'Normal'}
                </button>
            ) : null}

            {isWishlist ? (
                onToggleAttribute && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleAttribute('isSpecificVersion', !!isSpecificVersion); }}
                        className={`text-[10px] px-2 py-1 rounded border transition-colors font-medium flex-1 text-center ${
                            isSpecificVersion 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-zinc-50 text-zinc-400 border-zinc-100'
                        }`}
                    >
                        {isSpecificVersion ? 'Exact' : 'Auto'}
                    </button>
                )
            ) : (
                onToggleAttribute && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleAttribute('isForTrade', !!isForTrade); }}
                        className={`text-[10px] px-2 py-1 rounded border transition-colors font-medium flex-1 text-center ${
                            isForTrade 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:bg-zinc-100'
                        }`}
                    >
                        {isForTrade ? 'Trade' : 'Privé'}
                    </button>
                )
            )}
            
            {isWishlist && !readOnly && !isSelectMode && onMove && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onMove(); }}
                    className="text-[10px] px-2 py-1 rounded border transition-colors font-bold flex-1 text-center bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    title="J'ai reçu cette carte"
                >
                    Acheté
                </button>
            )}
        </div>
        
        {/* Footer Prix & Quantité */}
        <div className={`mt-auto flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-2 ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="flex items-center gap-1">
            {!readOnly && <button onClick={(e) => {e.stopPropagation(); onDecrement?.()}} className="w-5 h-5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center text-xs font-bold transition">-</button>}
            <span className={`text-sm ${readOnly ? 'font-bold text-zinc-700 dark:text-zinc-300' : 'w-4 text-center text-zinc-700 dark:text-zinc-300'}`}>{readOnly && "x"}{quantity}</span>
            {!readOnly && <button onClick={(e) => {e.stopPropagation(); onIncrement?.()}} className="w-5 h-5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 flex items-center justify-center text-xs font-bold transition">+</button>}
          </div>
          
          <div className="text-right leading-none">
             <p className={`font-bold text-sm ${customPrice ? 'text-orange-600' : 'text-zinc-700 dark:text-zinc-200'}`}>
                 {(effectivePrice * quantity).toFixed(2)} €
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MagicCard);