'use client';

import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import toast from 'react-hot-toast';
import { moveCardFromWishlistToCollection } from '@/lib/services/collectionService'; 

type Props = {
    listId: string;
    listName: string;
};

export default function SingleWishlistView({ listId, listName }: Props) {
    const { cards, loading, updateQuantity, removeCard, toggleAttribute, totalPrice } = useCardCollection('wishlist', listId);
    const { user } = useAuth();
    
    const moveToCollection = async (card: CardType) => {
        if (!user) return;
        const toastId = toast.loading("Déplacement...");
        
        const result = await moveCardFromWishlistToCollection(user.uid, card, listId);

        if (result.success) {
            toast.success("Ajoutée à la collection !", { id: toastId });
        } else {
            toast.error(result.error || "Erreur technique", { id: toastId });
        }
    };

    if (loading) return <div className="p-10 text-center text-muted">Chargement des cartes...</div>;

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-6 border-b border-border pb-4">
                <h2 className="text-2xl font-bold text-foreground">{listName}</h2>
                <div className="text-right">
                    <span className="text-xs text-muted uppercase font-semibold">Total estimé</span>
                    <p className="text-2xl font-bold text-success">{totalPrice.toFixed(2)} €</p>
                </div>
            </div>

            {cards.length === 0 ? (
                <div className="text-center py-12 bg-secondary/30 rounded-xl border border-dashed border-border">
                    <p className="text-muted italic">Cette liste est vide.</p>
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
                            onMove={() => moveToCollection(card)}
                            onToggleAttribute={(field, val) => toggleAttribute(card.id, field, val)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}