// components/card-page/DualQuantityManager.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';
import { useAuth } from '@/lib/AuthContext';
import { checkAutoMatch, removeAutoMatchNotification } from '@/app/actions/matching';
import { useDebouncedUpdate } from '@/hooks/useDebounceUpdate';
import toast from 'react-hot-toast';

type Props = {
    card: CardType;
    onUpdate?: () => void;
};

// Interface pour l'état local optimiste
type VariantState = {
    qty: number;
    trade: number;
    docId: string | null;
    exists: boolean;
};

// Interface minimale pour une erreur Firestore
interface FirestoreError {
    code?: string;
    message?: string;
}

// Interface pour typage sécurisé de 'finishes'
interface ScryfallWithFinishes {
    finishes?: string[];
}

export default function DualQuantityManager({ card, onUpdate }: Props) {
    const { user } = useAuth();
    
    // --- ÉTATS OPTIMISTES ---
    const [normalState, setNormalState] = useState<VariantState>({ qty: 0, trade: 0, docId: null, exists: false });
    const [foilState, setFoilState] = useState<VariantState>({ qty: 0, trade: 0, docId: null, exists: false });
    const [loading, setLoading] = useState(true);

    const cardDataRef = useRef(card);
    cardDataRef.current = card;

    const scryfallData = card.scryfallData as ScryfallRawData | undefined;
    const scryfallId = scryfallData?.id || card.id; 

    // --- VERIFICATION DES FINITIONS ---
    const detailedData = scryfallData as unknown as ScryfallWithFinishes | undefined;
    const finishes = detailedData?.finishes || [];
    
    // Si la liste est vide, on affiche tout par précaution
    const hasNonFoil = finishes.length === 0 || finishes.includes('nonfoil');
    const hasFoil = finishes.length === 0 || finishes.includes('foil') || finishes.includes('etched');

    // 1. CHARGEMENT INITIAL
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
                
                const newNormal: VariantState = { qty: 0, trade: 0, docId: null, exists: false };
                const newFoil: VariantState = { qty: 0, trade: 0, docId: null, exists: false };

                snap.forEach(d => {
                    const data = d.data() as CardType;
                    if (data.isFoil) {
                        newFoil.qty = data.quantity;
                        newFoil.trade = data.quantityForTrade || 0;
                        newFoil.docId = d.id;
                        newFoil.exists = true;
                    } else {
                        newNormal.qty = data.quantity;
                        newNormal.trade = data.quantityForTrade || 0;
                        newNormal.docId = d.id;
                        newNormal.exists = true;
                    }
                });

                setNormalState(newNormal);
                setFoilState(newFoil);

            } catch (e) {
                console.error("Erreur chargement variantes", e);
            } finally {
                setLoading(false);
            }
        };

        fetchVariants();
    }, [user, scryfallId]); 

    // 2. FONCTION D'ÉCRITURE EN BASE (Debounced)
    const performDatabaseUpdate = async (isFoil: boolean, finalQty: number, finalTrade: number, currentDocId: string | null) => {
        if (!user) return;

        try {
            // CAS A : SUPPRESSION
            if (finalQty <= 0) {
                if (currentDocId) {
                    await deleteDoc(doc(db, 'users', user.uid, 'collection', currentDocId));
                    removeAutoMatchNotification(user.uid, [currentDocId]);
                    if (onUpdate) onUpdate();
                }
                return;
            }

            // CAS B : MISE À JOUR
            if (currentDocId) {
                try {
                    await updateDoc(doc(db, 'users', user.uid, 'collection', currentDocId), {
                        quantity: finalQty,
                        quantityForTrade: finalTrade,
                        isForTrade: finalTrade > 0,
                        lastPriceUpdate: new Date().toISOString()
                    });
                } catch (err: unknown) {
                    const firestoreError = err as FirestoreError;
                    if (firestoreError.code === 'not-found') {
                        console.warn("Tentative de mise à jour sur un document supprimé (ignoré).");
                        return;
                    }
                    throw err; 
                }
                
                if (finalTrade > 0) {
                    checkAutoMatch(user.uid, [{ id: currentDocId, name: cardDataRef.current.name, isFoil }]);
                }
            } 
            // CAS C : CRÉATION
            else {
                const newId = `${scryfallId}_${isFoil ? 'foil' : 'normal'}`;
                const newDocRef = doc(db, 'users', user.uid, 'collection', newId);
                
                let initialPrice = cardDataRef.current.price || 0;
                const sData = cardDataRef.current.scryfallData as ScryfallRawData;
                if (sData && sData.prices) {
                    const pNormal = parseFloat(sData.prices.eur || "0");
                    const pFoil = parseFloat(sData.prices.eur_foil || "0");
                    if (isFoil) initialPrice = pFoil > 0 ? pFoil : (pNormal > 0 ? pNormal : initialPrice);
                    else initialPrice = pNormal > 0 ? pNormal : (pFoil > 0 ? pFoil : initialPrice);
                }

                const newCardData = {
                    ...cardDataRef.current,
                    id: newId,
                    price: initialPrice,
                    quantity: finalQty,
                    quantityForTrade: finalTrade,
                    isForTrade: finalTrade > 0,
                    isFoil: isFoil,
                    addedAt: serverTimestamp(),
                    scryfallData: sData ? { ...sData, id: scryfallId } : null,
                    wishlistId: null
                };

                // Nettoyage
                Object.keys(newCardData).forEach(key => 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (newCardData as any)[key] === undefined && delete (newCardData as any)[key]
                );

                await setDoc(newDocRef, newCardData);
                toast.success(`Version ${isFoil ? 'Foil' : 'Normal'} créée !`);
                
                if (isFoil) setFoilState(prev => ({ ...prev, docId: newId, exists: true }));
                else setNormalState(prev => ({ ...prev, docId: newId, exists: true }));
            }

            if (onUpdate) onUpdate();

        } catch (e) {
            console.error("Erreur sauvegarde DB", e);
        }
    };

    const debouncedUpdateNormal = useDebouncedUpdate(performDatabaseUpdate, 600);
    const debouncedUpdateFoil = useDebouncedUpdate(performDatabaseUpdate, 600);

    // 3. HANDLERS
    const handleUpdate = (isFoil: boolean, type: 'qty' | 'trade', delta: number) => {
        const currentState = isFoil ? foilState : normalState;
        const setState = isFoil ? setFoilState : setNormalState;
        const debouncer = isFoil ? debouncedUpdateFoil : debouncedUpdateNormal;

        let newQty = currentState.qty;
        let newTrade = currentState.trade;

        if (type === 'qty') {
            newQty += delta;
            if (newQty < 0) return;

            if (newQty === 0 && currentState.exists) {
                if (confirm(`Retirer la version ${isFoil ? 'Foil' : 'Normal'} ?`)) {
                    setState({ ...currentState, qty: 0, trade: 0, exists: false });
                    performDatabaseUpdate(isFoil, 0, 0, currentState.docId);
                }
                return;
            }
            
            if (newTrade > newQty) newTrade = newQty;
        } 
        else if (type === 'trade') {
            newTrade += delta;
            if (newTrade < 0 || newTrade > newQty) return;
        }

        setState({ ...currentState, qty: newQty, trade: newTrade });

        if (newQty > 0) {
            debouncer(isFoil, newQty, newTrade, currentState.docId);
        }
    };

    if (loading) return <div className="p-4 text-center text-muted text-xs">Chargement...</div>;

    // --- RENDU UI ---
    const renderVariantBlock = (title: string, isFoil: boolean, state: VariantState) => {
        const isOwned = state.qty > 0;
        
        const containerClass = `rounded-xl border overflow-hidden flex flex-col h-full transition-all duration-200 
            ${isOwned 
                ? (isFoil ? 'bg-surface border-primary/30 ring-1 ring-primary/20' : 'bg-surface border-border shadow-sm') 
                : 'bg-secondary/30 border-border opacity-70 hover:opacity-100'}`;

        const headerClass = `px-4 py-3 border-b flex justify-between items-center 
            ${isOwned ? 'bg-secondary/20' : 'bg-transparent'} border-border`;

        return (
            <div className={containerClass}>
                
                <div className={headerClass}>
                    <span className={`font-bold text-sm flex items-center gap-2 ${isFoil ? 'text-primary' : 'text-foreground'}`}>
                        {isFoil && <span>✨</span>}
                        {title}
                    </span>
                    {isOwned ? (
                        <span className="text-[10px] font-bold text-muted bg-background px-2 py-0.5 rounded border border-border">
                            {state.exists ? 'En stock' : 'Ajout...'}
                        </span>
                    ) : (
                        <span className="text-[10px] uppercase font-bold text-muted bg-background px-2 py-0.5 rounded border border-border">Absent</span>
                    )}
                </div>

                <div className="p-4 space-y-4 grow flex flex-col justify-center">
                    
                    {/* Collection */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted uppercase tracking-wide">Collection</span>
                        <div className="flex items-center bg-background rounded-lg border border-border shadow-sm h-9">
                            <button 
                                onClick={() => handleUpdate(isFoil, 'qty', -1)} 
                                className="w-9 h-full flex items-center justify-center hover:bg-secondary text-muted hover:text-danger font-bold transition rounded-l-lg border-r border-border"
                            >
                                -
                            </button>
                            <span className="font-bold text-lg w-10 text-center tabular-nums text-foreground">{state.qty}</span>
                            <button 
                                onClick={() => handleUpdate(isFoil, 'qty', 1)} 
                                className="w-9 h-full flex items-center justify-center hover:bg-primary/10 text-primary font-bold transition rounded-r-lg border-l border-border"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {isOwned && <div className="h-px bg-border w-full"></div>}

                    {/* Echange */}
                    <div className={`flex items-center justify-between transition-opacity duration-200 ${!isOwned ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-success uppercase tracking-wide">À l&apos;échange</span>
                            <span className="text-[10px] text-muted">Disponible</span>
                        </div>
                        
                        <div className="flex items-center bg-success/5 border border-success/20 rounded-lg shadow-sm h-9">
                            <button 
                                onClick={() => handleUpdate(isFoil, 'trade', -1)} 
                                disabled={state.trade <= 0}
                                className="w-9 h-full flex items-center justify-center hover:bg-success/20 text-success font-bold transition rounded-l-lg disabled:opacity-30 border-r border-success/20"
                            >
                                -
                            </button>
                            <span className={`font-bold text-lg w-10 text-center tabular-nums ${state.trade > 0 ? 'text-success' : 'text-muted'}`}>{state.trade}</span>
                            <button 
                                onClick={() => handleUpdate(isFoil, 'trade', 1)} 
                                disabled={state.trade >= state.qty}
                                className="w-9 h-full flex items-center justify-center hover:bg-success/20 text-success font-bold transition rounded-r-lg disabled:opacity-30 border-l border-success/20"
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
                {/* Condition d'affichage basée sur l'existence des finitions */}
                {hasNonFoil && renderVariantBlock("Version Normale", false, normalState)}
                {hasFoil && renderVariantBlock("Version Foil", true, foilState)}
            </div>
            
            <p className="text-[11px] text-muted text-center pt-2 italic">
                Ajustez les quantités pour que vos amis puissent vous proposer des deals automatiquement.
            </p>
        </div>
    );
}