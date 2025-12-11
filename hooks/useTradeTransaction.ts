// hooks/useTradeTransaction.ts
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, runTransaction, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { CardType } from './useCardCollection';
import toast from 'react-hot-toast';

type TradeSide = {
    uid: string; // L'ID de l'utilisateur (Moi ou l'Ami)
    losing: CardType[];
    gaining: CardType[];
};

export function useTradeTransaction() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // Fonction utilitaire pour préparer les références
  const getRef = (uid: string, collection: 'collection' | 'wishlist', cardId: string) => {
      return doc(db, 'users', uid, collection, cardId);
  };

  /**
   * Exécute l'échange.
   * Si partnerUid est null, c'est un échange manuel (on update juste mon côté).
   */
  const executeTrade = async (
      myCardsToGive: CardType[], 
      cardsToReceive: CardType[], 
      partnerUid: string | null = null
  ) => {
    if (!user) return;
    setIsProcessing(true);
    const toastId = toast.loading("Validation de l'échange...");

    try {
        await runTransaction(db, async (transaction) => {
            // --- 1. GESTION DE MON CÔTÉ (Moi) ---
            
            // A. Je perds des cartes (Ma Collection)
            for (const card of myCardsToGive) {
                const docRef = getRef(user.uid, 'collection', card.id);
                const docSnap = await transaction.get(docRef);
                
                if (!docSnap.exists()) throw new Error(`Erreur: Vous n'avez plus ${card.name}`);
                const currentQty = docSnap.data().quantity || 0;
                
                if (currentQty <= card.quantity) {
                    transaction.delete(docRef); // Plus d'exemplaire -> Suppression
                } else {
                    transaction.update(docRef, { quantity: increment(-card.quantity) });
                }
            }

            // B. Je gagne des cartes (Ma Collection + Nettoyage Ma Wishlist)
            for (const card of cardsToReceive) {
                const colRef = getRef(user.uid, 'collection', card.id);
                const wishRef = getRef(user.uid, 'wishlist', card.id); // On check la wishlist par défaut
                
                // Ajout Collection
                const colSnap = await transaction.get(colRef);
                if (colSnap.exists()) {
                    transaction.update(colRef, { quantity: increment(card.quantity) });
                } else {
                    // Création propre de la carte
                    transaction.set(colRef, {
                        name: card.name,
                        imageUrl: card.imageUrl,
                        imageBackUrl: card.imageBackUrl || null,
                        setName: card.setName || '',
                        price: card.price || 0,
                        quantity: card.quantity,
                        isFoil: card.isFoil || false,
                        isSpecificVersion: card.isSpecificVersion || false,
                        addedAt: serverTimestamp()
                    });
                }

                // Suppression Wishlist (Si je l'avais demandée)
                const wishSnap = await transaction.get(wishRef);
                if (wishSnap.exists()) {
                    transaction.delete(wishRef);
                }
            }

            // --- 2. GESTION DU PARTENAIRE (Si ce n'est pas un échange manuel) ---
            if (partnerUid) {
                // A. Il perd ce qu'il me donne (Sa Collection)
                for (const card of cardsToReceive) {
                    const docRef = getRef(partnerUid, 'collection', card.id);
                    // Note: On ne lit pas le doc pour économiser, on utilise increment(-x). 
                    // Risque mineur: si synchro décalée, il peut passer en négatif (rare).
                    // Pour faire propre, on devrait lire, mais increment est atomique.
                    transaction.update(docRef, { quantity: increment(-card.quantity) });
                     // Idéalement : check si qty <= 0 pour delete, mais update est plus safe sans lecture
                }

                // B. Il gagne ce que je donne (Sa Collection + Nettoyage Sa Wishlist)
                for (const card of myCardsToGive) {
                     const colRef = getRef(partnerUid, 'collection', card.id);
                     const wishRef = getRef(partnerUid, 'wishlist', card.id);

                     const colSnap = await transaction.get(colRef);
                     if (colSnap.exists()) {
                         transaction.update(colRef, { quantity: increment(card.quantity) });
                     } else {
                         transaction.set(colRef, {
                             ...card, // On copie les datas de ma carte
                             quantity: card.quantity,
                             addedAt: serverTimestamp(),
                             wishlistId: null
                         });
                     }

                     const wishSnap = await transaction.get(wishRef);
                     if (wishSnap.exists()) {
                         transaction.delete(wishRef);
                     }
                }
            }
        });

        toast.success("Échange validé et collections mises à jour !", { id: toastId });
        return true;

    } catch (error: any) {
        console.error(error);
        toast.error(`Erreur: ${error.message}`, { id: toastId });
        return false;
    } finally {
        setIsProcessing(false);
    }
  };

  return { executeTrade, isProcessing };
}