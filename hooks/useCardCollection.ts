// hooks/useCardCollection.ts
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, increment, writeBatch, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { updateUserStats } from '@/app/actions/stats';
import { checkAutoMatch, removeAutoMatchNotification } from '@/app/actions/matching';
import { refreshUserCollectionPrices } from '@/app/actions/collection';

interface FirestoreCardData extends DocumentData {
    name?: string;
    imageUrl?: string;
    imageBackUrl?: string;
    quantity?: number;
    price?: number;
    purchasePrice?: number;
    customPrice?: number;
    setName?: string;
    setCode?: string;
    isFoil?: boolean;
    isSpecificVersion?: boolean;
    quantityForTrade?: number;
    isForTrade?: boolean;
    lastPriceUpdate?: { toDate: () => Date } | Date;
    scryfallData?: Record<string, unknown>;
    cmc?: number;
    colors?: string[];
}

export type CardType = {
    uid?: string;
    id: string;
    name: string;
    imageUrl: string;
    imageBackUrl: string | null;
    quantity: number;
    price?: number;
    purchasePrice?: number;
    customPrice?: number;
    setName: string;
    setCode: string;
    wishlistId?: string | null;
    isFoil: boolean;
    isSpecificVersion: boolean;
    quantityForTrade: number;
    isForTrade?: boolean;
    cmc?: number;
    colors?: string[];
    lastPriceUpdate?: Date | null;
    scryfallData?: Record<string, unknown> | null;
};

