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
  wishlistId?: string; // Utile pour la vue globale
};

// MODIFICATION: On accepte maintenant un path explicite ou un listId
export function useCardCollection(target: 'collection' | 'wishlist', listId: string = 'default') {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || authLoading) {
        if (!authLoading) setLoading(false);
        return;
    }

    setLoading(true);

    // LOGIQUE DE CHEMIN DYNAMIQUE
    let collectionPath = '';
    
    if (target === 'collection') {
        // La collection reste unique (pour l'instant)
        collectionPath = `users/${user.uid}/collection`;
    } else {
        // Gestion des Wishlists
        if (listId === 'default') {
            // Rétro-compatibilité : l'ancienne wishlist
            collectionPath = `users/${user.uid}/wishlist`;
        } else {
            // Nouvelles wishlists
            collectionPath = `users/${user.uid}/wishlists_data/${listId}/cards`;
        }
    }

    const colRef = collection(db, collectionPath);

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        wishlistId: listId, // On marque l'origine
        ...doc.data(),
      })) as CardType[];
      
      setCards(items);
      setLoading(false);
    }, (error) => {
      console.error("Erreur Firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, target, listId, authLoading]);

  // Tri
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  // Helpers pour retrouver le bon chemin pour les updates
  const getDocRef = (cardId: string) => {
      if (!user) return null;
      let path = '';
      if (target === 'collection') path = `users/${user.uid}/collection`;
      else if (listId === 'default') path = `users/${user.uid}/wishlist`;
      else path = `users/${user.uid}/wishlists_data/${listId}/cards`;
      return doc(db, path, cardId);
  };

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!user) return;
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
    if (!user) return;
    const ref = getDocRef(cardId);
    if(ref) {
        await deleteDoc(ref);
        toast.success('Carte retirée', { icon: '🗑️' });
    }
  };

  const totalPrice = useMemo(() => {
    return cards.reduce((acc, card) => acc + (card.price || 0) * card.quantity, 0);
  }, [cards]);

  return { cards: sortedCards, loading, updateQuantity, removeCard, totalPrice };
}