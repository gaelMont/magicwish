// hooks/useCollections.ts
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createListAction } from '@/app/actions/lists';
import toast from 'react-hot-toast';

export type CollectionMeta = {
  id: string;
  name: string;
  // AJOUT : Indispensable pour le tri dans le Header
  createdAt?: { seconds: number; nanoseconds: number };
};

export function useCollections() {
  const { user } = useAuth();
  const [lists, setLists] = useState<CollectionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLists([]);
      setLoading(false);
      return;
    }

    // On trie directement par date de création côté Firestore
    const q = query(
      collection(db, 'users', user.uid, 'collections_meta'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollectionMeta[];
      
      setLists(data);
      setLoading(false);
    }, (error) => {
      console.error("Erreur fetch collections:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const createList = async (name: string) => {
    if (!user) return;
    const toastId = toast.loading("Création...");
    try {
      // Utilisation de l'action serveur pour vérifier les limites (Gratuit vs Premium)
      const res = await createListAction(user.uid, name, 'collection');
      
      if (res.success) {
        toast.success(`Collection "${name}" créée`, { id: toastId });
      } else {
        toast.error(res.error || "Erreur création", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur technique", { id: toastId });
    }
  };

  const renameList = async (listId: string, newName: string) => {
    // Note: Pour renommer, on peut utiliser updateDoc directement car pas de logique de limite ici
    // Mais on pourrait aussi créer une Server Action si besoin de sécu supplémentaire
    // Pour l'instant on garde votre logique qui fonctionnait (via import dynamique ou adaptation)
    // Comme votre code original utilisait updateDoc, je le réintègre ici :
    const { updateDoc } = await import('firebase/firestore'); // Import dynamique pour alléger ou standard
    
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'collections_meta', listId), {
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
    if (!confirm("Attention : Cela supprimera TOUTES les cartes de ce classeur. Continuer ?")) return;
    
    const toastId = toast.loading("Suppression...");
    try {
      // 1. Supprimer les cartes (sous-collection)
      const cardsRef = collection(db, 'users', user.uid, 'collections', listId, 'cards');
      const cardsSnap = await getDocs(cardsRef);
      
      const batch = writeBatch(db);
      cardsSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Supprimer la méta
      await deleteDoc(doc(db, 'users', user.uid, 'collections_meta', listId));
      
      toast.success("Classeur supprimé", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Erreur suppression", { id: toastId });
    }
  };

  return { lists, createList, renameList, deleteList, loading };
}