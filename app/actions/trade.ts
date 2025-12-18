// app/actions/trade.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, DocumentData } from 'firebase-admin/firestore';
import { CardType } from '@/hooks/useCardCollection';
import { z } from 'zod';
import { CardSchema } from '@/lib/validators';

// Schéma de validation pour l'action serveur
const TradeActionSchema = z.object({
    tradeId: z.string().min(1),
    senderUid: z.string().min(1),
    receiverUid: z.string().min(1),
    itemsGiven: z.array(CardSchema),
    itemsReceived: z.array(CardSchema)
});

const ManualTradeSchema = z.object({
    userId: z.string().min(1),
    itemsGiven: z.array(CardSchema),
    itemsReceived: z.array(CardSchema)
});

// Helper pour extraire les données SÛRES depuis la DB (Source of Truth)
// On ignore les données cosmétiques envoyées par le client pour éviter le spoofing
const createSafeCardDataFromSnapshot = (snapData: DocumentData, quantityToTransfer: number) => {
    return {
        name: snapData.name,
        imageUrl: snapData.imageUrl,
        imageBackUrl: snapData.imageBackUrl || null,
        setName: snapData.setName || '',
        setCode: snapData.setCode || '',
        price: snapData.price || 0,
        // On utilise la quantité transférée, pas celle du snapshot original
        quantity: quantityToTransfer,
        isFoil: snapData.isFoil || false,
        isSpecificVersion: snapData.isSpecificVersion || false,
        scryfallData: snapData.scryfallData || null,
        
        // Champs système remis à neuf pour le nouveau propriétaire
        addedAt: FieldValue.serverTimestamp(),
        wishlistId: null,
        isForTrade: false,
        quantityForTrade: 0,
        customPrice: null, // On reset le prix custom lors d'un échange
        purchasePrice: null
    };
};

// Helper pour créer une carte lors d'un import externe (Manual Trade - Réception)
// Ici on est obligé de faire confiance au client car la carte n'existe pas encore dans le système,
// mais c'est moins grave car c'est un ajout manuel unilatéral.
const createCardDataFromInput = (card: CardType) => {
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
        isForTrade: false,
        quantityForTrade: 0
    };
};

// --- ACTION 1 : ÉCHANGE P2P AVEC VALIDATION STATUS ---
export async function executeServerTrade(
    tradeId: string,
    senderUid: string,
    receiverUid: string,
    itemsGiven: CardType[],
    itemsReceived: CardType[]
) {
    const db = getAdminFirestore();

    // 1. Validation Runtime des entrées
    const validation = TradeActionSchema.safeParse({ 
        tradeId, senderUid, receiverUid, itemsGiven, itemsReceived 
    });

    if (!validation.success) {
        return { success: false, error: "Données d'échange invalides." };
    }

    try {
        await db.runTransaction(async (t) => {
            // PHASE 1 : TOUTES LES LECTURES
            
            // A. Vérifier que l'échange est toujours 'pending'
            const tradeRef = db.doc(`trades/${tradeId}`);
            const tradeSnap = await t.get(tradeRef);
            if (!tradeSnap.exists) throw new Error("Échange introuvable");
            if (tradeSnap.data()?.status !== 'pending') throw new Error("Cet échange n'est plus en attente.");

            // B. Lire les stocks Expéditeur (Source de vérité pour ce que Sender DONNE)
            const senderStockSnaps = [];
            for (const card of itemsGiven) {
                const ref = db.doc(`users/${senderUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                senderStockSnaps.push({ ref, card, snap });
            }

            // C. Lire les stocks Receveur (Source de vérité pour ce que Receiver DONNE)
            const receiverStockSnaps = [];
            for (const card of itemsReceived) {
                const ref = db.doc(`users/${receiverUid}/collection/${card.id}`);
                const snap = await t.get(ref);
                receiverStockSnaps.push({ ref, card, snap });
            }

            // D. Lire les destinations (Vérifier si le destinataire a déjà la carte pour stacker)
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

            // PHASE 2 : VÉRIFICATIONS LOGIQUES
            
            // Création de Maps pour retrouver facilement les données sources
            const senderSourceMap = new Map<string, DocumentData>();
            for (const item of senderStockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) {
                    throw new Error(`L'expéditeur ne possède plus assez de : ${item.card.name}`);
                }
                senderSourceMap.set(item.card.id, item.snap.data()!);
            }

            const receiverSourceMap = new Map<string, DocumentData>();
            for (const item of receiverStockSnaps) {
                if (!item.snap.exists || (item.snap.data()?.quantity || 0) < item.card.quantity) {
                    throw new Error(`Le partenaire ne possède plus assez de : ${item.card.name}`);
                }
                receiverSourceMap.set(item.card.id, item.snap.data()!);
            }

            // PHASE 3 : ÉCRITURES

            // 1. Mise à jour du statut
            t.update(tradeRef, { 
                status: 'completed',
                completedAt: FieldValue.serverTimestamp()
            });

            // 2. SOUSTRACTION DES STOCKS
            for (const item of senderStockSnaps) {
                if (item.snap.data()?.quantity === item.card.quantity) {
                    t.delete(item.ref);
                } else {
                    t.update(item.ref, { 
                        quantity: FieldValue.increment(-item.card.quantity),
                        // On réduit aussi le stock d'échange si nécessaire pour ne pas avoir trade > qty
                        quantityForTrade: FieldValue.increment(-item.card.quantity) 
                    });
                }
            }
            for (const item of receiverStockSnaps) {
                if (item.snap.data()?.quantity === item.card.quantity) {
                    t.delete(item.ref);
                } else {
                    t.update(item.ref, { 
                        quantity: FieldValue.increment(-item.card.quantity),
                        quantityForTrade: FieldValue.increment(-item.card.quantity)
                    });
                }
            }

            // 3. AJOUT CHEZ EXPÉDITEUR (Il reçoit les cartes du Receveur)
            for (const item of senderDestSnaps) {
                // SÉCURITÉ : On utilise les données du receiverSourceMap, pas item.card !
                const sourceData = receiverSourceMap.get(item.card.id);
                if (!sourceData) throw new Error("Erreur intégrité données (Sender Dest)");

                if (item.snap.exists) {
                    t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                } else {
                    t.set(item.ref, createSafeCardDataFromSnapshot(sourceData, item.card.quantity));
                }
                // Nettoyage Wishlist
                const wishRef = db.doc(`users/${senderUid}/wishlist/${item.card.id}`);
                t.delete(wishRef); 
            }

            // 4. AJOUT CHEZ RECEVEUR (Il reçoit les cartes de l'Expéditeur)
            for (const item of receiverDestSnaps) {
                // SÉCURITÉ : On utilise les données du senderSourceMap
                const sourceData = senderSourceMap.get(item.card.id);
                if (!sourceData) throw new Error("Erreur intégrité données (Receiver Dest)");

                if (item.snap.exists) {
                    t.update(item.ref, { quantity: FieldValue.increment(item.card.quantity) });
                } else {
                    t.set(item.ref, createSafeCardDataFromSnapshot(sourceData, item.card.quantity));
                }
                // Nettoyage Wishlist
                const wishRef = db.doc(`users/${receiverUid}/wishlist/${item.card.id}`);
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
    
    const validation = ManualTradeSchema.safeParse({ userId, itemsGiven, itemsReceived });
    if (!validation.success) return { success: false, error: "Données invalides" };

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

            // PHASE 2 : VÉRIFICATIONS & ÉCRITURES
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
                    // Pour un échange manuel, on utilise les données fournies (import externe)
                    t.set(item.ref, createCardDataFromInput(item.card));
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