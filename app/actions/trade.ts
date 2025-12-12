// app/actions/trade.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CardType } from '@/hooks/useCardCollection';

const createCardData = (card: CardType) => {
    return {
        name: card.name,
        imageUrl: card.imageUrl,
        imageBackUrl: card.imageBackUrl || null,
        setName: card.setName || '',
        setCode: card.setCode || '',
        price: card.price || 0,
        quantity: card.quantity, 
        isFoil: card.isFoil || false,
        isSpecificVersion: card.isSpecificVersion || false,
        scryfallData: card.scryfallData || null,
        addedAt: FieldValue.serverTimestamp(),
        wishlistId: null,
        isForTrade: false 
    };
};

// --- ACTION 1 : ÉCHANGE P2P AVEC VALIDATION STATUS ---
export async function executeServerTrade(
    tradeId: string, // <-- Nouveau paramètre
    senderUid: string,
    receiverUid: string,
    itemsGiven: CardType[],
    itemsReceived: CardType[]
) {
    const db = getAdminFirestore();

    try {
        await db.runTransaction(async (t) => {
            // PHASE 1 : TOUTES LES LECTURES
            
            // A. Vérifier que l'échange est toujours 'pending'
            const tradeRef = db.doc(`trades/${tradeId}`);
            const tradeSnap = await t.get(tradeRef);
            if (!tradeSnap.exists) throw new Error("Échange introuvable");
            if (tradeSnap.data()?.status !== 'pending') throw new Error("Cet échange n'est plus en attente.");

            // B. Lire les stocks Expéditeur
            const senderStockSnaps = [];
            for (const card of itemsGiven) {
                const ref = db.doc(`users/${senderUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                senderStockSnaps.push({ ref, card, snap });
            }

            // C. Lire les stocks Receveur
            const receiverStockSnaps = [];
            for (const card of itemsReceived) {
                const ref = db.doc(`users/${receiverUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                receiverStockSnaps.push({ ref, card, snap });
            }

            // D. Lire les destinations
            const senderDestSnaps = [];
            for (const card of itemsReceived) {
                const ref = db.doc(`users/${senderUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                senderDestSnaps.push({ ref, card, snap });
            }

            const receiverDestSnaps = [];
            for (const card of itemsGiven) {
                const ref = db.doc(`users/${receiverUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                receiverDestSnaps.push({ ref, card, snap });
            }

            // PHASE 2 : TOUTES LES ÉCRITURES

            // 1. Mise à jour du statut de l'échange (IMPORTANT)
            t.update(tradeRef, { 
                status: 'completed',
                completedAt: FieldValue.serverTimestamp()
            });

            // 2. RETIRER les cartes de l'Expéditeur
            for (const item of senderStockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) {
                    throw new Error(`Erreur: ${item.card.name} manquante chez l'expéditeur.`);
                }
                if (item.snap.data()?.quantity === item.card.quantity) {
                    t.delete(item.ref);
                } else {
                    t.update(item.ref, { quantity: FieldValue.increment(-item.card.quantity) });
                }
            }

            // 3. RETIRER les cartes du Receveur
            for (const item of receiverStockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) {
                    throw new Error(`Erreur: ${item.card.name} manquante chez le partenaire.`);
                }
                if (item.snap.data()?.quantity === item.card.quantity) {
                    t.delete(item.ref);
                } else {
                    t.update(item.ref, { quantity: FieldValue.increment(-item.card.quantity) });
                }
            }

            // 4. AJOUTER chez l'Expéditeur + Clean Wishlist
            for (const item of senderDestSnaps) {
                const wishRef = db.doc(`users/${senderUid}/wishlist/${item.card.id}`);
                if (item.snap.exists) {
                    t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                } else {
                    t.set(item.ref, createCardData(item.card));
                }
                t.delete(wishRef); 
            }

            // 5. AJOUTER chez le Receveur + Clean Wishlist
            for (const item of receiverDestSnaps) {
                const wishRef = db.doc(`users/${receiverUid}/wishlist/${item.card.id}`);
                if (item.snap.exists) {
                    t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                } else {
                    t.set(item.ref, createCardData(item.card));
                }
                t.delete(wishRef);
            }
        });

        return { success: true };

    } catch (error: unknown) {
        console.error("Trade Error:", error);
        let errorMessage = "Une erreur inconnue est survenue";
        if (error instanceof Error) errorMessage = error.message;
        else if (typeof error === "string") errorMessage = error;
        return { success: false, error: errorMessage };
    }
}

// --- ACTION 2 : ÉCHANGE MANUEL (SOLO) ---
export async function executeManualTrade(
    userId: string,
    itemsGiven: CardType[],    
    itemsReceived: CardType[]  
) {
    const db = getAdminFirestore();

    try {
        await db.runTransaction(async (t) => {
            // PHASE 1 : LECTURES
            const stockSnaps = [];
            for (const card of itemsGiven) {
                const ref = db.doc(`users/${userId}/collection/${card.id}`);
                const snap = await t.get(ref);
                stockSnaps.push({ ref, card, snap });
            }

            const destSnaps = [];
            for (const card of itemsReceived) {
                const ref = db.doc(`users/${userId}/collection/${card.id}`);
                const snap = await t.get(ref);
                destSnaps.push({ ref, card, snap });
            }

            // PHASE 2 : ÉCRITURES
            for (const item of stockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) {
                    throw new Error(`Erreur: Vous ne possédez pas assez de "${item.card.name}".`);
                }
                if (item.snap.data()?.quantity === item.card.quantity) {
                    t.delete(item.ref);
                } else {
                    t.update(item.ref, { quantity: FieldValue.increment(-item.card.quantity) });
                }
            }

            for (const item of destSnaps) {
                const wishRef = db.doc(`users/${userId}/wishlist/${item.card.id}`);
                if (item.snap.exists) {
                    t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                } else {
                    t.set(item.ref, createCardData(item.card));
                }
                t.delete(wishRef);
            }
        });

        return { success: true };

    } catch (error: unknown) {
        console.error("Manual Trade Error:", error);
        let errorMessage = "Erreur lors de l'échange manuel";
        if (error instanceof Error) errorMessage = error.message;
        return { success: false, error: errorMessage };
    }
}