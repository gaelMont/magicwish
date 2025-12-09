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

type WishlistCard = {
  id: string;
  name: string;
  imageUrl: string;
  quantity: number;
  price?: number;
  setName?: string;
  setCode?: string;
};

// URL du dos de carte par défaut (si image manquante)
const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

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
        setName: doc.data().setName || null,
        setCode: doc.data().setCode || null
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
      toast.success('Carte supprimée', { icon: '🗑️' });
    } catch (error) {
      toast.error("Erreur suppression");
    } finally {
      setCardToDelete(null);
    }
  };

  // Déplacement vers la Collection (Transaction sécurisée)
  const moveToCollection = async (card: WishlistCard) => {
    if (!user) return;
    const toastId = toast.loading("Déplacement vers la collection...");

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
            quantity: card.quantity,
            price: card.price || 0,
            setName: card.setName || null,
            setCode: card.setCode || null,
            addedAt: new Date()
          });
        }
        transaction.delete(wishlistRef);
      });

      toast.success("Carte ajoutée à votre collection ! 📦", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du déplacement", { id: toastId });
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

          <button onClick={() => setIsImportOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm">
            📂 Importer CSV
          </button>
        </div>
        
        <div className="flex items-center gap-4">
           <DeleteAllButton targetCollection="wishlist" />
           <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-6 py-3 rounded-xl shadow-sm border border-green-200 dark:border-green-700">
             <span className="text-sm uppercase tracking-wide opacity-80">Estimation Total</span>
             <div className="text-2xl font-bold">{totalPrice.toFixed(2)} €</div>
           </div>
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
              
              {/* Bouton Acheter */}
              <button
                onClick={() => moveToCollection(card)}
                className="absolute top-2 left-2 p-1.5 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm z-10"
                title="Déplacer vers Collection"
              >
                📦
              </button>

              {/* Bouton Poubelle */}
              <button
                onClick={() => setCardToDelete(card.id)}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10"
                title="Supprimer"
              >
                🗑️
              </button>

              {/* IMAGE ROBUSTE */}
              <img
                src={card.imageUrl || CARD_BACK_URL}
                alt={card.name}
                className="w-20 h-28 object-cover rounded shadow-sm bg-gray-200"
                onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate pr-6 pl-6" title={card.name}>{card.name}</h3>
                
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
                    <button onClick={() => updateQuantity(card.id, -1, card.quantity)} className="bg-gray-200 dark:bg-gray-700 w-8 h-8 rounded hover:bg-gray-300 font-bold">-</button>
                    <span className="font-mono text-xl w-6 text-center">{card.quantity}</span>
                    <button onClick={() => updateQuantity(card.id, 1, card.quantity)} className="bg-blue-100 dark:bg-blue-900 text-blue-600 font-bold">+</button>
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
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} targetCollection="wishlist" />
      <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={confirmDelete} title="Supprimer la carte ?" message="Voulez-vous vraiment retirer cette carte ?" />
    </main>
  );
}