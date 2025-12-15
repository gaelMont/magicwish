// hooks/useWishlists.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { deleteWishlistAction } from '@/app/actions/wishlist'; 
import toast from 'react-hot-toast';

export type WishlistMeta = {
  id: string;
  name: string;
  isDefault?: boolean;
};

export function useWishlists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<WishlistMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLists([]);
      setLoading(false);
      return;
    }

    const metaRef = collection(db, 'users', user.uid, 'wishlists_meta');
    
    const unsubscribe = onSnapshot(metaRef, (snapshot) => {
      const fetchedLists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WishlistMeta[];

      if (fetchedLists.length === 0 && !snapshot.metadata.fromCache) {
        createList("Liste principale", "default");
      } else {
        fetchedLists.sort((a, b) => {
          if (a.id === 'default') return -1;
          if (b.id === 'default') return 1;
          return a.name.localeCompare(b.name);
        });
        setLists(fetchedLists);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const createList = async (name: string, customId?: string) => {
    if (!user) return;
    try {
      const data = { name, createdAt: serverTimestamp() };
      if (customId) {
        await setDoc(doc(db, 'users', user.uid, 'wishlists_meta', customId), { ...data, isDefault: true });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'wishlists_meta'), data);
      }
      toast.success(`Liste "${name}" créée`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur création liste");
    }
  };

  const renameList = async (listId: string, newName: string) => {
    if (!user || listId === 'default') {
        toast.error("Impossible de renommer la liste principale.");
        return;
    }
    
    try {
        const listRef = doc(db, 'users', user.uid, 'wishlists_meta', listId);
        await updateDoc(listRef, { name: newName });
        toast.success("Liste renommée");
    } catch (err) {
        console.error(err);
        toast.error("Erreur lors du renommage");
    }
  };

  const deleteList = async (listId: string) => {
    if (!user || listId === 'default') return; 
    if (!confirm("Supprimer cette liste et toutes ses cartes ?")) return;
    
    const toastId = toast.loading("Suppression en cours...");

    try {
        const result = await deleteWishlistAction(user.uid, listId);

        if (result.success) {
            toast.success("Liste supprimée", { id: toastId });
        } else {
            throw new Error(result.error);
        }
    } catch (err: unknown) {
        console.error(err);
        let msg = "Erreur suppression";
        if (err instanceof Error) msg = err.message;
        toast.error(msg, { id: toastId });
    }
  };

  return { lists, loading, createList, renameList, deleteList };
}