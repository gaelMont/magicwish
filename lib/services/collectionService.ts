// lib/services/collectionService.ts
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment, serverTimestamp } from 'firebase/firestore';
import { CardType } from '@/hooks/useCardCollection';

/**
 * Déplace une carte d'une Wishlist vers la Collection principale.
 * Gère la transaction atomique (Ajout Collection + Suppression Wishlist).
 */
export async function moveCardFromWishlistToCollection(
    userId: string,
    card: CardType,
    originListId: string = 'default'
): Promise<{ success: boolean; error?: string }> {
    
    try {
        const sourcePath = originListId === 'default' 
            ? 'wishlist' 
            : `wishlists_data/${originListId}/cards`;
            
        const wishlistRef = doc(db, 'users', userId, sourcePath, card.id);
        const collectionRef = doc(db, 'users', userId, 'collection', card.id);

        await runTransaction(db, async (transaction) => {
            // Lecture (nécessaire avant écriture dans une transaction)
            const colDoc = await transaction.get(collectionRef);

            // Écritures
            if (colDoc.exists()) {
                // Si la carte existe, on incrémente
                transaction.update(collectionRef, { 
                    quantity: increment(card.quantity) 
                });
            } else {
                // Sinon on crée
                transaction.set(collectionRef, { 
                    ...card,
                    // On s'assure que les champs sont propres
                    imageBackUrl: card.imageBackUrl || null, 
                    wishlistId: null, // Elle n'est plus dans une wishlist
                    addedAt: serverTimestamp(), // Utilisation du timestamp client
                    isFoil: card.isFoil || false,
                    isForTrade: false // Par défaut, pas à l'échange quand on vient de l'acheter
                });
            }

            // Suppression de la source
            transaction.delete(wishlistRef);
        });

        return { success: true };

    } catch (error: unknown) {
        console.error("Erreur Service Collection:", error);
        let msg = "Erreur inconnue";
        if (error instanceof Error) msg = error.message;
        return { success: false, error: msg };
    }
}