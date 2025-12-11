// app/wishlist/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useWishlists } from '@/hooks/useWishlists';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';

// --- COMPOSANT INTERNE POUR AFFICHER UNE LISTE ---
const SingleWishlistView = ({ listId, listName }: { listId: string, listName: string }) => {
    const { cards, loading, updateQuantity, removeCard, totalPrice } = useCardCollection('wishlist', listId);
    const { user } = useAuth();
    
    // Logique de déplacement vers Collection (inchangée mais adaptée au path)
    const moveToCollection = async (card: CardType) => {
        if (!user) return;
        const toastId = toast.loading("Déplacement...");
        try {
            // Détermine le bon path source
            const sourcePath = listId === 'default' ? 'wishlist' : `wishlists_data/${listId}/cards`;
            const wishlistRef = doc(db, 'users', user.uid, sourcePath, card.id);
            const collectionRef = doc(db, 'users', user.uid, 'collection', card.id);

            await runTransaction(db, async (transaction) => {
                const colDoc = await transaction.get(collectionRef);
                if (colDoc.exists()) transaction.update(collectionRef, { quantity: increment(card.quantity) });
                else transaction.set(collectionRef, {
                    ...card,
                    wishlistId: null, // Nettoyage
                    addedAt: new Date()
                });
                transaction.delete(wishlistRef);
            });
            toast.success("Ajoutée à la collection !", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Erreur", { id: toastId });
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-4 border-b pb-2 dark:border-gray-700">
                <h2 className="text-2xl font-bold">{listName}</h2>
                <div className="text-right">
                    <span className="text-sm text-gray-500">Total estimé</span>
                    <p className="text-xl font-bold text-green-600">{totalPrice.toFixed(2)} €</p>
                </div>
            </div>
            {cards.length === 0 ? (
                <p className="text-gray-500 italic">Cette liste est vide.</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {cards.map(card => (
                        <MagicCard 
                            key={card.id} 
                            {...card} 
                            isWishlist={true}
                            onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
                            onDecrement={() => {
                                if(card.quantity === 1) {
                                    if(confirm("Supprimer ?")) removeCard(card.id);
                                } else {
                                    updateQuantity(card.id, -1, card.quantity);
                                }
                            }}
                            onDelete={() => { if(confirm("Supprimer ?")) removeCard(card.id); }}
                            onMove={() => moveToCollection(card)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function WishlistPage() {
  const { user } = useAuth();
  const { lists, createList, deleteList } = useWishlists();
  
  const [selectedListId, setSelectedListId] = useState<string>('default');
  const [newListName, setNewListName] = useState('');

  if (!user) return <p className="p-10 text-center">Connectez-vous.</p>;

  // Gestion de la création
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if(newListName.trim()) {
        createList(newListName);
        setNewListName('');
    }
  };

  return (
    <main className="container mx-auto p-4 flex flex-col md:flex-row gap-6 min-h-[80vh]">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 flex-none space-y-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                📑 Mes Listes
            </h3>
            
            <div className="flex flex-col gap-1">
                {/* Bouton "Vue Globale" (Optionnel - voir note plus bas) */}
                {/* Pour l'instant on liste les listes individuelles */}
                
                {lists.map(list => (
                    <div key={list.id} className="group flex items-center">
                        <button
                            onClick={() => setSelectedListId(list.id)}
                            className={`flex-grow text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                selectedListId === list.id 
                                ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/40 dark:text-blue-300' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            {list.name}
                        </button>
                        {list.id !== 'default' && (
                            <button 
                                onClick={() => deleteList(list.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 transition"
                                title="Supprimer la liste"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Création nouvelle liste */}
            <form onSubmit={handleCreate} className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <input 
                    type="text" 
                    placeholder="+ Nouvelle liste..." 
                    className="w-full text-sm p-2 border rounded mb-2 bg-transparent dark:border-gray-600"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                />
            </form>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <section className="flex-grow">
          <SingleWishlistView 
            key={selectedListId} // Force le remount quand on change de liste
            listId={selectedListId} 
            listName={lists.find(l => l.id === selectedListId)?.name || 'Liste'} 
          />
      </section>

    </main>
  );
}