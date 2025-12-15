// app/actions/collection.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateUserStats } from '@/app/actions/stats';
import { checkAutoMatch, removeAutoMatchNotification } from '@/app/actions/matching';
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils'; // Import de la fonction normalisée

// Interfaces
interface ScryfallCollectionResponse {
    data?: ScryfallRawData[];
    not_found?: unknown[];
    warnings?: unknown[];
}

interface FirestoreCardData {
    name?: string;
    quantity?: number;
    quantityForTrade?: number;
    isForTrade?: boolean;
    isFoil?: boolean;
    [key: string]: unknown;
}

// --- ACTUALISATION DES PRIX ET DES DONNÉES (CMC/COULEURS) ---
export async function refreshUserCollectionPrices(userId: string): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    const db = getAdminFirestore();

    try {
        const collectionRef = db.collection(`users/${userId}/collection`);
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
            return { success: true, updatedCount: 0 };
        }

        const cardsToUpdate = snapshot.docs.map(doc => ({ id: doc.id }));
        
        const chunks = [];
        for (let i = 0; i < cardsToUpdate.length; i += 75) {
            chunks.push(cardsToUpdate.slice(i, i + 75));
        }

        let updatedCount = 0;
        let batch = db.batch();
        let operationCounter = 0;

        for (const chunk of chunks) {
            const identifiers = chunk.map(c => ({ id: c.id }));

            const response = await fetch('https://api.scryfall.com/cards/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifiers }),
                cache: 'no-store'
            });

            if (!response.ok) continue;

            const scryData = (await response.json()) as ScryfallCollectionResponse;
            const foundCards = scryData.data || [];

            for (const scryCard of foundCards) {
                // Utilisation de normalizeCardData pour obtenir l'identité couleur correcte
                const normalized = normalizeCardData(scryCard);
                
                const cardRef = collectionRef.doc(scryCard.id);
                
                batch.update(cardRef, {
                    price: normalized.price,
                    customPrice: FieldValue.delete(), 
                    lastPriceUpdate: new Date(),
                    scryfallData: scryCard,
                    // --- ENREGISTREMENT DES NOUVEAUX CHAMPS ---
                    cmc: normalized.cmc,
                    colors: normalized.colors
                });
                
                updatedCount++;
                operationCounter++;

                if (operationCounter >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    operationCounter = 0;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (operationCounter > 0) {
            await batch.commit();
        }

        if (updatedCount > 0) {
            await updateUserStats(userId);
        }

        return { success: true, updatedCount };

    } catch (error: unknown) {
        console.error("Erreur serveur refresh prix:", error);
        let message = "Erreur inconnue lors de la mise a jour";
        if (error instanceof Error) message = error.message;
        return { success: false, updatedCount: 0, error: message };
    }
}

