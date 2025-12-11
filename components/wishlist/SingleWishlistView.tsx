// components/wishlist/SingleWishlistView.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';

type Props = {
    listId: string;
    listName: string;
};

export default function SingleWishlistView({ listId, listName }: Props) {
    // On récupère toggleAttribute ici
    const { cards, loading, updateQuantity, removeCard, toggleAttribute, totalPrice } = useCardCollection('wishlist', listId);
    const { user } = useAuth();
    
    const moveToCollection = async (card: CardType) => {
        if (!user) return;
        const toastId = toast.loading("Déplacement...");
        try {
            const sourcePath = listId === 'default' ? 'wishlist' : `wishlists_data/${listId}/cards`;
            const wishlistRef = doc(db, 'users', user.uid, sourcePath, card.id);
            const collectionRef = doc(db, 'users', user.uid, 'collection', card.id);

            await runTransaction(db, async (transaction) => {
                const colDoc = await transaction.get(collectionRef);
                // On garde les propriétés Foil/Version lors du déplacement si la carte n'existe pas encore
                // Sinon on incrémente juste.
                if (colDoc.exists()) {
                    transaction.update(collectionRef, { quantity: increment(card.quantity) });
                } else {
                    transaction.set(collectionRef, { 
                        ...card, 
                        wishlistId: null, 
                        addedAt: new Date(),
                        isFoil: card.isFoil || false // On garde l'info
                    });
                }
                transaction.delete(wishlistRef);
            });
            toast.success("Ajoutée à la collection !", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Erreur", { id: toastId });
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Chargement des cartes...</div>;

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-6 border-b pb-4 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{listName}</h2>
                <div className="text-right">
                    <span className="text-xs text-gray-500 uppercase font-semibold">Total estimé</span>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalPrice.toFixed(2)} €</p>
                </div>
            </div>

            {cards.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 italic">Cette liste est vide.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {cards.map(card => (
                        <MagicCard 
                            key={card.id} 
                            {...card} 
                            isWishlist={true}
                            onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
                            onDecrement={() => {
                                if(card.quantity === 1) { if(confirm("Supprimer ?")) removeCard(card.id); } 
                                else { updateQuantity(card.id, -1, card.quantity); }
                            }}
                            onDelete={() => { if(confirm("Supprimer ?")) removeCard(card.id); }}
                            onMove={() => moveToCollection(card)}
                            // NOUVEAU : On passe la fonction de toggle
                            onToggleAttribute={(field, val) => toggleAttribute(card.id, field, val)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}