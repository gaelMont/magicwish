import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useCollections } from './useCollections';
import { useWishlists } from './useWishlists';
import toast from 'react-hot-toast';

// Définition d'un type de base pour éviter 'any'
export interface BaseCard {
  id: string;
  name?: string;
  addedAt?: { seconds: number; nanoseconds: number };
  // Permet d'accéder à d'autres propriétés dynamiquement tout en restant typé
  [key: string]: unknown;
}

// Type étendu pour la vue globale
export interface AggregatedCard extends BaseCard {
  _listId: string;
  _listName: string;
}

export function useAggregatedCards(type: 'collection' | 'wishlist') {
  const { user } = useAuth();
  const { lists: collectionLists } = useCollections();
  const { lists: wishlistLists } = useWishlists();
  
  const listsToFetch = type === 'collection' ? collectionLists : wishlistLists;

  const [cards, setCards] = useState<AggregatedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si pas d'utilisateur, on ne fait rien
    if (!user) return;

    // Si aucune liste à récupérer, on arrête le chargement immédiatement
    if (listsToFetch.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setCards([]);
      return;
    }

    setLoading(true);
    const unsubscribers: (() => void)[] = [];
    const cardsMap = new Map<string, AggregatedCard[]>();

    // Fonction interne pour fusionner et mettre à jour l'état
    const updateMergedCards = () => {
      const allCards: AggregatedCard[] = [];
      cardsMap.forEach((listCards) => {
        allCards.push(...listCards);
      });
      
      // Tri par date d'ajout (plus récent en haut)
      // On sécurise l'accès à addedAt
      allCards.sort((a, b) => {
        const timeA = a.addedAt?.seconds ?? 0;
        const timeB = b.addedAt?.seconds ?? 0;
        return timeB - timeA;
      });

      setCards(allCards);
      setLoading(false);
    };

    listsToFetch.forEach(list => {
      const collectionName = type === 'collection' ? 'collections' : 'wishlists';
      
      const q = query(
        collection(db, 'users', user.uid, collectionName, list.id, 'cards'),
        orderBy('addedAt', 'desc')
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const listCards = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            _listId: list.id,
            _listName: list.name
          } as AggregatedCard;
        });
        
        cardsMap.set(list.id, listCards);
        updateMergedCards();
      });

      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(u => u());
    };
  }, [user, listsToFetch, type]);

  // --- ACTIONS ---

  const updateCard = async (cardId: string, listId: string, updates: Partial<BaseCard>) => {
    if (!user || !listId) return;
    try {
      const collectionName = type === 'collection' ? 'collections' : 'wishlists';
      const cardRef = doc(db, 'users', user.uid, collectionName, listId, 'cards', cardId);
      // On cast updates pour satisfaire Firestore qui attend des paires clé/valeur
      await updateDoc(cardRef, updates as Record<string, unknown>);
      toast.success("Carte mise à jour");
    } catch (error) {
      console.error(error);
      toast.error("Erreur mise à jour");
    }
  };

  const deleteCard = async (cardId: string, listId: string) => {
     if (!user || !listId) return;
     if (!confirm("Supprimer cette carte ?")) return;
     try {
        const collectionName = type === 'collection' ? 'collections' : 'wishlists';
        const cardRef = doc(db, 'users', user.uid, collectionName, listId, 'cards', cardId);
        await deleteDoc(cardRef);
        toast.success("Carte supprimée");
     } catch (error) {
        console.error(error);
        toast.error("Erreur suppression");
     }
  };

  return { cards, loading, updateCard, deleteCard };
}