// --- GESTION DE MASSE (TRADE / BINDER) ---
export async function bulkSetTradeStatusAction(
    userId: string, 
    action: 'excess' | 'all' | 'reset', 
    threshold: number = 4
): Promise<{ success: boolean; count: number; error?: string }> {
    const db = getAdminFirestore();

    try {
        const collectionRef = db.collection(`users/${userId}/collection`);
        const snapshot = await collectionRef.get();

        if (snapshot.empty) return { success: true, count: 0 };

        let batch = db.batch();
        let opCount = 0;
        let totalUpdated = 0;
        
        const cardsToScan: { id: string, name: string, isFoil: boolean }[] = [];
        const cardsToRemoveNotif: string[] = [];

        for (const doc of snapshot.docs) {
            const data = doc.data() as FirestoreCardData;
            const quantity = typeof data.quantity === 'number' ? data.quantity : 0;
            const currentTradeQty = typeof data.quantityForTrade === 'number' ? data.quantityForTrade : 0;
            
            let shouldUpdate = false;
            let newTradeQty = 0;

            if (action === 'reset') {
                if (currentTradeQty > 0) {
                    shouldUpdate = true;
                    newTradeQty = 0;
                }
            } 
            else if (action === 'all') {
                if (currentTradeQty !== quantity) {
                    shouldUpdate = true;
                    newTradeQty = quantity;
                }
            } 
            else if (action === 'excess') {
                const tradeableQty = Math.max(0, quantity - threshold);
                if (currentTradeQty !== tradeableQty) {
                    shouldUpdate = true;
                    newTradeQty = tradeableQty;
                }
            }

            if (shouldUpdate) {
                batch.update(doc.ref, { 
                    quantityForTrade: newTradeQty,
                    isForTrade: newTradeQty > 0 
                });
                opCount++;
                totalUpdated++;

                if (newTradeQty > 0) {
                    cardsToScan.push({ 
                        id: doc.id, 
                        name: data.name || '', 
                        isFoil: !!data.isFoil 
                    });
                } else {
                    cardsToRemoveNotif.push(doc.id);
                }

                if (opCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }
        }

        if (opCount > 0) {
            await batch.commit();
        }
            
        if (cardsToScan.length > 0) {
            await checkAutoMatch(userId, cardsToScan.slice(0, 50)); 
        }
        if (cardsToRemoveNotif.length > 0) {
            await removeAutoMatchNotification(userId, cardsToRemoveNotif);
        }

        return { success: true, count: totalUpdated };

    } catch (error: unknown) {
        console.error("Erreur bulk trade:", error);
        let message = "Erreur serveur";
        if (error instanceof Error) message = error.message;
        return { success: false, count: 0, error: message };
    }
}

export async function bulkRemoveCardsAction(userId: string, cardIds: string[]): Promise<{ success: boolean; count: number; error?: string }> {
    const db = getAdminFirestore();
    try {
        let batch = db.batch();
        let opCount = 0;
        
        for (const id of cardIds) {
            const ref = db.doc(`users/${userId}/collection/${id}`);
            batch.delete(ref);
            opCount++;

            if (opCount >= 450) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        if (opCount > 0) {
            await batch.commit();
        }
        
        await removeAutoMatchNotification(userId, cardIds);
        await updateUserStats(userId);

        return { success: true, count: cardIds.length };

    } catch (error: unknown) {
        console.error("Erreur bulk delete:", error);
        let message = "Erreur serveur";
        if (error instanceof Error) message = error.message;
        return { success: false, count: 0, error: message };
    }
}

export async function bulkUpdateAttributeAction(
    userId: string, 
    cardIds: string[], 
    field: string, 
    value: boolean | number
): Promise<{ success: boolean; count: number; error?: string }> {
    const db = getAdminFirestore();
    try {
        if (cardIds.length === 0) return { success: true, count: 0 };

        let batch = db.batch();
        let opCount = 0;
        
        const cardsToScan: { id: string, name: string, isFoil: boolean }[] = [];
        const cardsToRemoveNotif: string[] = [];
        const needsScan = field === 'quantityForTrade' || field === 'isForTrade';

        if (needsScan) {
            const chunkIds = [];
            for (let i = 0; i < cardIds.length; i += 50) {
                chunkIds.push(cardIds.slice(i, i + 50));
            }

            for (const chunk of chunkIds) {
                const refs = chunk.map(id => db.doc(`users/${userId}/collection/${id}`));
                const snaps = await db.getAll(...refs);

                for (const snap of snaps) {
                    if (snap.exists) {
                        const data = snap.data() as FirestoreCardData;
                        const updateData: Record<string, unknown> = { [field]: value };
                        
                        if (field === 'quantityForTrade') {
                            const numValue = value as number;
                            updateData.isForTrade = numValue > 0;
                            if (numValue > 0) cardsToScan.push({ id: snap.id, name: data.name || '', isFoil: !!data.isFoil });
                            else cardsToRemoveNotif.push(snap.id);
                        } 
                        else if (field === 'isForTrade') {
                            const boolValue = value as boolean;
                            const newQty = boolValue ? (data.quantity || 1) : 0;
                            updateData.quantityForTrade = newQty;
                            if (boolValue) cardsToScan.push({ id: snap.id, name: data.name || '', isFoil: !!data.isFoil });
                            else cardsToRemoveNotif.push(snap.id);
                        }

                        batch.update(snap.ref, updateData);
                        opCount++;
                    }
                }
                
                if (opCount >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }
        } else {
            for (const id of cardIds) {
                const ref = db.doc(`users/${userId}/collection/${id}`);
                batch.update(ref, { [field]: value });
                opCount++;

                if (opCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    opCount = 0;
                }
            }
        }

        if (opCount > 0) {
            await batch.commit();
        }

        if (field === 'isFoil') await updateUserStats(userId);
        if (cardsToScan.length > 0) await checkAutoMatch(userId, cardsToScan.slice(0, 50));
        if (cardsToRemoveNotif.length > 0) await removeAutoMatchNotification(userId, cardsToRemoveNotif);

        return { success: true, count: cardIds.length };

    } catch (error: unknown) {
        console.error("Erreur bulk update:", error);
        let message = "Erreur serveur";
        if (error instanceof Error) message = error.message;
        return { success: false, count: 0, error: message };
    }
}