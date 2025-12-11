// hooks/useCardCollection.ts
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

export type CardType = {
  id: string;
  name: string;
  imageUrl: string;
  imageBackUrl?: string;
  quantity: number;
  price?: number; 
  customPrice?: number;
  setName?: string;
  setCode?: string;
  wishlistId?: string;
  
  // --- OPTIONS ---
  isFoil?: boolean;             
  isSpecificVersion?: boolean;
  isForTrade?: boolean; 
  
  // --- DONNÉES BRUTES SCRYFALL ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scryfallData?: any;
};

export function useCardCollection(
    target: 'collection' | 'wishlist', 
    listId: string = 'default',
    targetUid?: string
) {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveUid = targetUid || user?.uid;
  const isOwner = user?.uid === effectiveUid; 

  useEffect(() => {
    if (!effectiveUid || authLoading) {
        if (!authLoading && !effectiveUid) setLoading(false);
        return;
    }
    setLoading(true);

    let collectionPath = '';
    if (target === 'collection') {
        collectionPath = `users/${effectiveUid}/collection`;
    } else {
        if (listId === 'default') collectionPath = `users/${effectiveUid}/wishlist`;
        else collectionPath = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
    }

    const colRef = collection(db, collectionPath);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        wishlistId: listId,
        ...doc.data(),
      })) as CardType[];
      setCards(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [effectiveUid, target, listId, authLoading]);

  // --- ACTIONS ---

  const getDocRef = (cardId: string) => {
      if (!isOwner || !effectiveUid) return null;
      let path = '';
      if (target === 'collection') path = `users/${effectiveUid}/collection`;
      else if (listId === 'default') path = `users/${effectiveUid}/wishlist`;
      else path = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
      return doc(db, path, cardId);
  };

  const setCustomPrice = async (cardId: string, price: number) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { customPrice: price });
          toast.success("Prix mis à jour");
      }
  };

  const toggleAttribute = async (
      cardId: string, 
      field: 'isFoil' | 'isSpecificVersion' | 'isForTrade', 
      currentValue: boolean
  ) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { [field]: !currentValue });
      }
  };

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!isOwner) return;
    const ref = getDocRef(cardId);
    if (!ref) return;
    if (currentQuantity + amount <= 0) return 'shouldDelete';
    try {
      await updateDoc(ref, { quantity: increment(amount) });
      return 'updated';
    } catch (err) { return 'error'; }
  };

  const removeCard = async (cardId: string) => {
    if (!isOwner) return;
    const ref = getDocRef(cardId);
    if(ref) { await deleteDoc(ref); toast.success('Carte retirée', { icon: '🗑️' }); }
  };

  // --- NOUVEAU : MISE À JOUR GLOBALE DES PRIX ---
  const refreshCollectionPrices = async () => {
      if (!isOwner || cards.length === 0) return;
      const toastId = toast.loading(`Mise à jour de ${cards.length} cartes...`);

      try {
          // 1. Découpage par lots de 75 (Limite API)
          const chunks = [];
          for (let i = 0; i < cards.length; i += 75) {
              chunks.push(cards.slice(i, i + 75));
          }

          let updatedCount = 0;

          for (const chunk of chunks) {
              // On utilise l'ID Scryfall (stocké dans .id pour les cartes Scryfall)
              const identifiers = chunk.map(c => ({ id: c.id }));

              const res = await fetch('https://api.scryfall.com/cards/collection', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ identifiers })
              });

              if (!res.ok) continue;

              const data = await res.json();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const foundCards: any[] = data.data || [];
              
              const batch = writeBatch(db);
              let batchHasOps = false;

              foundCards.forEach(scryCard => {
                  const localCard = chunk.find(c => c.id === scryCard.id);
                  const newPrice = parseFloat(scryCard.prices?.eur || "0");

                  // On force la mise à jour pour rafraîchir scryfallData et le prix
                  if (localCard) {
                      const ref = getDocRef(localCard.id);
                      if (ref) {
                          batch.update(ref, { 
                              price: newPrice,
                              scryfallData: scryCard // Sauvegarde des nouvelles données brutes
                          });
                          batchHasOps = true;
                          updatedCount++;
                      }
                  }
              });

              if (batchHasOps) await batch.commit();
              
              // Petit délai pour l'API
              await new Promise(r => setTimeout(r, 100));
          }

          toast.success("Collection mise à jour avec succès !", { id: toastId });

      } catch (e) {
          console.error(e);
          toast.error("Erreur lors de la mise à jour", { id: toastId });
      }
  };

  const totalPrice = useMemo(() => {
    return cards.reduce((acc, card) => {
        const effectivePrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);
        return acc + effectivePrice * card.quantity;
    }, 0);
  }, [cards]);

  return { 
      cards, loading, isOwner, totalPrice,
      updateQuantity, removeCard, setCustomPrice, toggleAttribute,
      refreshCollectionPrices // <--- Export de la fonction
  };
}