// app/actions/trade.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CardType } from '@/hooks/useCardCollection';

export async function executeServerTrade(
    senderUid: string,
    receiverUid: string, // On force le string ici, pas de null
    itemsGiven: CardType[],
    itemsReceived: CardType[]
) {
    const db = getAdminFirestore();

    try {
        await db.runTransaction(async (t) => {
            // --- 1. SENDER DONNE (Suppression/Décrémentation) ---
            for (const card of itemsGiven) {
                const ref = db.doc(`users/${senderUid}/collection/${card.id}`);
                const docSnap = await t.get(ref);
                if (!docSnap.exists || (docSnap.data()?.quantity || 0) < card.quantity) {
                    throw new Error(`Erreur: ${card.name} manquante chez l'expéditeur.`);
                }
                // Si quantité exacte, on supprime, sinon on décrémente
                if (docSnap.data()?.quantity === card.quantity) {
                    t.delete(ref);
                } else {
                    t.update(ref, { quantity: FieldValue.increment(-card.quantity) });
                }
            }

            // --- 2. RECEIVER DONNE (Suppression/Décrémentation) ---
            for (const card of itemsReceived) {
                const ref = db.doc(`users/${receiverUid}/collection/${card.id}`);
                const docSnap = await t.get(ref);
                if (!docSnap.exists || (docSnap.data()?.quantity || 0) < card.quantity) {
                    throw new Error(`Erreur: ${card.name} manquante chez le partenaire.`);
                }
                if (docSnap.data()?.quantity === card.quantity) {
                    t.delete(ref);
                } else {
                    t.update(ref, { quantity: FieldValue.increment(-card.quantity) });
                }
            }

            // --- 3. SENDER REÇOIT (Ajout) ---
            for (const card of itemsReceived) {
                const colRef = db.doc(`users/${senderUid}/collection/${card.id}`);
                const wishRef = db.doc(`users/${senderUid}/wishlist/${card.id}`);
                
                // Astuce Admin: set({ ... }, { merge: true }) permet de créer ou update
                // Mais pour incrémenter proprement, on fait un get ou un increment
                // Ici version simple : Set + Increment
                t.set(colRef, { 
                    name: card.name,
                    imageUrl: card.imageUrl,
                    setName: card.setName || '',
                    setCode: card.setCode || '',
                    price: card.price || 0,
                    isFoil: card.isFoil || false,
                    addedAt: FieldValue.serverTimestamp()
                }, { merge: true });
                t.update(colRef, { quantity: FieldValue.increment(card.quantity) });
                
                // Nettoyage wishlist
                t.delete(wishRef);
            }

            // --- 4. RECEIVER REÇOIT (Ajout) ---
            for (const card of itemsGiven) {
                const colRef = db.doc(`users/${receiverUid}/collection/${card.id}`);
                const wishRef = db.doc(`users/${receiverUid}/wishlist/${card.id}`);
                
                t.set(colRef, { 
                    name: card.name,
                    imageUrl: card.imageUrl,
                    setName: card.setName || '',
                    setCode: card.setCode || '',
                    price: card.price || 0,
                    isFoil: card.isFoil || false,
                    addedAt: FieldValue.serverTimestamp()
                }, { merge: true });
                t.update(colRef, { quantity: FieldValue.increment(card.quantity) });
                
                t.delete(wishRef);
            }
        });

        return { success: true };

    } catch (error: unknown) { // 1. On utilise 'unknown' au lieu de 'any'
        console.error("Trade Error:", error);
        
        // 2. On vérifie le type de l'erreur pour extraire le message proprement
        let errorMessage = "Une erreur inconnue est survenue";
        
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === "string") {
            errorMessage = error;
        }

        return { success: false, error: errorMessage };
    }
}