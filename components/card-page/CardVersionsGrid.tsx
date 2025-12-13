// components/card-page/CardVersionsGrid.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils';
import { CardType } from '@/hooks/useCardCollection';
import toast from 'react-hot-toast';

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
        <div className="grid md:grid-cols-3 gap-8">
            {/* GAUCHE : IMAGE */}
            <div className="md:col-span-1 flex flex-col items-center sticky top-24 self-start">
                 <div 
                    className="w-full max-w-sm aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-2xl ring-4 ring-primary/20 cursor-pointer"
                    onClick={() => isDoubleSided && setIsFlipped(!isFlipped)}
                >
                    <img src={displayImage} alt={cardToDisplay.name} className="w-full h-full object-cover" />
                </div>
                {isDoubleSided && (
                    <button 
                        onClick={() => setIsFlipped(!isFlipped)} 
                        className="mt-4 text-sm text-primary hover:underline font-medium"
                    >
                        {isFlipped ? 'Afficher le Recto' : 'Afficher le Verso'}
                    </button>
                )}
            </div>

            {/* DROITE : LISTE */}
            <div className="md:col-span-2 space-y-6">
                <div className="flex justify-between items-center bg-secondary p-3 rounded-xl border border-border">
                    <h2 className="text-xl font-bold text-foreground">
                        Impressions ({filteredVersions.length} / {allVersions.length})
                    </h2>
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-background px-3 py-1.5 rounded-lg border border-border hover:border-primary transition">
                        <input 
                            type="checkbox" 
                            checked={showOwnedOnly} 
                            onChange={(e) => setShowOwnedOnly(e.target.checked)} 
                            className="w-4 h-4 text-primary rounded border-border focus:ring-primary" 
                        />
                        <span className="text-sm font-medium text-foreground">Mes versions</span>
                    </label>
                </div>
                
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-3 custom-scrollbar">
                    {filteredVersions.map(v => {
                        const normalized = normalizeCardData(v);
                        const isCurrentInCollection = v.id === currentCardId; 
                        const ownedCard = collectionMap.get(v.id);
                        const isOwned = !!ownedCard;
                        const ownedQty = ownedCard?.quantity || 0;

                        const priceNormal = parseFloat(v.prices?.eur || "0");
                        const priceFoil = parseFloat(v.prices?.eur_foil || "0");
                        const displayPrice = Math.max(priceNormal, priceFoil);
                        
                        return (
                            <div 
                                key={v.id} 
                                onClick={() => { setSelectedRawCard(v); setIsFlipped(false); }} 
                                onDoubleClick={() => onVersionSelect(v)} 
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    v.id === selectedRawCard?.id
                                        ? 'bg-primary/10 border-primary shadow-lg ring-2 ring-primary/50' 
                                        : isOwned 
                                            ? 'bg-success/5 border-success/30 hover:bg-success/10' 
                                            : 'bg-surface border-border hover:bg-primary/5' 
                                }`}
                            >
                                <div className="w-12 h-16 rounded overflow-hidden shrink-0">
                                    <img src={normalized.imageUrl} alt={normalized.setName} className="w-full h-full object-cover" loading="lazy" />
                                </div>
                                <div className="grow min-w-0">
                                    <p className="font-bold text-foreground truncate flex items-center gap-2">
                                        {v.set_name} 
                                        {isOwned && <span className="text-xs bg-success text-white px-1.5 py-0.5 rounded font-bold">{ownedQty}x</span>} 
                                        {isCurrentInCollection && <span className="text-xs text-primary font-normal">(Affichée)</span>}
                                    </p>
                                    <p className="text-xs text-muted">Set: {v.set.toUpperCase()} | Num: {v.collector_number}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`font-bold text-sm ${isCurrentInCollection ? 'text-primary' : 'text-success'}`}>{displayPrice.toFixed(2)} €</span>
                                    {v.finishes?.includes('foil') && <p className="text-xs text-amber-600">Foil</p>}
                                    <button onClick={(e) => { e.stopPropagation(); onVersionSelect(v); }} className="text-xs text-primary hover:underline block mt-1 w-full text-right">
                                        Sélectionner
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="pt-4 border-t border-border">
                    <button 
                        onClick={() => selectedRawCard && onVersionSelect(selectedRawCard)}
                        disabled={!selectedRawCard}
                        className="btn-primary w-full py-3 text-lg disabled:opacity-50"
                    >
                        Afficher les Détails de cette Impression
                    </button>
                </div>
            </div>
        </div>
    );
}