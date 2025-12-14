// components/MagicCard.tsx
'use client';

import { useState, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';

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
  quantityForTrade?: number; 
  onIncrement?: () => void;
  onDecrement?: () => void;
  onMove?: () => void;
  onEditPrice?: (newPrice: number) => void;
  onToggleAttribute?: (field: 'isFoil' | 'isSpecificVersion', currentValue: boolean) => void;
  onIncrementTrade?: () => void; 
  onDecrementTrade?: () => void;
  
  isWishlist?: boolean;
  readOnly?: boolean;
  isTradeView?: boolean;
  allowPriceEdit?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  returnTo?: string;
};

const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

function MagicCard(props: MagicCardProps) {
  const router = useRouter();
  const { 
      name, imageUrl, imageBackUrl, quantity = 1, 
      price, customPrice, setName, 
      isFoil, isSpecificVersion, quantityForTrade,
      isTradeView, allowPriceEdit, 
      onEditPrice, onToggleAttribute, 
      readOnly, isWishlist,
      onIncrement, onDecrement, onMove,
      onIncrementTrade, onDecrementTrade, 
      isSelectMode, isSelected, onSelect,
      returnTo
  } = props;
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  
  const displayPriceSource = (isTradeView || allowPriceEdit) && customPrice !== undefined ? customPrice : (price || 0);
  const [tempPrice, setTempPrice] = useState(displayPriceSource.toString());

  useEffect(() => {
    if (!isEditingPrice) {
        const newVal = (isTradeView || allowPriceEdit) && customPrice !== undefined ? customPrice : (price || 0);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTempPrice(newVal.toString());
    }
  }, [customPrice, price, isEditingPrice, isTradeView, allowPriceEdit]);

  const tradeQty = quantityForTrade ?? 0;
  const hasPrice = displayPriceSource > 0;
  const displayPriceString = hasPrice ? `${displayPriceSource.toFixed(2)} €` : "N/A";

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
          return;
      } 
      if (isTradeView) {
         if (imageBackUrl) setIsFlipped(!isFlipped);
         return;
      }
      if (props.id) {
          const url = returnTo 
            ? `/card/${props.id}?returnTo=${encodeURIComponent(returnTo)}`
            : `/card/${props.id}`;
          router.push(url);
          return;
      }
      if (imageBackUrl) {
          setIsFlipped(!isFlipped);
      }
  };

  // --- VUE LISTE (Pour les echanges) ---
  if (isTradeView) {
      return (
        <div className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-border content-visibility-auto transition-colors select-none">
            <div className="w-10 h-14 bg-secondary rounded overflow-hidden shrink-0 relative group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                 <img src={currentImage} className="w-full h-full object-cover" alt={name} loading="lazy" />
            </div>
            <div className="grow min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate text-foreground" title={name}>{name}</p>
                    {isFoil && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">FOIL</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                    <p className="truncate">{setName}</p>
                </div>
            </div>
            <div className="text-right flex flex-col items-end">
                {isEditingPrice ? (
                    <div className="flex items-center gap-1">
                        <input type="number" value={tempPrice} onChange={(e) => setTempPrice(e.target.value)} className="w-16 p-1 text-xs border rounded bg-background text-foreground" autoFocus />
                        <button onClick={handleSavePrice} className="text-success text-xs font-bold">OK</button>
                    </div>
                ) : (
                    <div 
                        className={`font-medium text-sm ${customPrice ? 'text-orange-600' : 'text-foreground'} ${allowPriceEdit ? 'cursor-pointer hover:text-primary' : ''}`}
                        onClick={() => { if (allowPriceEdit) { setTempPrice(displayPriceSource.toString()); setIsEditingPrice(true); }}}
                    >
                        {displayPriceSource.toFixed(2)} EUR
                    </div>
                )}
            </div>
        </div>
      );
  }

  // --- VUE GRILLE (Collection) ---
  return (
    <div 
        onClick={handleCardClick}
        className={`relative group flex flex-col rounded-xl overflow-hidden p-2 gap-1.5 h-full content-visibility-auto select-none
        bg-surface border transition-all duration-200 shadow-sm hover:shadow-md
        ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border hover:border-primary'}
        ${isSelectMode || !isTradeView ? 'cursor-pointer' : ''} 
        `}
    >
      {isSelectMode && (
          <div className="absolute top-2 right-2 z-30 pointer-events-none">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'bg-surface border-muted'}`}>
                  {isSelected && <span className="text-primary-foreground text-xs font-bold">V</span>}
              </div>
          </div>
      )}

      {/* IMAGE */}
      <div className="relative w-full aspect-[2.5/3.5] bg-secondary rounded-lg overflow-hidden shrink-0">
        <img
          src={currentImage || CARD_BACK_URL}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
        />
        {isFoil && <div className="absolute bottom-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-tl-md shadow-sm">FOIL</div>}
        {imageBackUrl && !isSelectMode && (
          <button onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100 z-10 text-[9px] font-bold">Flip</button>
        )}
      </div>
      
      {/* INFOS */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-0.5">
            <h3 className="font-semibold text-xs leading-tight text-foreground truncate grow" title={name}>{name}</h3>
        </div>
        <p className="text-[10px] text-muted truncate mb-1">{setName}</p>

        {/* TAGS */}
        <div className={`flex flex-wrap gap-1 mb-auto ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
            {onToggleAttribute ? (
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleAttribute('isFoil', !!isFoil); }}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors font-medium flex-1 text-center ${
                        isFoil ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'bg-secondary text-muted border-transparent hover:bg-border'
                    }`}
                >
                    {isFoil ? 'Foil' : 'Normal'}
                </button>
            ) : null}

            {isWishlist && onToggleAttribute && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleAttribute('isSpecificVersion', !!isSpecificVersion); }}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors font-medium flex-1 text-center ${
                        isSpecificVersion ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary text-muted border-transparent'
                    }`}
                >
                    {isSpecificVersion ? 'Exact' : 'Auto'}
                </button>
            )}
            
            {isWishlist && !readOnly && !isSelectMode && onMove && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onMove(); }}
                    className="text-[9px] px-1.5 py-0.5 rounded border transition-colors font-bold flex-1 text-center bg-surface text-success border-success/30 hover:bg-success/5"
                    title="J'ai recu cette carte"
                >
                    Achete
                </button>
            )}
        </div>
        
        {/* FOOTER : CORRECTION FLEXBOX (Plus robuste pour les petits espaces) */}
        <div className={`mt-2 border-t border-border pt-1.5 flex justify-between items-center min-h-[26px] ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
            
            {/* 1. QUANTITE (GAUCHE) */}
            <div className="flex-1 flex justify-start items-center min-w-0">
                <div className="flex items-center bg-secondary rounded-[4px] p-[1px] border border-border h-[20px]">
                    {!readOnly && <button onClick={(e) => {e.stopPropagation(); onDecrement?.()}} className="w-3.5 h-full hover:bg-border text-muted hover:text-foreground rounded-[2px] flex items-center justify-center text-[10px] font-bold transition leading-none">-</button>}
                    <span className={`text-[10px] leading-none flex items-center justify-center h-full px-1 font-bold text-foreground min-w-[12px]`}>{quantity}</span>
                    {!readOnly && <button onClick={(e) => {e.stopPropagation(); onIncrement?.()}} className="w-3.5 h-full bg-primary/10 hover:bg-primary/20 text-primary rounded-[2px] flex items-center justify-center text-[10px] font-bold transition leading-none">+</button>}
                </div>
            </div>

            {/* 2. TRADE (CENTRE) - Flex Shrinkable mais priorité au contenu */}
            <div className="shrink-0 flex justify-center mx-1">
                {!isWishlist && !readOnly && !isSelectMode && (
                    <div className="flex items-center bg-success/10 border border-success/20 rounded-[4px] p-[1px] h-[20px]">
                        <button 
                            onClick={(e) => {e.stopPropagation(); onDecrementTrade?.()}} 
                            disabled={tradeQty <= 0}
                            className="w-3.5 h-full hover:bg-success/20 text-success/70 hover:text-success rounded-[2px] flex items-center justify-center text-[10px] font-bold transition leading-none disabled:opacity-30" 
                        >
                            -
                        </button>
                        
                        <span className="text-[10px] leading-none flex items-center justify-center h-full px-1 font-bold text-success min-w-[12px]">
                            {tradeQty}
                        </span>

                        <button 
                            onClick={(e) => {e.stopPropagation(); onIncrementTrade?.()}} 
                            disabled={tradeQty >= quantity}
                            className="w-3.5 h-full hover:bg-success/20 text-success/70 hover:text-success rounded-[2px] flex items-center justify-center text-[10px] font-bold transition leading-none disabled:opacity-30" 
                        >
                            +
                        </button>
                    </div>
                )}
            </div>

            {/* 3. PRIX (DROITE) */}
            <div className="flex-1 flex justify-end items-center min-w-0">
                <p className={`font-bold text-[10px] whitespace-nowrap leading-none ${!hasPrice ? 'text-muted italic' : 'text-foreground'}`}>
                    {displayPriceString}
                </p>
            </div>
          
        </div>
      </div>
    </div>
  );
}

export default memo(MagicCard);