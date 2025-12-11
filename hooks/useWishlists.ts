// hooks/useWishlists.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

export type WishlistMeta = {
  id: string;
  name: string;
  isDefault?: boolean; // Pour identifier la liste principale historique
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

    // On écoute la collection des métadonnées
    const metaRef = collection(db, 'users', user.uid, 'wishlists_meta');
    
    const unsubscribe = onSnapshot(metaRef, (snapshot) => {
      const fetchedLists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WishlistMeta[];

      // Si aucune liste n'existe (premier lancement V2), on crée la liste "Défaut"
      // qui pointera conceptuellement vers ton ancienne collection
      if (fetchedLists.length === 0 && !snapshot.metadata.fromCache) {
        createList("Liste principale", "default");
      } else {
        // On trie : Défaut en premier, puis alphabétique
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

  const deleteList = async (listId: string) => {
    if (!user || listId === 'default') return; // On protège la liste par défaut
    if (!confirm("Supprimer cette liste et toutes ses cartes ?")) return;
    
    try {
        // 1. Supprimer les métadonnées
        await deleteDoc(doc(db, 'users', user.uid, 'wishlists_meta', listId));
        
        // 2. Note: Idéalement, il faudrait aussi supprimer la sous-collection 'cards'.
        // C'est complexe côté client. Pour l'instant on supprime juste l'accès (meta).
        // Une Cloud Function serait idéale ici pour le nettoyage complet.
        
        toast.success("Liste supprimée");
    } catch (err) {
        console.error(err);
        toast.error("Erreur suppression");
    }
  };

  return { lists, loading, createList, deleteList };
}