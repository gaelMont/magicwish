// hooks/useWishlists.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createListAction } from '@/app/actions/lists';
import toast from 'react-hot-toast';

export type WishlistMeta = {
  id: string;
  name: string;
  // AJOUT : Indispensable pour le tri
  createdAt?: { seconds: number; nanoseconds: number };
};

export function useWishlists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<WishlistMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Utilisation de l'action serveur pour la création
  const createList = useCallback(async (name: string) => {
    if (!user) return;
    const toastId = toast.loading("Création...");
    try {
      const res = await createListAction(user.uid, name, 'wishlist');
      
      if (res.success) {
        toast.success(`Liste "${name}" créée`, { id: toastId });
      } else {
        toast.error(res.error || "Erreur création", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur technique", { id: toastId });
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLists([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'wishlists_meta'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WishlistMeta[];
      
      // Auto-création de la première liste si aucune n'existe
      if (fetchedLists.length === 0 && !snapshot.metadata.fromCache) {
         // On appelle l'action, pas besoin d'ID "default" forcé, 
         // la première créée sera la plus ancienne donc la "gratuite"
         createList("Liste principale");
      } else {
         setLists(fetchedLists);
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Erreur fetch wishlists:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, createList]);

  const renameList = async (listId: string, newName: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'wishlists_meta', listId), {
        name: newName
      });
      toast.success("Renommé !");
    } catch (e) {
      console.error(e);
      toast.error("Erreur renommage");
    }
  };

  const deleteList = async (listId: string) => {
    if (!user) return;
    if (!confirm("Supprimer cette liste et toutes ses cartes ?")) return;
    
    const toastId = toast.loading("Suppression...");
    try {
      // 1. Supprimer les cartes
      const cardsRef = collection(db, 'users', user.uid, 'wishlists', listId, 'cards');
      const cardsSnap = await getDocs(cardsRef);
      
      const batch = writeBatch(db);
      cardsSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Supprimer la méta
      await deleteDoc(doc(db, 'users', user.uid, 'wishlists_meta', listId));
      
      toast.success("Liste supprimée", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Erreur suppression", { id: toastId });
    }
  };

  return { lists, createList, renameList, deleteList, loading };
}