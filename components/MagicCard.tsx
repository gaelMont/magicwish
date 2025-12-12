'use client';

import { useState, useEffect, memo } from 'react';

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 content-visibility-auto shadow-sm">
            <div className="w-10 h-14 bg-gray-200 rounded overflow-hidden flex-shrink-0 relative group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                 <img src={currentImage} className="w-full h-full object-cover" alt={name} loading="lazy" />
                 {isFoil && <div className="absolute top-0 right-0 bg-gradient-to-tr from-purple-600 to-pink-600 text-white text-[8px] px-1 font-bold">FOIL</div>}
            </div>
            
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate text-slate-900 dark:text-white" title={name}>{name}</p>
                    {isFoil && <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">FOIL</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <p className="truncate">{setName}</p>
                    {isSpecificVersion && <span className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded text-[9px] border border-blue-200 font-bold">EXACT</span>}
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
                        className={`font-bold text-sm ${customPrice ? 'text-orange-600' : 'text-slate-700 dark:text-slate-300'} ${allowPriceEdit ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => { if (allowPriceEdit) { setTempPrice(effectivePrice.toString()); setIsEditingPrice(true); }}}
                        title={customPrice ? "Prix personnalisé" : "Prix Scryfall"}
                    >
                        {effectivePrice.toFixed(2)} €
                        {customPrice && <span className="text-[8px] align-top ml-0.5 text-orange-500">*</span>}
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
        
        /* --- ESTHÉTIQUE MODERNE (PEPS) --- */
        /* Fond Blanc (sur fond gris de page) + Ombre douce + Bordure fine */
        bg-white dark:bg-slate-800 
        border transition-all duration-300
        
        /* Effet "Lift" au survol : la carte se soulève et l'ombre grandit */
        shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1
        dark:shadow-none dark:hover:border-indigo-500/50
        
        ${isSelected 
            ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
            : isFoil 
                ? 'border-purple-200 dark:border-purple-900 hover:border-purple-400' 
                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'
        }
        ${isSelectMode ? 'cursor-pointer' : ''}
        `}
    >

      {isSelectMode && (
          <div className="absolute top-2 right-2 z-30 pointer-events-none">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-md ${isSelected ? 'bg-indigo-600 border-indigo-600 scale-110' : 'bg-white/90 border-slate-300'}`}>
                  {isSelected && <span className="text-white text-sm font-bold">✓</span>}
              </div>
          </div>
      )}

      {/* Image Container */}
      <div className="relative w-full aspect-[2.5/3.5] bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden shrink-0 shadow-inner">
        <img
          src={currentImage || CARD_BACK_URL}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
        />
        {/* Effet Foil Amélioré */}
        {isFoil && <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/30 via-transparent to-indigo-500/10 pointer-events-none mix-blend-overlay opacity-80"></div>}

        {imageBackUrl && !isSelectMode && (
          <button onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-all shadow-lg border border-white/20 z-10 pointer-events-auto font-bold text-[10px] tracking-widest uppercase opacity-0 group-hover:opacity-100">
            FLIP
          </button>
        )}
      </div>
      
      {/* Contenu Texte & Boutons */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-1 mt-1">
            <h3 className="font-bold text-sm md:text-base truncate flex-grow text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors" title={name}>{name}</h3>
        </div>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium mb-3">{setName}</p>

        <div className={`flex flex-wrap gap-1.5 mb-2 ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
            
            {onToggleAttribute ? (
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleAttribute('isFoil', !!isFoil); }}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-all font-semibold flex-1 text-center ${
                        isFoil 
                        ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200 hover:shadow-sm dark:from-purple-900/40 dark:to-pink-900/40 dark:text-purple-300 dark:border-purple-800' 
                        : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:border-slate-700'
                    }`}
                >
                    {isFoil ? 'Foil' : 'Normal'}
                </button>
            ) : isFoil && ( <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-medium">Foil</span> )}

            {isWishlist ? (
                onToggleAttribute && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleAttribute('isSpecificVersion', !!isSpecificVersion); }}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors font-semibold flex-1 text-center ${
                            isSpecificVersion 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}
                    >
                        {isSpecificVersion ? 'Exact' : 'Auto'}
                    </button>
                )
            ) : (
                onToggleAttribute && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleAttribute('isForTrade', !!isForTrade); }}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors font-semibold flex-1 text-center ${
                            isForTrade 
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:border-slate-700'
                        }`}
                    >
                        {isForTrade ? 'Trade' : 'Privé'}
                    </button>
                )
            )}
            
            {isWishlist && !readOnly && !isSelectMode && onMove && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onMove(); }}
                    className="text-[10px] px-2 py-1 rounded-md border transition-colors font-bold flex-1 text-center bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:shadow-sm dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                    title="Déplacer vers Collection"
                >
                    Acheté
                </button>
            )}
        </div>
        
        <div className={`mt-auto flex justify-between items-end border-t border-slate-100 dark:border-slate-700 pt-2 ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="flex items-center gap-1">
            {!readOnly && <button onClick={(e) => {e.stopPropagation(); onDecrement?.()}} className="bg-slate-100 dark:bg-slate-700 w-6 h-6 rounded-md hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-sm transition-colors">-</button>}
            <span className={`font-mono text-base ${readOnly ? 'font-bold text-slate-800 dark:text-white' : 'w-5 text-center text-slate-700 dark:text-slate-200'}`}>{readOnly && "x"}{quantity}</span>
            {!readOnly && <button onClick={(e) => {e.stopPropagation(); onIncrement?.()}} className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold w-6 h-6 rounded-md hover:bg-indigo-100 flex items-center justify-center text-sm transition-colors border border-indigo-100 dark:border-indigo-800">+</button>}
          </div>
          
          <div className="text-right">
             <p className="text-[9px] text-slate-400 uppercase tracking-wide">Unit: {effectivePrice.toFixed(2)}</p>
             <p className={`font-bold text-sm ${customPrice ? 'text-orange-600' : 'text-slate-700 dark:text-slate-200'}`}>
                 {(effectivePrice * quantity).toFixed(2)} €
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MagicCard);