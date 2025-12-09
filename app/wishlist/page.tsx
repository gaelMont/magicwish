// app/wishlist/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';

type WishlistCard = {
  id: string;
  name: string;
  imageUrl: string;
  quantity: number;
  price?: number; // On ajoute le champ prix (optionnel pour les vieilles cartes)
};

export default function WishlistPage() {
  const { user, loading } = useAuth();
  const [cards, setCards] = useState<WishlistCard[]>([]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'wishlist'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        quantity: doc.data().quantity || 1,
        price: doc.data().price || 0 // Si pas de prix, on met 0 par défaut
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
      if (confirm('Voulez-vous retirer cette carte de la liste ?')) {
        await deleteDoc(cardRef);
        toast('Carte retirée', { icon: '🗑️' });
      }
    } else {
      await updateDoc(cardRef, { quantity: increment(amount) });
    }
  };

  // --- CALCUL DU TOTAL ---
  const totalPrice = cards.reduce((acc, card) => {
    return acc + (card.price || 0) * card.quantity;
  }, 0);

  if (loading) return <p className="text-center p-10">Chargement...</p>;
  if (!user) return <p className="text-center p-10">Connectez-vous pour voir votre liste.</p>;

  return (
    <main className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-center md:text-left">
          Ma Wishlist 
          <span className="ml-3 text-lg font-normal text-gray-500">
            ({cards.reduce((acc, c) => acc + c.quantity, 0)} cartes)
          </span>
        </h1>
        
        {/* LE GRAND TOTAL EN HAUT À DROITE */}
        <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-6 py-3 rounded-xl shadow-sm border border-green-200 dark:border-green-700">
          <span className="text-sm uppercase tracking-wide opacity-80">Estimation Total</span>
          <div className="text-2xl font-bold">{totalPrice.toFixed(2)} €</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.id} className="flex bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-3 gap-4 items-center">
            <img
              src={card.imageUrl}
              alt={card.name}
              className="w-20 h-28 object-cover rounded shadow-sm bg-gray-200"
            />
            
            <div className="flex-1 min-w-0"> {/* min-w-0 aide pour le truncate */}
              <h3 className="font-bold text-lg truncate">{card.name}</h3>
              
              {/* Affichage du prix unitaire */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Prix unit. : {card.price ? `${card.price} €` : 'N/A'}
              </p>
              
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => updateQuantity(card.id, -1, card.quantity)}
                    className="bg-gray-200 dark:bg-gray-700 w-8 h-8 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  
                  <span className="font-mono text-xl w-6 text-center">{card.quantity}</span>
                  
                  <button 
                    onClick={() => updateQuantity(card.id, 1, card.quantity)}
                    className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 w-8 h-8 rounded hover:bg-blue-200 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Prix Total pour cette carte (Qté * Prix) */}
                {card.price && card.price > 0 && (
                   <div className="font-bold text-lg text-right">
                     {(card.price * card.quantity).toFixed(2)} €
                   </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}