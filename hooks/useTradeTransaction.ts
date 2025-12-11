// hooks/useTradeTransaction.ts
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, runTransaction, serverTimestamp, increment, DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { CardType } from './useCardCollection';
import toast from 'react-hot-toast';

// Helper pour nettoyer l'objet avant écriture (Sécurité & Propreté)
// On ne garde que ce qui est pertinent pour la DB, on vire les états UI
const createCardData = (card: CardType) => {
    return {
        name: card.name,
        imageUrl: card.imageUrl,
        imageBackUrl: card.imageBackUrl || null,
        setName: card.setName || '',
        setCode: card.setCode || '',
        price: card.price || 0,
        // On force la quantité à celle de l'échange lors de la création
        quantity: card.quantity, 
        isFoil: card.isFoil || false,
        isSpecificVersion: card.isSpecificVersion || false,
        scryfallData: card.scryfallData || null,
        addedAt: serverTimestamp(),
        // On s'assure que ces champs sont reset
        wishlistId: null,
        isForTrade: false 
    };
};

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
    if (!user) return false;
    
    setIsProcessing(true);
    const toastId = toast.loading("Vérification des stocks et échange...");

    try {
        await runTransaction(db, async (transaction) => {
            // --- ÉTAPE 1 : LECTURES & VÉRIFICATIONS (READS) ---
            // Dans une transaction Firestore, TOUTES les lectures doivent se faire AVANT les écritures.

            // 1.A. Vérifier MON inventaire (Je dois posséder ce que je donne)
            const myGiveOps: { ref: DocumentReference; snap: DocumentSnapshot; card: CardType }[] = [];
            
            for (const card of myCardsToGive) {
                const ref = getRef(user.uid, 'collection', card.id);
                const snap = await transaction.get(ref);
                
                if (!snap.exists()) {
                    throw new Error(`Annulé : Vous ne possédez pas (ou plus) la carte "${card.name}".`);
                }
                
                const currentQty = snap.data()?.quantity || 0;
                if (currentQty < card.quantity) {
                    throw new Error(`Annulé : Stock insuffisant pour "${card.name}" (Requis: ${card.quantity}, Dispo: ${currentQty}).`);
                }
                
                myGiveOps.push({ ref, snap, card });
            }

            // 1.B. Vérifier inventaire PARTENAIRE (Si échange entre utilisateurs)
            const partnerGiveOps: { ref: DocumentReference; snap: DocumentSnapshot; card: CardType }[] = [];
            
            if (partnerUid) {
                for (const card of cardsToReceive) {
                    const ref = getRef(partnerUid, 'collection', card.id);
                    const snap = await transaction.get(ref);

                    if (!snap.exists()) {
                        throw new Error(`Annulé : Le partenaire ne possède plus "${card.name}".`);
                    }
                    
                    const currentQty = snap.data()?.quantity || 0;
                    if (currentQty < card.quantity) {
                         throw new Error(`Annulé : Stock partenaire insuffisant pour "${card.name}".`);
                    }

                    partnerGiveOps.push({ ref, snap, card });
                }
            }

            // 1.C. Préparer les lectures pour les RÉCEPTIONS (Pour savoir si on update ou create)
            // MOI je reçois
            const myReceiveOps = [];
            for (const card of cardsToReceive) {
                const colRef = getRef(user.uid, 'collection', card.id);
                const wishRef = getRef(user.uid, 'wishlist', card.id);
                // On lit les deux potentiels (Collection pour update, Wishlist pour delete)
                const colSnap = await transaction.get(colRef);
                const wishSnap = await transaction.get(wishRef);
                myReceiveOps.push({ colRef, wishRef, colSnap, wishSnap, card });
            }

            // PARTENAIRE reçoit (ce que je donne)
            const partnerReceiveOps = [];
            if (partnerUid) {
                for (const card of myCardsToGive) {
                    const colRef = getRef(partnerUid, 'collection', card.id);
                    const wishRef = getRef(partnerUid, 'wishlist', card.id);
                    const colSnap = await transaction.get(colRef);
                    const wishSnap = await transaction.get(wishRef);
                    partnerReceiveOps.push({ colRef, wishRef, colSnap, wishSnap, card });
                }
            }

            // --- ÉTAPE 2 : ÉCRITURES (WRITES) ---
            
            // 2.A. MOI : Je donne (Décrémenter ou Supprimer)
            for (const { ref, snap, card } of myGiveOps) {
                const currentQty = snap.data()?.quantity || 0;
                // Si stock exact, on supprime le document
                if (currentQty === card.quantity) {
                    transaction.delete(ref);
                } else {
                    transaction.update(ref, { quantity: increment(-card.quantity) });
                }
            }

            // 2.B. PARTENAIRE : Il donne (Décrémenter ou Supprimer)
            if (partnerUid) {
                for (const { ref, snap, card } of partnerGiveOps) {
                    const currentQty = snap.data()?.quantity || 0;
                    if (currentQty === card.quantity) {
                        transaction.delete(ref);
                    } else {
                        transaction.update(ref, { quantity: increment(-card.quantity) });
                    }
                }
            }

            // 2.C. MOI : Je reçois (Incrémenter ou Créer + Nettoyer Wishlist)
            for (const { colRef, wishRef, colSnap, wishSnap, card } of myReceiveOps) {
                if (colSnap.exists()) {
                    transaction.update(colRef, { quantity: increment(card.quantity) });
                } else {
                    // C'est ici qu'on utilise le Helper pour être sûr des données insérées
                    transaction.set(colRef, createCardData(card));
                }
                
                // Si la carte était dans ma wishlist, je l'enlève !
                if (wishSnap.exists()) {
                    transaction.delete(wishRef);
                }
            }

            // 2.D. PARTENAIRE : Il reçoit (Incrémenter ou Créer + Nettoyer Wishlist)
            if (partnerUid) {
                for (const { colRef, wishRef, colSnap, wishSnap, card } of partnerReceiveOps) {
                    if (colSnap.exists()) {
                        transaction.update(colRef, { quantity: increment(card.quantity) });
                    } else {
                        transaction.set(colRef, createCardData(card));
                    }
                    
                    if (wishSnap.exists()) {
                        transaction.delete(wishRef);
                    }
                }
            }
        });

        toast.success("Échange validé avec succès !", { id: toastId });
        return true;

    } catch (error: unknown) {
        console.error("Erreur Transaction:", error);
        // Gestion propre de l'erreur pour l'utilisateur
        const errMsg = error instanceof Error ? error.message : "Erreur inconnue lors de l'échange";
        toast.error(errMsg, { id: toastId, duration: 5000 });
        return false;
    } finally {
        setIsProcessing(false);
    }
  };

  return { executeTrade, isProcessing };
}