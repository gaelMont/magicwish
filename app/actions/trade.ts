'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod'; 
import { TradeExecutionSchema, ValidatedCard, CardSchema } from '@/lib/validators';
import { updateUserStats } from '@/app/actions/stats'; // <--- IMPORT

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

// --- ACTION 1 : ÉCHANGE P2P ---
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

            const senderStockSnaps = [];
            for (const card of itemsGiven) {
                const ref = db.doc(`users/${senderUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                senderStockSnaps.push({ ref, card, snap });
            }

            const receiverStockSnaps = [];
            for (const card of itemsReceived) {
                const ref = db.doc(`users/${receiverUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                receiverStockSnaps.push({ ref, card, snap });
            }

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

            t.update(tradeRef, { status: 'completed', completedAt: FieldValue.serverTimestamp() });

            for (const item of senderStockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) throw new Error(`Erreur stock expéditeur: ${item.card.name}`);
                if (item.snap.data()?.quantity === item.card.quantity) t.delete(item.ref);
                else t.update(item.ref, { quantity: FieldValue.increment(-item.card.quantity) });
            }

            for (const item of receiverStockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) throw new Error(`Erreur stock receveur: ${item.card.name}`);
                if (item.snap.data()?.quantity === item.card.quantity) t.delete(item.ref);
                else t.update(item.ref, { quantity: FieldValue.increment(-item.card.quantity) });
            }

            for (const item of senderDestSnaps) {
                const wishRef = db.doc(`users/${senderUid}/wishlist/${item.card.id}`);
                if (item.snap.exists) t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                else t.set(item.ref, createCardData(item.card));
                t.delete(wishRef); 
            }

            for (const item of receiverDestSnaps) {
                const wishRef = db.doc(`users/${receiverUid}/wishlist/${item.card.id}`);
                if (item.snap.exists) t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                else t.set(item.ref, createCardData(item.card));
                t.delete(wishRef);
            }
        });

        // --- OPTIMISATION : Mise à jour asynchrone des stats ---
        Promise.all([updateUserStats(senderUid), updateUserStats(receiverUid)]).catch(err => console.error("Stats update failed", err));

        return { success: true };

    } catch (error: unknown) {
        console.error("Trade Error:", error);
        let errorMessage = "Une erreur inconnue est survenue";
        if (error instanceof Error) errorMessage = error.message;
        return { success: false, error: errorMessage };
    }
}

// --- ACTION 2 : ÉCHANGE MANUEL ---
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

            for (const item of stockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) throw new Error(`Stock insuffisant: ${item.card.name}`);
                if (item.snap.data()?.quantity === item.card.quantity) t.delete(item.ref);
                else t.update(item.ref, { quantity: FieldValue.increment(-item.card.quantity) });
            }

            for (const item of destSnaps) {
                const wishRef = db.doc(`users/${userId}/wishlist/${item.card.id}`);
                if (item.snap.exists) t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                else t.set(item.ref, createCardData(item.card));
                t.delete(wishRef);
            }
        });

        // --- OPTIMISATION : Mise à jour stats ---
        updateUserStats(userId).catch(err => console.error("Stats update failed", err));

        return { success: true };

    } catch (error: unknown) {
        console.error("Manual Trade Error:", error);
        let errorMessage = "Erreur lors de l'échange manuel";
        if (error instanceof Error) errorMessage = error.message;
        return { success: false, error: errorMessage };
    }
}