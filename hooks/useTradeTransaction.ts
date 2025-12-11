// hooks/useTradeTransaction.ts
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, runTransaction, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { CardType } from './useCardCollection';
import toast from 'react-hot-toast';

export function useTradeTransaction() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const getRef = (uid: string, collection: 'collection' | 'wishlist', cardId: string) => {
      return doc(db, 'users', uid, collection, cardId);
  };

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
            // ============================================================
            // 1. PHASE DE LECTURE (READS) - ON NE MODIFIE RIEN ICI
            // ============================================================
            
            // --- A. MOI : Je donne (Je dois vérifier que j'ai toujours les cartes) ---
            const myGiveOps = [];
            for (const card of myCardsToGive) {
                const ref = getRef(user.uid, 'collection', card.id);
                const snap = await transaction.get(ref);
                if (!snap.exists()) throw new Error(`Erreur : Vous n'avez plus la carte ${card.name}`);
                myGiveOps.push({ ref, snap, card });
            }

            // --- B. MOI : Je reçois ---
            const myReceiveOps = [];
            for (const card of cardsToReceive) {
                const colRef = getRef(user.uid, 'collection', card.id);
                const wishRef = getRef(user.uid, 'wishlist', card.id);
                
                const colSnap = await transaction.get(colRef);
                const wishSnap = await transaction.get(wishRef);
                
                myReceiveOps.push({ colRef, wishRef, colSnap, wishSnap, card });
            }

            // --- C. PARTENAIRE (Si existe) ---
            const partnerGiveOps = [];
            const partnerReceiveOps = [];

            if (partnerUid) {
                // Il perd ce qu'il me donne
                for (const card of cardsToReceive) {
                    const ref = getRef(partnerUid, 'collection', card.id);
                    const snap = await transaction.get(ref); 
                    partnerGiveOps.push({ ref, snap, card });
                }

                // Il gagne ce que je donne
                for (const card of myCardsToGive) {
                    const colRef = getRef(partnerUid, 'collection', card.id);
                    const wishRef = getRef(partnerUid, 'wishlist', card.id);
                    const colSnap = await transaction.get(colRef);
                    const wishSnap = await transaction.get(wishRef);
                    partnerReceiveOps.push({ colRef, wishRef, colSnap, wishSnap, card });
                }
            }

            // ============================================================
            // 2. PHASE D'ÉCRITURE (WRITES) - ON APPLIQUE TOUT MAINTENANT
            // ============================================================

            // --- A. MOI : Je perds ---
            for (const { ref, snap, card } of myGiveOps) {
                const currentQty = snap.data()?.quantity || 0;
                if (currentQty <= card.quantity) {
                    transaction.delete(ref);
                } else {
                    transaction.update(ref, { quantity: increment(-card.quantity) });
                }
            }

            // --- B. MOI : Je gagne ---
            for (const { colRef, wishRef, colSnap, wishSnap, card } of myReceiveOps) {
                if (colSnap.exists()) {
                    transaction.update(colRef, { quantity: increment(card.quantity) });
                } else {
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
                if (wishSnap.exists()) {
                    transaction.delete(wishRef);
                }
            }

            // --- C. PARTENAIRE ---
            if (partnerUid) {
                // Il perd
                for (const { ref, card } of partnerGiveOps) {
                    transaction.update(ref, { quantity: increment(-card.quantity) });
                }
                // Il gagne
                for (const { colRef, wishRef, colSnap, wishSnap, card } of partnerReceiveOps) {
                     if (colSnap.exists()) {
                         transaction.update(colRef, { quantity: increment(card.quantity) });
                     } else {
                         transaction.set(colRef, {
                             ...card, 
                             quantity: card.quantity,
                             addedAt: serverTimestamp(),
                             wishlistId: null
                         });
                     }
                     if (wishSnap.exists()) {
                         transaction.delete(wishRef);
                     }
                }
            }
        });

        toast.success("Échange validé et collections mises à jour !", { id: toastId });
        return true;

    } catch (error: unknown) {
        console.error(error);
        const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
        toast.error(`Erreur: ${errMsg}`, { id: toastId });
        return false;
    } finally {
        setIsProcessing(false);
    }
  };

  return { executeTrade, isProcessing };
}