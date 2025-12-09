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
  quantity: number; // On ajoute le type quantity
};

export default function WishlistPage() {
  const { user, loading } = useAuth();
  const [cards, setCards] = useState<WishlistCard[]>([]);

  // On utilise onSnapshot pour une mise à jour EN TEMPS RÉEL
  useEffect(() => {
    if (!user) return;

    // Écoute permanente de la base de données
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'wishlist'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        quantity: doc.data().quantity || 1 // Sécurité pour les anciennes cartes
      })) as WishlistCard[];
      
      // Tri par nom
      items.sort((a, b) => a.name.localeCompare(b.name));
      setCards(items);
    });

    return () => unsubscribe();
  }, [user]);

  // Fonction pour changer la quantité (+1 ou -1)
  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!user) return;
    const cardRef = doc(db, 'users', user.uid, 'wishlist', cardId);

    if (currentQuantity + amount <= 0) {
      // Si on arrive à 0, on demande confirmation pour supprimer
      if (confirm('Voulez-vous retirer cette carte de la liste ?')) {
        await deleteDoc(cardRef);
        toast('Carte retirée', { icon: '🗑️' });
      }
    } else {
      // Sinon on met à jour (+1 ou -1)
      await updateDoc(cardRef, { quantity: increment(amount) });
    }
  };

  if (loading) return <p className="text-center p-10">Chargement...</p>;
  if (!user) return <p className="text-center p-10">Connectez-vous pour voir votre liste.</p>;

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Ma Wishlist ({cards.reduce((acc, c) => acc + c.quantity, 0)} cartes)</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.id} className="flex bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-3 gap-4 items-center">
            {/* Image miniature */}
            <img
              src={card.imageUrl}
              alt={card.name}
              className="w-20 h-28 object-cover rounded shadow-sm"
            />
            
            {/* Info et contrôles */}
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">{card.name}</h3>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => updateQuantity(card.id, -1, card.quantity)}
                  className="bg-gray-200 dark:bg-gray-700 w-8 h-8 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center font-bold"
                >
                  -
                </button>
                
                <span className="font-mono text-xl w-8 text-center">{card.quantity}</span>
                
                <button 
                  onClick={() => updateQuantity(card.id, 1, card.quantity)}
                  className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 w-8 h-8 rounded hover:bg-blue-200 flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}