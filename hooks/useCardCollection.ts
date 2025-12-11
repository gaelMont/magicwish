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
  setName?: string;
  setCode?: string;
  wishlistId?: string; 
};

// MODIFICATION: Ajout du paramètre `targetUid` à la fin
export function useCardCollection(
    target: 'collection' | 'wishlist', 
    listId: string = 'default',
    targetUid?: string // <--- NOUVEAU PARAMÈTRE
) {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);

  // On détermine sur quel UID on travaille : celui passé en paramètre OU celui connecté
  const effectiveUid = targetUid || user?.uid;

  useEffect(() => {
    // Si pas d'UID effectif (ex: pas connecté et pas de cible), on attend
    if (!effectiveUid || authLoading) {
        if (!authLoading && !effectiveUid) setLoading(false);
        return;
    }

    setLoading(true);

    let collectionPath = '';
    
    if (target === 'collection') {
        collectionPath = `users/${effectiveUid}/collection`;
    } else {
        if (listId === 'default') {
            collectionPath = `users/${effectiveUid}/wishlist`;
        } else {
            collectionPath = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
        }
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
    }, (error) => {
      console.error("Erreur Firestore:", error);
      // Si erreur de permission (ex: on n'est pas ami), ça tombera ici
      setLoading(false);
    });

    return () => unsubscribe();
  }, [effectiveUid, target, listId, authLoading]);

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  // --- ACTIONS (Uniquement si c'est MON compte) ---
  // Si on visite un ami, on bloque les modifications
  const isOwner = user?.uid === effectiveUid;

  const getDocRef = (cardId: string) => {
      if (!isOwner || !effectiveUid) return null; // Sécurité côté client
      let path = '';
      if (target === 'collection') path = `users/${effectiveUid}/collection`;
      else if (listId === 'default') path = `users/${effectiveUid}/wishlist`;
      else path = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
      return doc(db, path, cardId);
  };

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!isOwner) return; // Bloqué
    const ref = getDocRef(cardId);
    if (!ref) return;

    if (currentQuantity + amount <= 0) return 'shouldDelete';

    try {
      await updateDoc(ref, { quantity: increment(amount) });
      return 'updated';
    } catch (err) {
      toast.error("Erreur update");
      return 'error';
    }
  };

  const removeCard = async (cardId: string) => {
    if (!isOwner) return; // Bloqué
    const ref = getDocRef(cardId);
    if(ref) {
        await deleteDoc(ref);
        toast.success('Carte retirée', { icon: '🗑️' });
    }
  };

  const totalPrice = useMemo(() => {
    return cards.reduce((acc, card) => acc + (card.price || 0) * card.quantity, 0);
  }, [cards]);

  return { cards: sortedCards, loading, updateQuantity, removeCard, totalPrice, isOwner };
}