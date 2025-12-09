// app/wishlist/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ImportModal from '@/components/ImportModal';
import ConfirmModal from '@/components/ConfirmModal'; 

type WishlistCard = {
  id: string;
  name: string;
  imageUrl: string;
  quantity: number;
  price?: number;
  setName?: string;
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
        quantity: doc.data().quantity || 1,
        price: doc.data().price || 0,
        setName: doc.data().setName || null
      })) as WishlistCard[];
      
      items.sort((a, b) => a.name.localeCompare(b.name));
      setCards(items);
    });

    return () => unsubscribe();
  }, [user]);

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!user) return;
    const cardRef = doc(db, 'users', user.uid, 'wishlist', cardId);

    // Si on arrive à 0, on propose de supprimer
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
      toast.success('Carte supprimée', { icon: '🗑️' });
    } catch (error) {
      toast.error("Erreur suppression");
    } finally {
      setCardToDelete(null);
    }
  };

  const totalPrice = cards.reduce((acc, card) => {
    return acc + (card.price || 0) * card.quantity;
  }, 0);

  if (loading) return <p className="text-center p-10">Chargement...</p>;
  if (!user) return <p className="text-center p-10">Connectez-vous pour voir votre liste.</p>;

  return (
    <main className="container mx-auto p-4 pb-20">
      
      {/* EN-TÊTE */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-center md:text-left">
            Ma Wishlist 
            <span className="ml-3 text-lg font-normal text-gray-500">
              ({cards.reduce((acc, c) => acc + c.quantity, 0)} cartes)
            </span>
          </h1>

          <button
            onClick={() => setIsImportOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
          >
            📂 Importer CSV
          </button>
        </div>
        
        <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-6 py-3 rounded-xl shadow-sm border border-green-200 dark:border-green-700">
          <span className="text-sm uppercase tracking-wide opacity-80">Estimation Total</span>
          <div className="text-2xl font-bold">{totalPrice.toFixed(2)} €</div>
        </div>
      </div>

      {/* LISTE DES CARTES */}
      {cards.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-xl text-gray-500 mb-4">Votre wishlist est vide.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.id} className="relative group flex bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-3 gap-4 items-center border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
              
              {/* BOUTON POUBELLE (Visible au survol ou tout le temps sur mobile) */}
              <button
                onClick={() => setCardToDelete(card.id)}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
                title="Supprimer la carte"
              >
                🗑️
              </button>

              <img
                src={card.imageUrl}
                alt={card.name}
                className="w-20 h-28 object-cover rounded shadow-sm bg-gray-200"
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate pr-6" title={card.name}>{card.name}</h3>
                
                {card.setName && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 truncate font-medium">
                    {card.setName}
                  </p>
                )}
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Prix unit. : {card.price && card.price > 0 ? `${card.price} €` : 'N/A'}
                </p>
                
                <div className="flex justify-between items-end mt-2">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => updateQuantity(card.id, -1, card.quantity)}
                      className="bg-gray-200 dark:bg-gray-700 w-8 h-8 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold transition-colors"
                    >
                      -
                    </button>
                    
                    <span className="font-mono text-xl w-6 text-center">{card.quantity}</span>
                    
                    <button 
                      onClick={() => updateQuantity(card.id, 1, card.quantity)}
                      className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 w-8 h-8 rounded hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {card.price && card.price > 0 && (
                     <div className="font-bold text-lg text-right text-gray-700 dark:text-gray-200">
                       {(card.price * card.quantity).toFixed(2)} €
                     </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      <ConfirmModal 
        isOpen={!!cardToDelete} 
        onClose={() => setCardToDelete(null)}
        onConfirm={confirmDelete}
        title="Supprimer la carte ?"
        message="Voulez-vous vraiment retirer cette carte de votre liste ?"
      />

    </main>
  );
}