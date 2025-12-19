// components/card-page/CardVersionsGrid.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils';
import { CardType } from '@/hooks/useCardCollection';
import toast from 'react-hot-toast';
import Image from 'next/image';

type Props = {
    oracleId: string;
    currentCardId: string;
    onVersionSelect: (rawCard: ScryfallRawData) => void;
    collectionMap: Map<string, CardType>;
};

export default function CardVersionsGrid({ oracleId, currentCardId, onVersionSelect, collectionMap }: Props) {
    const [allVersions, setAllVersions] = useState<ScryfallRawData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRawCard, setSelectedRawCard] = useState<ScryfallRawData | null>(null);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showOwnedOnly, setShowOwnedOnly] = useState(false);

    useEffect(() => {
        const fetchAllVersions = async () => {
            setLoading(true);
            try {
                const res = await fetch(`https://api.scryfall.com/cards/search?q=oracle_id:${oracleId}&unique=prints&order=released`);
                const data = await res.json();
                
                if (data.data && data.data.length > 0) {
                    setAllVersions(data.data);
                    const current = data.data.find((v: ScryfallRawData) => v.id === currentCardId);
                    if (current) setSelectedRawCard(current);
                    else setSelectedRawCard(data.data[0]); 
                } else {
                    toast.error("Aucune version trouvée sur Scryfall.");
                }
            } catch (e) {
                console.error("Erreur chargement versions Scryfall", e);
            } finally {
                setLoading(false);
            }
        };

        if (oracleId) {
            fetchAllVersions();
        }
    }, [oracleId, currentCardId]);

    const cardToDisplay = useMemo(() => {
        if (selectedRawCard) return normalizeCardData(selectedRawCard);
        if (allVersions.length > 0) return normalizeCardData(allVersions[0]);
        return null;
    }, [selectedRawCard, allVersions]);
    
    const filteredVersions = useMemo(() => {
        if (!showOwnedOnly) return allVersions;
        return allVersions.filter(v => collectionMap.has(v.id));
    }, [allVersions, showOwnedOnly, collectionMap]);

    if (loading) {
        return <div className="p-10 text-center text-muted animate-pulse">Chargement des éditions...</div>;
    }
    if (allVersions.length === 0 || !cardToDisplay) {
        return <p className="p-10 text-center text-danger">Liste des éditions non disponible.</p>;
    }
    
    const isDoubleSided = !!cardToDisplay.imageBackUrl;
    const displayImage = isFlipped && cardToDisplay.imageBackUrl ? cardToDisplay.imageBackUrl : cardToDisplay.imageUrl;

    return (
        <div className="flex flex-col md:grid md:grid-cols-3 gap-6 md:gap-8">
            {/* GAUCHE : IMAGE - Centrée sur mobile, sticky sur desktop */}
            <div className="md:col-span-1 flex flex-col items-center md:sticky md:top-24 self-start w-full">
                 <div 
                    className="w-full max-w-[280px] md:max-w-sm aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-2xl ring-4 ring-primary/20 cursor-pointer relative transition-transform active:scale-95"
                    onClick={() => isDoubleSided && setIsFlipped(!isFlipped)}
                >
                    <Image 
                        src={displayImage} 
                        alt={cardToDisplay.name} 
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 280px, 400px"
                        priority
                    />
                </div>
                {isDoubleSided && (
                    <button 
                        onClick={() => setIsFlipped(!isFlipped)} 
                        className="mt-4 text-sm text-primary hover:underline font-bold bg-primary/10 px-4 py-2 rounded-full"
                    >
                        {isFlipped ? 'Voir le Recto' : 'Voir le Verso'}
                    </button>
                )}
            </div>

            {/* DROITE : LISTE DES IMPRESSIONS */}
            <div className="md:col-span-2 space-y-4">
                <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-xl border border-border">
                    <h2 className="text-lg md:text-xl font-bold text-foreground">
                        Impressions ({filteredVersions.length})
                    </h2>
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-surface px-3 py-1.5 rounded-lg border border-border hover:border-primary transition">
                        <input 
                            type="checkbox" 
                            checked={showOwnedOnly} 
                            onChange={(e) => setShowOwnedOnly(e.target.checked)} 
                            className="w-4 h-4 text-primary rounded border-border focus:ring-primary accent-primary" 
                        />
                        <span className="text-xs md:text-sm font-medium text-foreground">Mes versions</span>
                    </label>
                </div>
                
                <div className="space-y-2 max-h-[50vh] md:max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredVersions.map(v => {
                        const normalized = normalizeCardData(v);
                        const isCurrentInCollection = v.id === currentCardId; 
                        const ownedCard = collectionMap.get(v.id);
                        const isOwned = !!ownedCard;
                        const ownedQty = ownedCard?.quantity || 0;

                        const priceNormal = parseFloat(v.prices?.eur || "0");
                        const priceFoil = parseFloat(v.prices?.eur_foil || "0");
                        const displayPrice = priceNormal > 0 ? priceNormal : priceFoil;
                        
                        return (
                            <div 
                                key={v.id} 
                                onClick={() => { setSelectedRawCard(v); setIsFlipped(false); }} 
                                onDoubleClick={() => onVersionSelect(v)} 
                                className={`flex items-center gap-3 p-2 md:p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
                                    v.id === selectedRawCard?.id
                                        ? 'bg-primary/10 border-primary shadow-md ring-2 ring-primary/30' 
                                        : isOwned 
                                            ? 'bg-success/5 border-success/30 hover:bg-success/10' 
                                            : 'bg-surface border-border hover:border-primary/50' 
                                }`}
                            >
                                <div className="w-10 h-14 md:w-12 md:h-16 rounded overflow-hidden shrink-0 relative border border-border/50">
                                    <Image 
                                        src={normalized.imageUrl} 
                                        alt={normalized.setName} 
                                        fill
                                        className="object-cover"
                                        sizes="48px"
                                    />
                                </div>
                                <div className="grow min-w-0">
                                    <p className="font-bold text-foreground text-xs md:text-sm truncate flex items-center gap-2">
                                        {v.set_name} 
                                        {isOwned && <span className="text-[10px] bg-success text-white px-1.5 py-0.5 rounded-full font-black">{ownedQty}x</span>} 
                                    </p>
                                    <p className="text-[10px] text-muted truncate uppercase font-mono">
                                        {v.set} • #{v.collector_number}
                                    </p>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                    <span className={`font-bold text-xs md:text-sm ${isCurrentInCollection ? 'text-primary' : 'text-foreground'}`}>
                                        {displayPrice > 0 ? `${displayPrice.toFixed(2)} €` : '-- €'}
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onVersionSelect(v); }} 
                                        className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded font-bold hover:opacity-80"
                                    >
                                        VOIR
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="pt-2">
                    <button 
                        onClick={() => selectedRawCard && onVersionSelect(selectedRawCard)}
                        disabled={!selectedRawCard}
                        className="btn-primary w-full py-3 text-sm md:text-base font-bold shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
                    >
                        Afficher les Détails de cette Impression
                    </button>
                </div>
            </div>
        </div>
    );
}