export function useCardCollection(target: 'collection' | 'wishlist', listId: string = 'default', targetUid?: string) {
    const { user, loading: authLoading } = useAuth();
    const [cards, setCards] = useState<CardType[]>([]);
    const [loading, setLoading] = useState(true);

    const effectiveUid = targetUid || user?.uid;
    const isOwner = !!user && user.uid === effectiveUid;

    useEffect(() => {
        if (!effectiveUid || authLoading) {
            if (!authLoading && !effectiveUid) {
                setLoading(false);
                setCards([]);
            }
            return;
        }

        setLoading(true);
        let collectionPath = '';

        if (target === 'collection') {
            if (listId === 'default') collectionPath = `users/${effectiveUid}/collection`;
            else collectionPath = `users/${effectiveUid}/collections_data/${listId}/cards`;
        } else {
            if (listId === 'default') collectionPath = `users/${effectiveUid}/wishlist`;
            else collectionPath = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
        }

        const colRef = collection(db, collectionPath);

        const unsubscribe = onSnapshot(colRef, (snapshot) => {
            const items = snapshot.docs.map((doc) => {
                const data = doc.data() as FirestoreCardData;
                
                let lastUpdate: Date | null = null;
                if (data.lastPriceUpdate && typeof (data.lastPriceUpdate as { toDate: () => Date }).toDate === 'function') {
                    lastUpdate = (data.lastPriceUpdate as { toDate: () => Date }).toDate();
                } else if (data.lastPriceUpdate instanceof Date) {
                    lastUpdate = data.lastPriceUpdate;
                }

                // --- FALLBACK ROBUSTE ---
                let finalColors = Array.isArray(data.colors) ? data.colors : undefined;
                let finalCmc = typeof data.cmc === 'number' ? data.cmc : undefined;

                if (data.scryfallData) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const sd = data.scryfallData as any;
                    if (finalCmc === undefined && typeof sd.cmc === 'number') finalCmc = sd.cmc;
                    if (!finalColors) {
                        if (Array.isArray(sd.color_identity)) {
                            finalColors = sd.color_identity;
                        } else if (Array.isArray(sd.colors)) {
                            finalColors = sd.colors;
                        }
                    }
                }
                if (finalColors && finalColors.length === 0 && Array.isArray(data.colors) && data.colors.length > 0) {
                    finalColors = data.colors;
                }
                // -----------------------

                return {
                    id: doc.id,
                    uid: effectiveUid,
                    wishlistId: target === 'wishlist' ? (listId === 'default' ? null : listId) : null,
                    name: data.name || 'Carte Inconnue',
                    imageUrl: data.imageUrl || '',
                    imageBackUrl: data.imageBackUrl ?? null,
                    quantity: typeof data.quantity === 'number' ? data.quantity : 1,
                    price: typeof data.price === 'number' ? data.price : 0,
                    purchasePrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : undefined,
                    customPrice: typeof data.customPrice === 'number' ? data.customPrice : undefined,
                    setName: data.setName || '',
                    setCode: data.setCode || '',
                    isFoil: !!data.isFoil,
                    isSpecificVersion: !!data.isSpecificVersion,
                    quantityForTrade: typeof data.quantityForTrade === 'number' ? data.quantityForTrade : 0,
                    isForTrade: !!data.isForTrade,
                    cmc: finalCmc,
                    colors: finalColors,
                    lastPriceUpdate: lastUpdate,
                    scryfallData: data.scryfallData || null
                } as CardType;
            });

            const validItems = items.filter(card => card.quantity > 0);
            setCards(validItems);
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [effectiveUid, target, listId, authLoading]);

    // --- ACTIONS ---

    const triggerStatsUpdate = () => {
        if (user?.uid && isOwner && target === 'collection' && listId === 'default') {
            updateUserStats(user.uid).catch(console.error);
        }
    };

    const getDocRef = (cardId: string) => {
        if (!isOwner || !effectiveUid) return null;
        let path = '';
        if (target === 'collection') {
            if (listId === 'default') path = `users/${effectiveUid}/collection`;
            else path = `users/${effectiveUid}/collections_data/${listId}/cards`;
        } else if (listId === 'default') path = `users/${effectiveUid}/wishlist`;
        else path = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
        
        return doc(db, path, cardId);
    };

    const setPurchasePrice = async (cardId: string, price: number) => {
        if (!isOwner) return;
        const ref = getDocRef(cardId);
        if (ref) {
            await updateDoc(ref, { purchasePrice: price });
            toast.success("Prix d'acquisition enregistré");
        }
    };

    const setCustomPrice = async (cardId: string, price: number) => {
        if (!isOwner) return;
        const ref = getDocRef(cardId);
        if (ref) {
            await updateDoc(ref, { customPrice: price });
            triggerStatsUpdate();
        }
    };

    // Nouvelle fonction pour le debounce
    const setCardQuantity = async (cardId: string, newQuantity: number) => {
        if (!isOwner) return;
        const ref = getDocRef(cardId);
        if (!ref) return;
        
        // Sécurité : on ne gère pas la suppression ici (le bouton '-' gère le cas 0)
        if (newQuantity <= 0) return;

        try {
            await updateDoc(ref, { quantity: newQuantity });
            triggerStatsUpdate();
        } catch (error) {
            console.error("Erreur setCardQuantity", error);
            toast.error("Erreur de sauvegarde");
        }
    };

    const setTradeQuantity = async (cardId: string, quantity: number) => {
        if (!isOwner || !user || target !== 'collection') return;
        const card = cards.find(c => c.id === cardId);
        if (!card) return;

        const maxQty = card.quantity;
        const safeQty = Math.min(maxQty, Math.max(0, quantity));

        const ref = getDocRef(cardId);
        if (ref) {
            await updateDoc(ref, { quantityForTrade: safeQty, isForTrade: safeQty > 0 });
            
            if (safeQty > 0) {
                checkAutoMatch(user.uid, [{ id: card.id, name: card.name, isFoil: !!card.isFoil }])
                    .then(res => {
                        if (res.matches && res.matches > 0) {
                            toast(`Match trouvé !`, { icon: '🔔' });
                        }
                    });
            } else {
                removeAutoMatchNotification(user.uid, [card.id]);
            }
        }
    };

    const toggleAttribute = async (
        cardId: string, 
        field: 'isFoil' | 'isSpecificVersion', 
        currentValue: boolean
    ) => {
        if (!isOwner) return;
        const ref = getDocRef(cardId);
        if (ref) {
            await updateDoc(ref, { [field]: !currentValue });
            if (field === 'isFoil') triggerStatsUpdate();
        }
    };

    const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
        if (!isOwner) return;
        const ref = getDocRef(cardId);
        if (!ref) return;

        if (currentQuantity + amount <= 0) return 'shouldDelete';

        try {
            await updateDoc(ref, { quantity: increment(amount) });
            triggerStatsUpdate();
            return 'updated';
        } catch {
            return 'error';
        }
    };

    const removeCard = async (cardId: string) => {
        if (!isOwner) return;
        const ref = getDocRef(cardId);
        if(ref) {
            await deleteDoc(ref);
            toast.success('Carte retirée');
            triggerStatsUpdate();
            if (target === 'collection') {
                removeAutoMatchNotification(user?.uid || '', [cardId]);
            }
        }
    };

    // --- MISE À JOUR GLOBALE DES PRIX ---
    const refreshCollectionPricesAction = async () => {
        await refreshUserCollectionPrices(user?.uid || '');
        // Note: Cette fonction appelle désormais la Server Action, 
        // mais pour l'instant je garde votre logique existante si vous n'avez pas encore migré
        // Je réutilise votre code existant pour ne pas casser la logique
        await refreshCollectionPrices(); 
    };

    // Votre ancienne fonction (gardée pour compatibilité immédiate)
    const refreshCollectionPrices = async () => {
        if (!isOwner || cards.length === 0) return;
        const toastId = toast.loading(`Mise à jour de ${cards.length} cartes...`);

        try {
            const chunks = [];
            for (let i = 0; i < cards.length; i += 75) {
                chunks.push(cards.slice(i, i + 75));
            }

            for (const chunk of chunks) {
                const identifiers = chunk.map(c => ({ id: c.id }));
                const res = await fetch('https://api.scryfall.com/cards/collection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifiers })
                });

                if (!res.ok) continue;

                const data = await res.json();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const foundCards = (data.data as any[]) || [];
                const batch = writeBatch(db);
                let batchHasOps = false;

                foundCards.forEach(scryCard => {
                    const localCard = chunk.find(c => c.id === scryCard.id);
                    const newPrice = parseFloat(scryCard.prices?.eur || "0");

                    if (localCard) {
                        const ref = getDocRef(localCard.id);
                        if (ref) {
                            batch.update(ref, { 
                                price: newPrice,
                                scryfallData: scryCard as Record<string, unknown>
                            });
                            batchHasOps = true;
                        }
                    }
                });

                if (batchHasOps) await batch.commit();
                await new Promise(r => setTimeout(r, 100)); 
            }
            toast.success("Collection mise à jour avec succès !", { id: toastId });
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la mise à jour", { id: toastId });
        }
    };

    // --- GESTION DE MASSE DU CLASSEUR D'ÉCHANGE ---
    const bulkSetTradeStatus = async (
        action: 'excess' | 'all' | 'reset', 
        threshold: number = 4
    ) => {
        if (!isOwner || cards.length === 0) return;

        const batch = writeBatch(db);
        let opCount = 0;
        let label = "";

        cards.forEach(card => {
            let shouldUpdate = false;
            let newValue = false;

            if (action === 'reset') {
                if (card.isForTrade) {
                    shouldUpdate = true;
                    newValue = false;
                }
                label = "Remise à zéro";
            } else if (action === 'all') {
                if (!card.isForTrade) {
                    shouldUpdate = true;
                    newValue = true;
                }
                label = "Tout ajouter";
            } else if (action === 'excess') {
                if (card.quantity > threshold && !card.isForTrade) {
                    shouldUpdate = true;
                    newValue = true;
                }
            }

            if (shouldUpdate) {
                const ref = getDocRef(card.id);
                if (ref) {
                    batch.update(ref, { isForTrade: newValue });
                    opCount++;
                }
            }
        });

        if (opCount > 0) {
            await batch.commit();
            toast.success(`${opCount} cartes mises à jour (${action === 'excess' ? `Quantité > ${threshold}` : label})`);
        } else {
            toast(`Aucune carte ne correspond aux critères.`);
        }
    };

    // --- ACTIONS DE SÉLECTION MULTIPLE ---
    const bulkRemoveCards = async (cardIds: string[]) => {
        if (!isOwner || cardIds.length === 0) return;
        const batch = writeBatch(db);
        cardIds.forEach(id => {
            const ref = getDocRef(id);
            if (ref) batch.delete(ref);
        });
        await batch.commit();
        toast.success(`${cardIds.length} cartes supprimées`);
    };

    const bulkUpdateAttribute = async (cardIds: string[], field: 'isForTrade' | 'isFoil', value: boolean) => {
        if (!isOwner || cardIds.length === 0) return;
        const batch = writeBatch(db);
        cardIds.forEach(id => {
            const ref = getDocRef(id);
            if (ref) batch.update(ref, { [field]: value });
        });
        await batch.commit();
        toast.success("Mise à jour effectuée");
    };

    const totalPrice = useMemo(() => {
        return cards.reduce((acc, card) => {
            const effectivePrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);
            return acc + effectivePrice * card.quantity;
        }, 0);
    }, [cards]);

    return { 
        cards, loading, isOwner, totalPrice,
        updateQuantity, setCardQuantity, // Export de la nouvelle fonction
        removeCard, setCustomPrice, toggleAttribute,
        refreshCollectionPrices: refreshCollectionPricesAction, 
        bulkSetTradeStatus, bulkRemoveCards, bulkUpdateAttribute,
        setTradeQuantity,
        setPurchasePrice
    };
}