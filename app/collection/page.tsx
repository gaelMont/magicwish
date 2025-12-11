// app/collection/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ImportModal from '@/components/ImportModal';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteAllButton from '@/components/DeleteAllButton';
import MagicCard from '@/components/MagicCard'; // <--- IMPORT DU NOUVEAU COMPOSANT

// On ajoute imageBackUrl au type
type CollectionCard = {
  id: string;
  name: string;
  imageUrl: string;
  imageBackUrl?: string; // <--- AJOUT
  quantity: number;
  price?: number;
  setName?: string;
};

export default function CollectionPage() {
  const { user, loading } = useAuth();
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'collection'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as CollectionCard[];
      items.sort((a, b) => a.name.localeCompare(b.name));
      setCards(items);
    });
    return () => unsubscribe();
  }, [user]);

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!user) return;
    const cardRef = doc(db, 'users', user.uid, 'collection', cardId);
    if (currentQuantity + amount <= 0) {
      setCardToDelete(cardId);
    } else {
      await updateDoc(cardRef, { quantity: increment(amount) });
    }
  };

  const confirmDelete = async () => {
    if (!user || !cardToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'collection', cardToDelete));
      toast.success('Retirée de la collection', { icon: '🗑️' });
    } catch (error) {
      toast.error("Erreur suppression");
    } finally {
      setCardToDelete(null);
    }
  };

  const totalPrice = cards.reduce((acc, card) => acc + (card.price || 0) * card.quantity, 0);

  if (loading) return <p className="text-center p-10">Chargement...</p>;
  if (!user) return <p className="text-center p-10">Connectez-vous.</p>;

  return (
    <main className="container mx-auto p-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            Ma Collection <span className="ml-3 text-lg font-normal text-gray-500">({cards.reduce((acc, c) => acc + c.quantity, 0)})</span>
          </h1>
          <button onClick={() => setIsImportOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm">
            📂 Importer CSV
          </button>
        </div>
        <div className="flex items-center gap-4">
           <DeleteAllButton targetCollection="collection" />
           <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-100 px-6 py-3 rounded-xl shadow-sm border border-blue-200 dark:border-blue-700">
             <span className="text-sm uppercase tracking-wide opacity-80">Valeur</span>
             <div className="text-2xl font-bold">{totalPrice.toFixed(2)} €</div>
           </div>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-xl text-gray-500 mb-4">Votre collection est vide.</p>
        </div>
      ) : (
        /* --- CHANGEMENT DE GRILLE ICI : lg:grid-cols-4 --- */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <MagicCard 
              key={card.id}
              {...card}
              onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
              onDecrement={() => updateQuantity(card.id, -1, card.quantity)}
              onDelete={() => setCardToDelete(card.id)}
            />
          ))}
        </div>
      )}

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} targetCollection="collection" />
      <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={confirmDelete} title="Retirer ?" message="Cette carte sera retirée." />
    </main>
  );
}