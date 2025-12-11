// hooks/useCardCollection.ts
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

// Definition d'un type partiel pour Scryfall
type ScryfallDataRaw = {
    id: string;
    prices?: { eur?: string; usd?: string };
    [key: string]: unknown; 
};

export type CardType = {
  id: string;
  name: string;
  imageUrl: string;
  imageBackUrl?: string | null;
  quantity: number;
  price?: number; 
  customPrice?: number;
  setName?: string;
  setCode?: string;
  wishlistId?: string;
  
  isFoil?: boolean;             
  isSpecificVersion?: boolean;
  isForTrade?: boolean; 
  
  scryfallData?: Record<string, unknown>;
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

  // --- MISE À JOUR GLOBALE DES PRIX ---
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
              const foundCards = (data.data as ScryfallDataRaw[]) || [];
              
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
          } 
          else if (action === 'all') {
              if (!card.isForTrade) {
                  shouldUpdate = true;
                  newValue = true;
              }
              label = "Tout ajouter";
          } 
          else if (action === 'excess') {
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

  // --- NOUVEAU : ACTIONS DE SÉLECTION MULTIPLE ---

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
      updateQuantity, removeCard, setCustomPrice, toggleAttribute,
      refreshCollectionPrices, bulkSetTradeStatus,
      bulkRemoveCards, bulkUpdateAttribute 
  };
}