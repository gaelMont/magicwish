// app/actions/trade.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod'; 
import { TradeExecutionSchema, ValidatedCard, CardSchema } from '@/lib/validators';
import { updateUserStats } from '@/app/actions/stats';

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

// C'est ici que la magie opère pour l'historique
const createCardData = (card: ValidatedCard) => {
    // Le prix négocié devient le prix d'achat (purchasePrice)
    // S'il n'y a pas de prix négocié (customPrice), on prend le prix du marché (price)
    const transactionPrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);

    return {
        name: card.name,
        imageUrl: card.imageUrl,
        imageBackUrl: card.imageBackUrl || null,
        setName: card.setName || '',
        setCode: card.setCode || '',
        
        // 1. On garde le prix Scryfall comme référence de valeur
        price: card.price || 0,
        
        // 2. On enregistre le prix de l'échange comme historique d'achat
        purchasePrice: transactionPrice,
        
        // 3. On ne met PAS de customPrice pour l'affichage collection (on veut voir le prix Scryfall par défaut)
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
    tradeId: string,
    senderUid: string,
    receiverUid: string,
    itemsGivenRaw: ServerCardPayload[],
    itemsReceivedRaw: ServerCardPayload[]
) {
    const db = getAdminFirestore();

    try {
        const validation = TradeExecutionSchema.safeParse({
            tradeId,
            senderUid,
            receiverUid,
            itemsGiven: itemsGivenRaw,
            itemsReceived: itemsReceivedRaw
        });

        if (!validation.success) {
            console.error("Zod Validation Error:", validation.error);
            throw new Error("Données d'échange invalides.");
        }

        const itemsGiven = validation.data.itemsGiven as ValidatedCard[]; 
        const itemsReceived = validation.data.itemsReceived as ValidatedCard[];

        await db.runTransaction(async (t) => {
            const tradeRef = db.doc(`trades/${tradeId}`);
            const tradeSnap = await t.get(tradeRef);
            if (!tradeSnap.exists) throw new Error("Échange introuvable");
            
            const tradeData = tradeSnap.data();
            if (tradeData?.status !== 'pending') {
                throw new Error("Cet échange n'est plus en attente.");
            }

            // LECTURES
            const senderStockSnaps = await Promise.all(itemsGiven.map(c => t.get(db.doc(`users/${senderUid}/collection/${c.id}`))));
            const receiverStockSnaps = await Promise.all(itemsReceived.map(c => t.get(db.doc(`users/${receiverUid}/collection/${c.id}`))));
            
            const senderDestSnaps = await Promise.all(itemsReceived.map(c => t.get(db.doc(`users/${senderUid}/collection/${c.id}`))));
            const receiverDestSnaps = await Promise.all(itemsGiven.map(c => t.get(db.doc(`users/${receiverUid}/collection/${c.id}`))));

            // ÉCRITURES
            t.update(tradeRef, { status: 'completed', completedAt: FieldValue.serverTimestamp() });

            // Débit Expéditeur
            itemsGiven.forEach((card, i) => {
                const snap = senderStockSnaps[i];
                if (!snap.exists || (snap.data()?.quantity || 0) < card.quantity) throw new Error(`Stock expéditeur insuffisant: ${card.name}`);
                if (snap.data()?.quantity === card.quantity) t.delete(snap.ref);
                else t.update(snap.ref, { quantity: FieldValue.increment(-card.quantity) });
            });

            // Débit Receveur
            itemsReceived.forEach((card, i) => {
                const snap = receiverStockSnaps[i];
                if (!snap.exists || (snap.data()?.quantity || 0) < card.quantity) throw new Error(`Stock receveur insuffisant: ${card.name}`);
                if (snap.data()?.quantity === card.quantity) t.delete(snap.ref);
                else t.update(snap.ref, { quantity: FieldValue.increment(-card.quantity) });
            });

            // Crédit Expéditeur
            itemsReceived.forEach((card, i) => {
                const snap = senderDestSnaps[i];
                const wishRef = db.doc(`users/${senderUid}/wishlist/${card.id}`);
                
                if (snap.exists) {
                    t.update(snap.ref, { quantity: FieldValue.increment(card.quantity) });
                } else {
                    t.set(snap.ref, createCardData(card));
                }
                t.delete(wishRef);
            });

            // Crédit Receveur
            itemsGiven.forEach((card, i) => {
                const snap = receiverDestSnaps[i];
                const wishRef = db.doc(`users/${receiverUid}/wishlist/${card.id}`);
                
                if (snap.exists) {
                    t.update(snap.ref, { quantity: FieldValue.increment(card.quantity) });
                } else {
                    t.set(snap.ref, createCardData(card));
                }
                t.delete(wishRef);
            });
        });

        Promise.all([updateUserStats(senderUid), updateUserStats(receiverUid)]).catch(console.error);
        return { success: true };

    } catch (error: unknown) {
        console.error("Trade Error:", error);
        let errorMessage = "Une erreur inconnue est survenue";
        if (error instanceof Error) errorMessage = error.message;
        return { success: false, error: errorMessage };
    }
}

// --- ACTION 2 : ÉCHANGE MANUEL (SOLO) ---
export async function executeManualTrade(
    userId: string,
    itemsGivenRaw: ServerCardPayload[], 
    itemsReceivedRaw: ServerCardPayload[] 
) {
    const db = getAdminFirestore();

    try {
        const ItemsSchema = z.array(CardSchema);
        const parsedGiven = ItemsSchema.safeParse(itemsGivenRaw);
        const parsedReceived = ItemsSchema.safeParse(itemsReceivedRaw);

        if (!parsedGiven.success || !parsedReceived.success) throw new Error("Données invalides.");

        const itemsGiven = parsedGiven.data as ValidatedCard[];
        const itemsReceived = parsedReceived.data as ValidatedCard[];

        await db.runTransaction(async (t) => {
            const stockSnaps = await Promise.all(itemsGiven.map(c => t.get(db.doc(`users/${userId}/collection/${c.id}`))));
            const destSnaps = await Promise.all(itemsReceived.map(c => t.get(db.doc(`users/${userId}/collection/${c.id}`))));

            itemsGiven.forEach((card, i) => {
                const snap = stockSnaps[i];
                if (!snap.exists || (snap.data()?.quantity || 0) < card.quantity) throw new Error(`Stock insuffisant: ${card.name}`);
                if (snap.data()?.quantity === card.quantity) t.delete(snap.ref);
                else t.update(snap.ref, { quantity: FieldValue.increment(-card.quantity) });
            });

            itemsReceived.forEach((card, i) => {
                const snap = destSnaps[i];
                const wishRef = db.doc(`users/${userId}/wishlist/${card.id}`);
                
                if (snap.exists) {
                    t.update(snap.ref, { quantity: FieldValue.increment(card.quantity) });
                } else {
                    t.set(snap.ref, createCardData(card));
                }
                t.delete(wishRef);
            });
        });

        updateUserStats(userId).catch(console.error);
        return { success: true };

    } catch (error: unknown) {
        console.error("Manual Trade Error:", error);
        let errorMessage = "Erreur lors de l'échange manuel";
        if (error instanceof Error) errorMessage = error.message;
        return { success: false, error: errorMessage };
    }
}