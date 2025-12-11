// app/wishlist/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment } from 'firebase/firestore'; // Imports spécifiques pour le "Move"
import { useCardCollection, CardType } from '@/hooks/useCardCollection'; // <--- IMPORT DU HOOK
import toast from 'react-hot-toast';

import MagicCard from '@/components/MagicCard';
import ImportModal from '@/components/ImportModal';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteAllButton from '@/components/DeleteAllButton';

export default function WishlistPage() {
  const { user } = useAuth();

  // UTILISATION DU HOOK (Mode 'wishlist')
  const { cards, loading, updateQuantity, removeCard, totalPrice } = useCardCollection('wishlist');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  const handleDecrement = async (cardId: string, currentQty: number) => {
    const result = await updateQuantity(cardId, -1, currentQty);
    if (result === 'shouldDelete') setCardToDelete(cardId);
  };

  // --- LOGIQUE SPÉCIFIQUE WISHLIST : DÉPLACER VERS COLLECTION ---
  // On garde cette fonction ici car elle touche à deux collections différentes
  const moveToCollection = async (card: CardType) => {
    if (!user) return;
    const toastId = toast.loading("Déplacement...");
    
    try {
      const wishlistRef = doc(db, 'users', user.uid, 'wishlist', card.id);
      const collectionRef = doc(db, 'users', user.uid, 'collection', card.id);

      await runTransaction(db, async (transaction) => {
        const collectionDoc = await transaction.get(collectionRef);
        
        // Si existe déjà dans la collection, on augmente la quantité
        if (collectionDoc.exists()) {
          transaction.update(collectionRef, { quantity: increment(card.quantity) });
        } else {
          // Sinon on crée la carte
          transaction.set(collectionRef, {
            name: card.name,
            imageUrl: card.imageUrl,
            imageBackUrl: card.imageBackUrl || null,
            quantity: card.quantity,
            price: card.price || 0,
            setName: card.setName || null,
            setCode: card.setCode || null,
            addedAt: new Date()
          });
        }
        // Et on supprime de la wishlist
        transaction.delete(wishlistRef);
      });
      
      toast.success("Ajoutée à la collection ! 📦", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du déplacement", { id: toastId });
    }
  };

  if (loading) return <p className="text-center p-10 text-gray-500">Chargement de votre wishlist...</p>;
  if (!user) return <p className="text-center p-10">Veuillez vous connecter.</p>;

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <MagicCard 
              key={card.id}
              {...card}
              isWishlist={true}
              onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
              onDecrement={() => handleDecrement(card.id, card.quantity)}
              onDelete={() => setCardToDelete(card.id)}
              onMove={() => moveToCollection(card)}
            />
          ))}
        </div>
      )}

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} targetCollection="wishlist" />
      <ConfirmModal 
        isOpen={!!cardToDelete} 
        onClose={() => setCardToDelete(null)} 
        onConfirm={() => { if(cardToDelete) removeCard(cardToDelete); }} 
        title="Supprimer ?" 
        message="Voulez-vous retirer cette carte de la wishlist ?"
      />
    </main>
  );
}