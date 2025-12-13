// app/actions/trade.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod'; 
import { TradeExecutionSchema, ValidatedCard, CardSchema } from '@/lib/validators';

// Interface stricte des données de carte sérialisables pour le serveur (pour le typage TypeScript des arguments)
interface ServerCardPayload {
    id: string;
    name: string;
    imageUrl: string;
    imageBackUrl: string | null;
    quantity: number;
    price: number;
    customPrice?: number;
    setName: string;
    setCode: string;
    isFoil: boolean;
    isSpecificVersion: boolean;
    scryfallData: Record<string, unknown> | null;
    wishlistId: string | null;
}

// Helper pour préparer la donnée propre pour Firestore (utilise ValidatedCard)
const createCardData = (card: ValidatedCard) => {
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

// --- ACTION 1 : ÉCHANGE P2P SÉCURISÉ ---
export async function executeServerTrade(
    tradeId: string,
    senderUid: string,
    receiverUid: string,
    itemsGivenRaw: ServerCardPayload[], // Type strict ici
    itemsReceivedRaw: ServerCardPayload[] // Type strict ici
) {
    const db = getAdminFirestore();

    try {
        // 1. VALIDATION STRICTE AVEC ZOD
        const validation = TradeExecutionSchema.safeParse({
            tradeId,
            senderUid,
            receiverUid,
            itemsGiven: itemsGivenRaw,
            itemsReceived: itemsReceivedRaw
        });

        if (!validation.success) {
            // Log Zod pour aider au debug
            console.error("Zod Validation Error:", validation.error);
            throw new Error("Données d'échange invalides : " + validation.error.message);
        }

        // Utilisation du type ValidatedCard après la validation Zod
        const itemsGiven = validation.data.itemsGiven as ValidatedCard[]; 
        const itemsReceived = validation.data.itemsReceived as ValidatedCard[];

        await db.runTransaction(async (t) => {
            // PHASE 1 : TOUTES LES LECTURES
            
            const tradeRef = db.doc(`trades/${tradeId}`);
            const tradeSnap = await t.get(tradeRef);
            if (!tradeSnap.exists) throw new Error("Échange introuvable");
            
            const tradeData = tradeSnap.data();
            if (tradeData?.status !== 'pending') {
                throw new Error(`Cet échange n'est plus en attente (Status: ${tradeData?.status}).`);
            }

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

            // 1. Mise à jour du statut de l'échange
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
    itemsGivenRaw: ServerCardPayload[], // Type strict ici
    itemsReceivedRaw: ServerCardPayload[] // Type strict ici
) {
    const db = getAdminFirestore();

    try {
        // Validation stricte : On utilise Zod pour valider les tableaux
        const ItemsSchema = z.array(CardSchema);
        
        const parsedGiven = ItemsSchema.safeParse(itemsGivenRaw);
        const parsedReceived = ItemsSchema.safeParse(itemsReceivedRaw);

        if (!parsedGiven.success || !parsedReceived.success) {
             throw new Error("Données invalides pour l'échange manuel.");
        }

        // Utilisation du type ValidatedCard après la validation Zod
        const itemsGiven = parsedGiven.data as ValidatedCard[];
        const itemsReceived = parsedReceived.data as ValidatedCard[];

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