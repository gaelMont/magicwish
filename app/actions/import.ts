// app/actions/import.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateUserStats } from '@/app/actions/stats';

export type ImportItemInput = {
    scryfallId?: string;
    name: string;
    set: string;
    collectorNumber: string;
    quantity: number;
    isFoil: boolean;
};

interface ScryfallIdentifier {
    id?: string;
    name?: string;
    set?: string;
    collector_number?: string;
}

interface ScryfallCardData {
    id: string;
    name: string;
    set: string;
    set_name: string;
    collector_number: string;
    image_uris?: { normal?: string };
    card_faces?: Array<{
        name: string;
        image_uris?: { normal?: string };
    }>;
    prices?: { eur?: string; usd?: string };
    [key: string]: unknown;
}

interface ScryfallResponse {
    data: ScryfallCardData[];
    not_found?: unknown[];
}

export async function importCardsAction(
    userId: string,
    targetCollection: 'collection' | 'wishlist',
    importMode: 'add' | 'sync',
    items: ImportItemInput[]
): Promise<{ success: boolean; count: number; error?: string }> {
    
    const db = getAdminFirestore();
    const collectionPath = targetCollection === 'wishlist' ? 'wishlist' : 'collection';

    try {
        let processedCount = 0;
        
        const chunks = [];
        for (let i = 0; i < items.length; i += 75) {
            chunks.push(items.slice(i, i + 75));
        }

        let batch = db.batch();
        let opCount = 0;

        for (const chunk of chunks) {
            const scryfallIdsToCheck = chunk.map(i => i.scryfallId).filter(id => !!id) as string[];
            const currentQuantities = new Map<string, number>();
            
            if (importMode === 'sync' && scryfallIdsToCheck.length > 0) {
                const reads = scryfallIdsToCheck.map(id => db.doc(`users/${userId}/${collectionPath}/${id}`).get());
                const snapshots = await Promise.all(reads);
                
                snapshots.forEach(snap => {
                    if (snap.exists) {
                        const data = snap.data();
                        const qty = typeof data?.quantity === 'number' ? data.quantity : 0;
                        currentQuantities.set(snap.id, qty);
                    }
                });
            }

            const identifiers: ScryfallIdentifier[] = chunk.map(item => {
                if (item.scryfallId) return { id: item.scryfallId };
                if (item.set && item.collectorNumber) {
                    return { set: item.set, collector_number: item.collectorNumber };
                }
                return { name: item.name, set: item.set || undefined };
            });

            const response = await fetch('https://api.scryfall.com/cards/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifiers }),
                cache: 'no-store'
            });

            if (!response.ok) continue;

            const scryResult = (await response.json()) as ScryfallResponse;
            const foundCards = scryResult.data || [];

            for (const scryCard of foundCards) {
                const originalItem = chunk.find(item => {
                    if (item.scryfallId && item.scryfallId === scryCard.id) return true;
                    const nameMatch = item.name.toLowerCase().includes(scryCard.name.toLowerCase().split(' // ')[0]);
                    const setMatch = item.set.toLowerCase() === scryCard.set.toLowerCase();
                    const cnMatch = item.collectorNumber === scryCard.collector_number;
                    if (item.set && item.collectorNumber) return setMatch && cnMatch;
                    return nameMatch && setMatch;
                });

                if (originalItem) {
                    const docRef = db.doc(`users/${userId}/${collectionPath}/${scryCard.id}`);
                    
                    let quantityToAdd = 0;

                    if (importMode === 'add') {
                        quantityToAdd = originalItem.quantity;
                    } else {
                        const currentQty = currentQuantities.get(scryCard.id) || 0;
                        const targetQty = originalItem.quantity;

                        if (targetQty > currentQty) {
                            quantityToAdd = targetQty - currentQty;
                        } else {
                            quantityToAdd = 0;
                        }
                    }

                    if (quantityToAdd <= 0) continue;

                    let imageUrl = scryCard.image_uris?.normal;
                    let imageBackUrl: string | null = null;
                    if (scryCard.card_faces && scryCard.card_faces.length > 0) {
                        if (!imageUrl && scryCard.card_faces[0].image_uris) imageUrl = scryCard.card_faces[0].image_uris.normal;
                        if (scryCard.card_faces[1]?.image_uris) imageBackUrl = scryCard.card_faces[1].image_uris.normal || null;
                    }
                    if (!imageUrl) imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

                    const cardData = {
                        name: scryCard.name,
                        imageUrl,
                        imageBackUrl,
                        setName: scryCard.set_name,
                        setCode: scryCard.set,
                        scryfallId: scryCard.id,
                        price: parseFloat(scryCard.prices?.eur || "0"),
                        isFoil: originalItem.isFoil,
                        scryfallData: scryCard,
                        lastPriceUpdate: new Date(),
                        wishlistId: targetCollection === 'wishlist' ? 'default' : null,
                        isSpecificVersion: targetCollection === 'wishlist',
                        quantityForTrade: 0
                        // NOTE: Pas de customPrice ici !
                    };

                    batch.set(docRef, {
                        ...cardData,
                        quantity: FieldValue.increment(quantityToAdd),
                        addedAt: (!currentQuantities.has(scryCard.id)) ? new Date() : undefined
                    }, { merge: true });

                    opCount++;
                    processedCount++;
                }
            }

            if (opCount >= 400) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (opCount > 0) {
            await batch.commit();
        }

        if (targetCollection === 'collection' && processedCount > 0) {
            await updateUserStats(userId);
        }

        return { success: true, count: processedCount };

    } catch (error: unknown) {
        console.error("Erreur Import Serveur:", error);
        let msg = "Erreur serveur";
        if (error instanceof Error) msg = error.message;
        return { success: false, count: 0, error: msg };
    }
}