// hooks/useCollections.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, serverTimestamp, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

export type CollectionMeta = {
  id: string;
  name: string;
  isDefault?: boolean;
};

export function useCollections() {
  const { user } = useAuth();
  const [lists, setLists] = useState<CollectionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLists([]); 
      setLoading(false);
      return;
    }

    const metaRef = collection(db, 'users', user.uid, 'collections_meta');
    
    const unsubscribe = onSnapshot(metaRef, (snapshot) => {
      const fetchedLists: CollectionMeta[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<CollectionMeta, 'id'>) 
      }));

      const hasDefault = fetchedLists.some(l => l.id === 'default');
      if (!hasDefault) {
          fetchedLists.unshift({ 
              id: 'default', 
              name: 'Collection Principale (Binder)', 
              isDefault: true 
          });
      }

      fetchedLists.sort((a, b) => {
          if (a.id === 'default') return -1;
          if (b.id === 'default') return 1;
          return a.name.localeCompare(b.name);
      });
      
      setLists(fetchedLists);
      setLoading(false); 
    });

    return () => unsubscribe();
  }, [user]);

  const createList = async (name: string) => {
    if (!user) return;
    try {
      const data = { name, createdAt: serverTimestamp() };
      await addDoc(collection(db, 'users', user.uid, 'collections_meta'), data);
      toast.success(`Collection "${name}" créée`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur création collection");
    }
  };

  const renameList = async (listId: string, newName: string) => {
    if (!user || listId === 'default') {
        toast.error("Impossible de renommer la collection principale.");
        return;
    }
    
    try {
        const listRef = doc(db, 'users', user.uid, 'collections_meta', listId);
        await updateDoc(listRef, { name: newName });
        toast.success("Collection renommée");
    } catch (err) {
        console.error(err);
        toast.error("Erreur lors du renommage");
    }
  };

  const deleteList = async (listId: string) => {
    if (!user || listId === 'default') {
        toast.error("Impossible de supprimer la collection principale.");
        return; 
    }
    if (!confirm("Supprimer cette collection et TOUTES ses cartes ?")) return;
    
    const toastId = toast.loading("Suppression en cours...");

    try {
        await deleteDoc(doc(db, 'users', user.uid, 'collections_meta', listId));
        toast.success("Collection supprimée (Le contenu sera nettoyé en arrière-plan).", { id: toastId });
    } catch (err) {
        console.error(err);
        toast.error("Erreur suppression", { id: toastId });
    }
  };

  return { lists, loading, createList, renameList, deleteList };
}