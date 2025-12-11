// hooks/useCardCollection.ts
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
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
  
  // --- NOUVEAUX CHAMPS ---
  isFoil?: boolean;             // L'utilisateur veut-il (ou a-t-il) une version Foil ?
  isSpecificVersion?: boolean;  // Si true : Je veux CETTE édition précise. Si false : N'importe laquelle.
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

  // NOUVEAU : Fonction pour changer Foil / Version stricte
  const toggleAttribute = async (cardId: string, field: 'isFoil' | 'isSpecificVersion', currentValue: boolean) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { [field]: !currentValue });
          // Pas de toast ici pour ne pas spammer l'UI, le switch visuel suffit
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

  const totalPrice = useMemo(() => {
    return cards.reduce((acc, card) => {
        const effectivePrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);
        return acc + effectivePrice * card.quantity;
    }, 0);
  }, [cards]);

  return { 
      cards, loading, isOwner, totalPrice,
      updateQuantity, removeCard, setCustomPrice, toggleAttribute // Export de la nouvelle fonction
  };
}