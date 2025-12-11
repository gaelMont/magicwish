// app/wishlist/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ImportModal from '@/components/ImportModal';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteAllButton from '@/components/DeleteAllButton';
import MagicCard from '@/components/MagicCard'; // <--- IMPORT

type WishlistCard = {
  id: string;
  name: string;
  imageUrl: string;
  imageBackUrl?: string; // <--- AJOUT
  quantity: number;
  price?: number;
  setName?: string;
  setCode?: string;
};

export default function WishlistPage() {
  const { user, loading } = useAuth();
  const [cards, setCards] = useState<WishlistCard[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'wishlist'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as WishlistCard[];
      items.sort((a, b) => a.name.localeCompare(b.name));
      setCards(items);
    });
    return () => unsubscribe();
  }, [user]);

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!user) return;
    const cardRef = doc(db, 'users', user.uid, 'wishlist', cardId);
    if (currentQuantity + amount <= 0) {
      setCardToDelete(cardId);
    } else {
      await updateDoc(cardRef, { quantity: increment(amount) });
    }
  };

  const confirmDelete = async () => {
    if (!user || !cardToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'wishlist', cardToDelete));
      toast.success('Supprimée', { icon: '🗑️' });
    } catch (error) {
      toast.error("Erreur suppression");
    } finally {
      setCardToDelete(null);
    }
  };

  const moveToCollection = async (card: WishlistCard) => {
    if (!user) return;
    const toastId = toast.loading("Déplacement...");
    try {
      const wishlistRef = doc(db, 'users', user.uid, 'wishlist', card.id);
      const collectionRef = doc(db, 'users', user.uid, 'collection', card.id);

      await runTransaction(db, async (transaction) => {
        const collectionDoc = await transaction.get(collectionRef);
        if (collectionDoc.exists()) {
          transaction.update(collectionRef, { quantity: increment(card.quantity) });
        } else {
          transaction.set(collectionRef, {
            name: card.name,
            imageUrl: card.imageUrl,
            imageBackUrl: card.imageBackUrl || null, // On garde le dos si présent
            quantity: card.quantity,
            price: card.price || 0,
            setName: card.setName || null,
            setCode: card.setCode || null,
            addedAt: new Date()
          });
        }
        transaction.delete(wishlistRef);
      });
      toast.success("Ajoutée à la collection ! 📦", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du déplacement", { id: toastId });
    }
  };

  const totalPrice = cards.reduce((acc, card) => acc + (card.price || 0) * card.quantity, 0);

  if (loading) return <p className="text-center p-10">Chargement...</p>;
  if (!user) return <p className="text-center p-10">Connectez-vous.</p>;

  return (
    <main className="container mx-auto p-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">
            Ma Wishlist <span className="ml-3 text-lg font-normal text-gray-500">({cards.reduce((acc, c) => acc + c.quantity, 0)})</span>
          </h1>
          <button onClick={() => setIsImportOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm">
            📂 Importer CSV
          </button>
        </div>
        <div className="flex items-center gap-4">
           <DeleteAllButton targetCollection="wishlist" />
           <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-6 py-3 rounded-xl shadow-sm border border-green-200 dark:border-green-700">
             <span className="text-sm uppercase tracking-wide opacity-80">Total</span>
             <div className="text-2xl font-bold">{totalPrice.toFixed(2)} €</div>
           </div>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-xl text-gray-500 mb-4">Votre wishlist est vide.</p>
        </div>
      ) : (
        /* --- CHANGEMENT DE GRILLE ICI : lg:grid-cols-4 --- */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <MagicCard 
              key={card.id}
              {...card}
              isWishlist={true}
              onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
              onDecrement={() => updateQuantity(card.id, -1, card.quantity)}
              onDelete={() => setCardToDelete(card.id)}
              onMove={() => moveToCollection(card)}
            />
          ))}
        </div>
      )}

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} targetCollection="wishlist" />
      <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={confirmDelete} title="Supprimer ?" message="Retirer cette carte ?" />
    </main>
  );
}