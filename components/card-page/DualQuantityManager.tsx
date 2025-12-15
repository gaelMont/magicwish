// components/card-page/DualQuantityManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';
import { useAuth } from '@/lib/AuthContext';
import { checkAutoMatch, removeAutoMatchNotification } from '@/app/actions/matching';
import toast from 'react-hot-toast';

type Props = {
    card: CardType;
    onUpdate?: () => void;
};

export default function DualQuantityManager({ card, onUpdate }: Props) {
    const { user } = useAuth();
    
    const [foilDoc, setFoilDoc] = useState<CardType | null>(null);
    const [normalDoc, setNormalDoc] = useState<CardType | null>(null);
    const [loading, setLoading] = useState(true);

    const scryfallData = card.scryfallData as ScryfallRawData | undefined;
    const scryfallId = scryfallData?.id || card.id; 

    // 1. Charger les variantes
    useEffect(() => {
        const fetchVariants = async () => {
            if (!user || !scryfallId) return;
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'users', user.uid, 'collection'),
                    where('scryfallData.id', '==', scryfallId)
                );
                
                const snap = await getDocs(q);
                
                let foundNormal: CardType | null = null;
                let foundFoil: CardType | null = null;

                snap.forEach(d => {
                    const data = d.data() as CardType;
                    const item = { ...data, id: d.id };
                    if (item.isFoil) foundFoil = item;
                    else foundNormal = item;
                });

                setNormalDoc(foundNormal);
                setFoilDoc(foundFoil);

            } catch (e) {
                console.error("Erreur chargement variantes", e);
            } finally {
                setLoading(false);
            }
        };

        fetchVariants();
    }, [user, scryfallId, card]); 

    // 2. Mise à jour Quantité Totale
    const updateVariantQuantity = async (isTargetFoil: boolean, delta: number) => {
        if (!user) return;

        const targetDoc = isTargetFoil ? foilDoc : normalDoc;
        const currentQty = targetDoc?.quantity || 0;
        const newQty = currentQty + delta;

        if (newQty < 0) return;

        try {
            // Suppression
            if (newQty === 0 && targetDoc) {
                if (confirm(`Retirer la version ${isTargetFoil ? 'Foil' : 'Normal'} de la collection ?`)) {
                    await deleteDoc(doc(db, 'users', user.uid, 'collection', targetDoc.id));
                    removeAutoMatchNotification(user.uid, [targetDoc.id]);
                    
                    if (isTargetFoil) setFoilDoc(null);
                    else setNormalDoc(null);
                    toast.success("Version retirée");
                }
                return;
            }

            // Mise à jour
            if (targetDoc) {
                const currentTrade = targetDoc.quantityForTrade || 0;
                const newTrade = Math.min(currentTrade, newQty);
                
                await updateDoc(doc(db, 'users', user.uid, 'collection', targetDoc.id), {
                    quantity: increment(delta),
                    quantityForTrade: newTrade,
                    isForTrade: newTrade > 0
                });
                
                const updated = { ...targetDoc, quantity: newQty, quantityForTrade: newTrade, isForTrade: newTrade > 0 };
                if (isTargetFoil) setFoilDoc(updated);
                else setNormalDoc(updated);
            
            // Création
            } else if (newQty > 0) {
                const newId = `${scryfallId}_${isTargetFoil ? 'foil' : 'normal'}`;
                const newDocRef = doc(db, 'users', user.uid, 'collection', newId);
                
                let initialPrice = card.price || 0;
                if (scryfallData && scryfallData.prices) {
                    const priceNormal = parseFloat(scryfallData.prices.eur || "0");
                    const priceFoil = parseFloat(scryfallData.prices.eur_foil || "0");

                    if (isTargetFoil) {
                        initialPrice = priceFoil > 0 ? priceFoil : (priceNormal > 0 ? priceNormal : initialPrice);
                    } else {
                        initialPrice = priceNormal > 0 ? priceNormal : (priceFoil > 0 ? priceFoil : initialPrice);
                    }
                }

                const newCardData = {
                    name: card.name,
                    imageUrl: card.imageUrl,
                    imageBackUrl: card.imageBackUrl || null,
                    setName: card.setName,
                    setCode: card.setCode,
                    
                    price: initialPrice, 
                    
                    purchasePrice: card.purchasePrice ?? null, 
                    customPrice: card.customPrice ?? null,
                    id: newId,
                    quantity: newQty,
                    quantityForTrade: 0,
                    isForTrade: false,
                    isFoil: isTargetFoil,
                    isSpecificVersion: card.isSpecificVersion || false,
                    addedAt: serverTimestamp(),
                    scryfallData: scryfallData ? { ...scryfallData, id: scryfallId } : null,
                    wishlistId: null
                };

                await setDoc(newDocRef, newCardData);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const optimisticData = newCardData as any;

                if (isTargetFoil) setFoilDoc(optimisticData);
                else setNormalDoc(optimisticData);
                
                toast.success(`Version ${isTargetFoil ? 'Foil' : 'Normal'} ajoutée !`);
            }

            if (onUpdate) onUpdate();

        } catch (e) {
            console.error("Erreur update quantité", e);
            toast.error("Erreur sauvegarde");
        }
    };

    // 3. Mise à jour Quantité Trade
    const updateTradeQuantity = async (isTargetFoil: boolean, delta: number) => {
        if (!user) return;
        const targetDoc = isTargetFoil ? foilDoc : normalDoc;
        if (!targetDoc) return;

        const maxQty = targetDoc.quantity;
        const currentTrade = targetDoc.quantityForTrade || 0;
        const newTrade = Math.min(maxQty, Math.max(0, currentTrade + delta));

        if (newTrade === currentTrade) return;

        try {
            await updateDoc(doc(db, 'users', user.uid, 'collection', targetDoc.id), {
                quantityForTrade: newTrade,
                isForTrade: newTrade > 0
            });

            const updated = { ...targetDoc, quantityForTrade: newTrade, isForTrade: newTrade > 0 };
            if (isTargetFoil) setFoilDoc(updated);
            else setNormalDoc(updated);

            if (newTrade > 0 && newTrade > currentTrade) {
                checkAutoMatch(user.uid, [{ id: targetDoc.id, name: targetDoc.name, isFoil: isTargetFoil }]);
            } else if (newTrade === 0 && currentTrade > 0) {
                removeAutoMatchNotification(user.uid, [targetDoc.id]);
            }

        } catch (e) {
            console.error("Erreur update trade", e);
            toast.error("Erreur sauvegarde trade");
        }
    };

    if (loading) return <div className="p-4 text-center text-muted text-xs">Chargement des variantes...</div>;

    const normalQty = normalDoc?.quantity || 0;
    // CORRECTION CRITIQUE : Clamp visuel pour que Trade ne dépasse jamais la Quantité
    const normalTrade = Math.min(normalDoc?.quantityForTrade || 0, normalQty);
    
    const foilQty = foilDoc?.quantity || 0;
    // CORRECTION CRITIQUE : Clamp visuel pour le Foil aussi
    const foilTrade = Math.min(foilDoc?.quantityForTrade || 0, foilQty);

    const renderVariantBlock = (title: string, isFoil: boolean, total: number, trade: number) => {
        const isOwned = total > 0;
        const currentDoc = isFoil ? foilDoc : normalDoc;
        const displayPrice = currentDoc?.price || 0;
        
        return (
            <div className={`rounded-xl border overflow-hidden flex flex-col h-full transition-all duration-200 ${isOwned ? (isFoil ? 'bg-amber-50 border-amber-200' : 'bg-white border-border shadow-sm') : 'bg-secondary/20 border-border opacity-70 hover:opacity-100'}`}>
                
                <div className={`px-4 py-3 border-b flex justify-between items-center ${isFoil ? 'bg-amber-100/50 border-amber-200' : 'bg-secondary/30 border-border'}`}>
                    <span className={`font-bold text-sm flex items-center gap-2 ${isFoil ? 'text-amber-700' : 'text-foreground'}`}>
                        {isFoil && <span>✨</span>}
                        {title}
                    </span>
                    {isOwned ? (
                        <span className="text-[10px] font-bold text-muted bg-background/50 px-2 py-0.5 rounded border border-border/50">
                            {displayPrice > 0 ? `${displayPrice.toFixed(2)} €` : 'N/A'}
                        </span>
                    ) : (
                        <span className="text-[10px] uppercase font-bold text-muted bg-background/50 px-2 py-0.5 rounded">Absent</span>
                    )}
                </div>

                <div className="p-4 space-y-4 grow flex flex-col justify-center">
                    
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted uppercase tracking-wide">Collection</span>
                        <div className="flex items-center bg-background rounded-lg border border-border shadow-sm h-9">
                            <button 
                                onClick={() => updateVariantQuantity(isFoil, -1)} 
                                className="w-9 h-full flex items-center justify-center hover:bg-secondary text-muted hover:text-danger font-bold transition rounded-l-lg"
                            >
                                -
                            </button>
                            <span className="font-bold text-lg w-8 text-center tabular-nums text-foreground">{total}</span>
                            <button 
                                onClick={() => updateVariantQuantity(isFoil, 1)} 
                                className="w-9 h-full flex items-center justify-center hover:bg-primary text-primary font-bold transition rounded-r-lg"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {isOwned && <div className="h-px bg-border/50 w-full"></div>}

                    <div className={`flex items-center justify-between transition-opacity duration-200 ${!isOwned ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-green-700 uppercase tracking-wide">À l&apos;échange</span>
                            <span className="text-[10px] text-green-600/70">Disponible pour les amis</span>
                        </div>
                        
                        <div className="flex items-center bg-green-50 border border-green-200 rounded-lg shadow-sm h-9">
                            <button 
                                onClick={() => updateTradeQuantity(isFoil, -1)} 
                                disabled={trade <= 0}
                                className="w-9 h-full flex items-center justify-center hover:bg-green-100 text-green-700 font-bold transition rounded-l-lg disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                                -
                            </button>
                            <span className={`font-bold text-lg w-8 text-center tabular-nums ${trade > 0 ? 'text-green-700' : 'text-green-700/50'}`}>{trade}</span>
                            <button 
                                onClick={() => updateTradeQuantity(isFoil, 1)} 
                                disabled={trade >= total}
                                className="w-9 h-full flex items-center justify-center hover:bg-green-100 text-green-700 font-bold transition rounded-r-lg disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                                +
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2 px-1">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Gestion du Stock
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderVariantBlock("Version Normale", false, normalQty, normalTrade)}
                {renderVariantBlock("Version Foil", true, foilQty, foilTrade)}
            </div>
            
            <p className="text-[11px] text-muted text-center pt-2 italic">
                Ajustez les quantités &quot;À l&apos;échange&quot; pour que vos amis puissent vous proposer des deals automatiquement.
            </p>
        </div>
    );
}