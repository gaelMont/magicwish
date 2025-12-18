'use client';

import { useState, useEffect, memo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Imports des sous-composants
import CardImage from '@/components/magic-card/CardImage';
import CardTags from '@/components/magic-card/CardTags';
import CardQuantity from '@/components/magic-card/CardQuantity';
import CardTradeQuantity from '@/components/magic-card/CardTradeQuantity';
import CardPrice from '@/components/magic-card/CardPrice';

import { useDebouncedUpdate } from '@/hooks/useDebounceUpdate';
import { ScryfallRawData } from '@/lib/cardUtils';

type MatchStatus = 'my_wishlist' | 'my_trade_binder' | 'none';

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
    
    scryfallData?: ScryfallRawData | Record<string, unknown> | null;
    
    onIncrement?: () => void;
    onDecrement?: () => void;
    onQuantityChange?: (newQuantity: number) => void;
    
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
    matchStatus?: MatchStatus;
};

const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

function MagicCard(props: MagicCardProps) {
    const router = useRouter();
    const { 
        name, imageUrl, imageBackUrl, quantity = 1, 
        price, customPrice, setName, 
        isFoil, isSpecificVersion, quantityForTrade, scryfallData,
        isTradeView, allowPriceEdit, 
        onEditPrice, onToggleAttribute, 
        readOnly, isWishlist,
        onIncrement, onDecrement, onQuantityChange,
        onMove,
        onIncrementTrade, onDecrementTrade, 
        isSelectMode, isSelected, onSelect,
        returnTo,
        matchStatus 
    } = props;
    
    // --- GESTION DU FLIP ---
    const [isFlipped, setIsFlipped] = useState(false);
    
    // --- GESTION QUANTITÉ OPTIMISÉE ---
    const [localQty, setLocalQty] = useState(quantity);
    
    // On utilise une Ref pour savoir si la mise à jour vient de nous (local) ou du parent
    const isLocalUpdate = useRef(false);

    // Synchronisation Parent -> Enfant
    // On ne met à jour localQty que si la props change VRAIMENT et que ce n'est pas nous qui venons de la changer
    useEffect(() => {
        if (!isLocalUpdate.current) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocalQty(quantity);
        }
        // Une fois synchronisé, on reset le flag
        isLocalUpdate.current = false;
    }, [quantity]);

    // Création de la fonction de debounce STABLE
    const debouncedCommit = useDebouncedUpdate((val: number) => {
        if (onQuantityChange) {
            onQuantityChange(val);
        }
    }, 600); // 600ms de délai avant d'écrire en base

    const handleOptimisticIncrement = () => {
        const newVal = localQty + 1;
        setLocalQty(newVal); // Mise à jour visuelle instantanée
        isLocalUpdate.current = true; // On signale que c'est une modif locale
        
        if (onQuantityChange) {
            debouncedCommit(newVal); // On lance le chrono pour la DB
        } else if (onIncrement) {
            onIncrement();
        }
    };

    const handleOptimisticDecrement = () => {
        if (localQty <= 1) {
            // Si on passe à 0 (suppression), on appelle directement sans debounce pour la confirmation
            if (onDecrement) onDecrement();
            return;
        }
        const newVal = localQty - 1;
        setLocalQty(newVal);
        isLocalUpdate.current = true;

        if (onQuantityChange) {
            debouncedCommit(newVal);
        } else if (onDecrement) {
            onDecrement();
        }
    };

    // --- GESTION PRIX ---
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    
    const displayPriceSource = (() => {
        if ((isTradeView || allowPriceEdit) && customPrice !== undefined) return customPrice;
        if (scryfallData && typeof scryfallData === 'object' && 'prices' in scryfallData) {
            const data = scryfallData as ScryfallRawData;
            const prices = data.prices;
            if (prices) {
                const rawPrice = isFoil ? prices.eur_foil : prices.eur;
                if (rawPrice) return parseFloat(rawPrice);
                if (isFoil && !rawPrice) return 0;
            }
        }
        return price || 0;
    })();

    const [tempPrice, setTempPrice] = useState(displayPriceSource.toString());

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!isEditingPrice) setTempPrice(displayPriceSource.toString());
    }, [displayPriceSource, isEditingPrice]);

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
      
    let matchClasses = 'border-border bg-surface hover:border-primary';
    if (matchStatus === 'my_wishlist' || matchStatus === 'my_trade_binder') {
        matchClasses = 'bg-green-500/10 border-green-500/30 hover:border-green-500'; 
    }

    // --- VUE LISTE (Trade View) ---
    if (isTradeView) {
        return (
          <div className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-border content-visibility-auto transition-colors select-none">
              <div className="font-bold text-lg w-8 text-center">{quantity}x</div>
              <div className="w-10 h-14 bg-secondary rounded overflow-hidden shrink-0 relative group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                   <Image src={currentImage || CARD_BACK_URL} className="w-full h-full object-cover" alt={name} fill sizes="40px" />
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
                          onClick={(e) => { 
                              e.stopPropagation();
                              if (allowPriceEdit) { setTempPrice(displayPriceSource.toString()); setIsEditingPrice(true); }
                          }}
                      >
                          {displayPriceString}
                      </div>
                  )}
              </div>
          </div>
        );
    }

    // --- VUE GRILLE (Standard) ---
    return (
      <div 
          onClick={handleCardClick}
          className={`relative group flex flex-col rounded-xl overflow-hidden p-2 gap-1.5 h-full content-visibility-auto select-none
          transition-all duration-200 shadow-sm hover:shadow-md
          ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : matchClasses} 
          ${isSelectMode || !isTradeView ? 'cursor-pointer' : ''} 
          `}
      >
        <CardImage 
           imageUrl={imageUrl} 
           imageBackUrl={imageBackUrl} 
           name={name} 
           isFoil={isFoil} 
           isSelectMode={isSelectMode} 
           isSelected={isSelected} 
           isFlipped={isFlipped}
           onFlip={() => setIsFlipped(!isFlipped)}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex justify-between items-start mb-0.5">
              <h3 className="font-semibold text-xs leading-tight text-foreground truncate grow" title={name}>{name}</h3>
          </div>
          <p className="text-[10px] text-muted truncate mb-1">{setName}</p>

          <CardTags 
              isWishlist={isWishlist} 
              readOnly={readOnly} 
              isSelectMode={isSelectMode} 
              isFoil={isFoil} 
              isSpecificVersion={isSpecificVersion}
              onToggleAttribute={onToggleAttribute}
              onMove={onMove}
          />
          
          <div className={`mt-2 border-t border-border pt-1.5 flex justify-between items-center min-h-[26px] ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
              
              <div className="flex-1 flex justify-start items-center min-w-0">
                  <CardQuantity 
                      quantity={localQty} 
                      readOnly={readOnly} 
                      onIncrement={handleOptimisticIncrement} 
                      onDecrement={handleOptimisticDecrement} 
                  />
              </div>

              <div className="shrink-0 flex justify-center mx-1">
                  {!isWishlist && !readOnly && !isSelectMode && (
                      <CardTradeQuantity 
                          quantity={localQty} 
                          tradeQty={tradeQty} 
                          onIncrementTrade={onIncrementTrade} 
                          onDecrementTrade={onDecrementTrade} 
                      />
                  )}
              </div>

              <div className="flex-1 flex justify-end items-center min-w-0">
                  <CardPrice 
                      displayPriceString={displayPriceString} 
                      hasPrice={hasPrice}
                      isFoil={isFoil}
                  />
              </div>
            
          </div>
        </div>
      </div>
    );
}

// --- COMPARATEUR DE PERFORMANCE (CRUCIAL) ---
// C'est cette partie qui empêche le re-rendu visuel (clignotement) 
// quand le parent recrée les objets
const arePropsEqual = (prev: MagicCardProps, next: MagicCardProps) => {
    return (
        prev.id === next.id &&
        prev.quantity === next.quantity &&
        prev.quantityForTrade === next.quantityForTrade &&
        prev.price === next.price &&
        prev.customPrice === next.customPrice &&
        prev.isFoil === next.isFoil &&
        prev.isSelected === next.isSelected &&
        prev.isSelectMode === next.isSelectMode &&
        prev.matchStatus === next.matchStatus &&
        // On compare les images pour être sûr
        prev.imageUrl === next.imageUrl
        // On IGNORE scryfallData et les fonctions callbacks qui changent tout le temps
    );
};

export default memo(MagicCard, arePropsEqual);