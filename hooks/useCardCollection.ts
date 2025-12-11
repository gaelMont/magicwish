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
};

export function useCardCollection(collectionName: 'collection' | 'wishlist') {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. ÉCOUTE TEMPS RÉEL
  useEffect(() => {
    if (!user) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(true);
    const colRef = collection(db, 'users', user.uid, collectionName);

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CardType[];
      
      setCards(items);
      setLoading(false);
    }, (error) => {
      console.error("Erreur Firestore:", error);
      toast.error("Impossible de charger la liste");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, collectionName, authLoading]);

  // OPTIMISATION : Tri calculé à la volée uniquement si 'cards' change
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  // 2. MISE À JOUR
  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!user) return;
    
    // Si on descend à 0 ou moins, on signale qu'il faut supprimer
    if (currentQuantity + amount <= 0) {
      return 'shouldDelete'; 
    }

    try {
      const cardRef = doc(db, 'users', user.uid, collectionName, cardId);
      await updateDoc(cardRef, { quantity: increment(amount) });
      return 'updated';
    } catch (err) {
      console.error(err);
      toast.error("Erreur de mise à jour");
      return 'error';
    }
  };

  // 3. SUPPRESSION
  const removeCard = async (cardId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, collectionName, cardId));
      toast.success('Carte retirée', { icon: '🗑️' });
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la suppression");
    }
  };

  // 4. PRIX TOTAL (Mémorisé)
  const totalPrice = useMemo(() => {
    return cards.reduce((acc, card) => acc + (card.price || 0) * card.quantity, 0);
  }, [cards]);

  return { 
    cards: sortedCards, // On renvoie la liste triée
    loading, 
    updateQuantity, 
    removeCard,
    totalPrice
  };
}