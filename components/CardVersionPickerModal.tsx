'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { CardType } from '@/hooks/useCardCollection';
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils'; 
import { WishlistMeta } from '@/hooks/useWishlists'; 
import toast from 'react-hot-toast';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  baseCard: ScryfallRawData | null; 
  onConfirm: (card: CardType, targetListId?: string) => void;
  destination?: 'collection' | 'wishlist'; 
  availableLists?: WishlistMeta[];
};

interface ScryfallSearchResponse {
  data: ScryfallRawData[];
  has_more: boolean;
  next_page?: string;
  total_cards: number;
}

export default function CardVersionPickerModal({ 
  isOpen, onClose, baseCard, onConfirm, destination, availableLists 
}: Props) {
  const [versions, setVersions] = useState<ScryfallRawData[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [isFoil, setIsFoil] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false); 
  const [anyVersion, setAnyVersion] = useState(false);
  
  const [selectedListId, setSelectedListId] = useState<string>('default');

  useEffect(() => {
    const fetchVersions = async (oracleId: string) => {
        setLoading(true);
        try {
          const res = await fetch(`https://api.scryfall.com/cards/search?q=oracle_id:${oracleId}%20game:paper&unique=prints&order=released`);
          const data: ScryfallSearchResponse = await res.json();
          
          if (data.data && data.data.length > 0) {
            setVersions(data.data); 
            const defaultVer = data.data.find((c: ScryfallRawData) => c.id === baseCard?.id) || data.data[0];
            setSelectedVersionId(defaultVer.id);
          }
        } catch (e) {
          console.error(e);
          toast.error("Impossible de charger les versions");
        } finally {
          setLoading(false);
        }
    };

    if (isOpen && baseCard?.oracle_id) {
      fetchVersions(baseCard.oracle_id as string);
    }

    setQuantity(1);
    setIsFlipped(false);
    setAnyVersion(false);
    setSelectedListId('default'); 
  }, [isOpen, baseCard]); 

  const currentCardRaw = useMemo(() => {
    return versions.find(v => v.id === selectedVersionId) || baseCard;
  }, [versions, selectedVersionId, baseCard]);

  const priceNormal = parseFloat(currentCardRaw?.prices?.eur || "0");
  const priceFoil = parseFloat(currentCardRaw?.prices?.eur_foil || "0");
  
  const hasFoilVersion = currentCardRaw?.finishes?.includes('foil') || priceFoil > 0;
  const hasNonFoilVersion = currentCardRaw?.finishes?.includes('nonfoil') || priceNormal > 0;

  useEffect(() => {
    if (!currentCardRaw) return;

    if (isFoil && !hasFoilVersion && hasNonFoilVersion) {
        setIsFoil(false);
    } else if (!isFoil && !hasNonFoilVersion && hasFoilVersion) {
        setIsFoil(true);
    }
  }, [isFoil, hasFoilVersion, hasNonFoilVersion, currentCardRaw]);

  if (!isOpen || !currentCardRaw) return null;

  const { imageUrl, imageBackUrl, name, setName, setCode } = normalizeCardData(currentCardRaw);

  const currentPrice = isFoil 
    ? (priceFoil > 0 ? priceFoil : 0) 
    : (priceNormal > 0 ? priceNormal : 0);

  const handleConfirm = () => {
    const finalCard: CardType = {
        id: currentCardRaw.id,
        name: name,
        imageUrl: imageUrl,
        imageBackUrl: imageBackUrl || null,
        quantity: quantity,
        price: currentPrice,
        setName: setName,
        setCode: setCode,
        isFoil: isFoil,
        isSpecificVersion: !anyVersion,
        scryfallData: currentCardRaw,
        wishlistId: destination === 'wishlist' ? selectedListId : undefined,
        uid: '',
        quantityForTrade: 0
    };
    
    onConfirm(finalCard, selectedListId);
    onClose();
  };

  const handleAnyVersionChange = (checked: boolean) => {
      setAnyVersion(checked);
      
      if (checked && versions.length > 0) {
          const sorted = [...versions].sort((a, b) => 
              (b.released_at || '').localeCompare(a.released_at || '')
          );
          const newest = sorted[0];
          if (newest) {
              setSelectedVersionId(newest.id);
              setIsFlipped(false);
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-4 flex justify-between items-center border-b border-border bg-surface">
            <h3 className="text-foreground font-bold truncate pr-4">{name}</h3>
            <button onClick={onClose} className="text-muted hover:text-foreground px-2 text-sm font-bold">Fermer</button>
        </div>

        {/* CONTENT */}
        <div className="overflow-y-auto p-6 flex flex-col items-center space-y-6 custom-scrollbar bg-background">
            
            {/* IMAGE - FORMAT NORMAL SANS CADRE VISIBLE */}
            <div 
              className="relative w-72 aspect-[2.5/3.5] group cursor-pointer bg-transparent" 
              onClick={() => imageBackUrl && setIsFlipped(!isFlipped)}
            >
                {loading ? (
                    <div className="w-full h-full bg-secondary animate-pulse flex items-center justify-center text-muted rounded-[4.5%]">Chargement...</div>
                ) : (
                    <div className="relative w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[4.5%] overflow-hidden">
                        <Image 
                          src={isFlipped && imageBackUrl ? imageBackUrl : imageUrl} 
                          alt={name} 
                          fill
                          sizes="300px"
                          priority
                          className={`object-cover transition-transform duration-300 ${anyVersion ? 'opacity-80 grayscale-50' : ''}`} 
                        />
                        
                        {/* EFFET FOIL PHYSIQUE */}
                        {isFoil && !anyVersion && (
                            <div className="absolute inset-0 bg-linear-to-tr from-purple-500/20 via-transparent to-white/10 mix-blend-overlay pointer-events-none" />
                        )}
                    </div>
                )}
                
                {anyVersion && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <span className="bg-primary text-primary-foreground font-bold px-3 py-1 rounded-full text-sm shadow-lg border border-white/20">Generique</span>
                    </div>
                )}
            </div>

            {/* WISHLIST SELECTOR */}
            {destination === 'wishlist' && availableLists && availableLists.length > 0 && (
                <div className="w-full space-y-1 bg-purple-500/10 p-3 rounded-xl border border-purple-500/30">
                    <label className="text-xs text-purple-600 dark:text-purple-300 font-bold uppercase tracking-wider">Ajouter a la liste :</label>
                    <select 
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="w-full bg-surface text-foreground border border-border rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        {availableLists.map(list => (
                            <option key={list.id} value={list.id}>{list.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* VERSION SELECTOR */}
            <div className={`w-full space-y-2 transition-opacity ${anyVersion ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <label className="text-xs text-muted uppercase font-bold tracking-wider">Edition / Set</label>
                <div className="relative">
                    <select 
                        className="w-full bg-surface text-foreground border border-border rounded-xl p-3 appearance-none focus:ring-2 focus:ring-primary outline-none text-sm"
                        value={selectedVersionId}
                        onChange={(e) => { setSelectedVersionId(e.target.value); setIsFlipped(false); }}
                    >
                        {versions.map((v) => (
                            <option key={v.id} value={v.id}>{v.set_name} ({v.set.toUpperCase()}) #{v.collector_number}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="w-full space-y-4">
                {destination === 'wishlist' && (
                    <label className="flex items-center justify-between bg-primary/10 p-3 rounded-xl border border-primary/20 cursor-pointer hover:bg-primary/20 transition">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-primary">Peu importe l&apos;edition</span>
                            <span className="text-[10px] text-muted">Selectionnera la version la plus recente</span>
                        </div>
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={anyVersion} 
                                onChange={(e) => handleAnyVersionChange(e.target.checked)} 
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </div>
                    </label>
                )}

                <div className="flex gap-4">
                    <div className={`flex-1 bg-surface rounded-xl p-2 flex flex-col items-center justify-center gap-1 border border-border transition-opacity ${anyVersion ? 'opacity-30 pointer-events-none' : ''}`}>
                        <span className="text-[10px] text-muted font-bold uppercase">Finition</span>
                        <div className="flex bg-secondary rounded-lg p-1 w-full">
                            <button 
                                onClick={() => setIsFoil(false)} 
                                disabled={!hasNonFoilVersion} 
                                className={`flex-1 text-[10px] py-1 rounded transition 
                                    ${!isFoil ? 'bg-surface text-foreground font-bold shadow-sm' : 'text-muted'} 
                                    ${!hasNonFoilVersion && 'opacity-30 cursor-not-allowed'}`}
                            >
                                {hasNonFoilVersion ? 'Normal' : 'N/A'}
                            </button>
                            <button 
                                onClick={() => setIsFoil(true)} 
                                disabled={!hasFoilVersion} 
                                className={`flex-1 text-[10px] py-1 rounded transition 
                                    ${isFoil ? 'bg-purple-600 text-white font-bold shadow-sm' : 'text-muted'} 
                                    ${!hasFoilVersion && 'opacity-30 cursor-not-allowed'}`}
                            >
                                {hasFoilVersion ? 'Foil' : 'N/A'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-surface rounded-xl p-2 flex flex-col items-center justify-center gap-1 border border-border">
                         <span className="text-[10px] text-muted font-bold uppercase">Quantite</span>
                         <div className="flex items-center gap-3">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-6 h-6 rounded-full bg-secondary text-foreground font-bold hover:bg-border transition">-</button>
                            <span className="text-lg font-bold text-foreground w-4 text-center">{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)} className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90 transition">+</button>
                         </div>
                    </div>
                </div>

                <div className="w-full text-center p-2 bg-secondary rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground">
                        Prix estime : 
                        <span className={`font-bold ml-2 ${currentPrice > 0 ? 'text-success' : 'text-muted'}`}>
                           {currentPrice > 0 ? `${currentPrice.toFixed(2)} EUR` : 'N/A'}
                        </span>
                    </p>
                </div>
            </div>
        </div>

        {/* CONFIRM BUTTON */}
        <div className="p-4 bg-surface border-t border-border">
            <button 
                onClick={handleConfirm}
                className={`w-full font-bold py-4 rounded-xl text-lg transition shadow-lg transform active:scale-95 flex justify-center items-center gap-2 ${anyVersion ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}
            >
                <span>{anyVersion ? 'Ajouter (Generique)' : 'Ajouter (Exact)'}</span>
                {quantity > 1 && <span className="bg-black/20 px-2 py-0.5 rounded text-sm">{quantity}x</span>}
            </button>
        </div>
      </div>
    </div>
  );
}