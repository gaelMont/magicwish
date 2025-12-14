'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type CardAnalysisInput = {
    id: string;
    name: string;
    isFoil: boolean;
};

// 1. SCAN TRADE -> WISHLIST (Notifie l'ami qui cherche)
export async function checkAutoMatch(userId: string, cardsToCheck: CardAnalysisInput[]) {
    const db = getAdminFirestore();

    try {
        const userDoc = await db.doc(`users/${userId}/public_profile/info`).get();
        const userName = userDoc.data()?.displayName || "Un ami";

        const friendsSnap = await db.collection(`users/${userId}/friends`).get();
        const friendIds = friendsSnap.docs.map(d => d.id);

        if (friendIds.length === 0) return { success: true, matches: 0 };

        let matchCount = 0;
        const batch = db.batch();

        await Promise.all(friendIds.map(async (friendId) => {
            const targetCards = cardsToCheck.slice(0, 10); 
            
            for (const card of targetCards) {
                // On cherche dans la wishlist de l'ami
                const wishlistRef = db.collection(`users/${friendId}/wishlist`);
                const nameQuery = wishlistRef.where('name', '==', card.name).limit(1);
                
                const snap = await nameQuery.get();

                if (!snap.empty) {
                    matchCount++;

                    // Notification pour l'AMI
                    const notifRefFriend = db.collection(`users/${friendId}/notifications`).doc();
                    batch.set(notifRefFriend, {
                        type: 'match_found',
                        title: "Nouvelle opportunité !",
                        message: `${userName} propose une carte de votre wishlist : ${card.name}`,
                        link: `/trades/new/${userId}`,
                        read: false,
                        createdAt: FieldValue.serverTimestamp(),
                        relatedCardOwner: userId,
                        relatedCardId: card.id 
                    });
                }
            }
        }));

        if (matchCount > 0) {
            await batch.commit();
        }

        return { success: true, matches: matchCount };

    } catch (error) {
        console.error("Erreur AutoMatch:", error);
        return { success: false, error: "Erreur analyse" };
    }
}

// 2. SCAN WISHLIST -> TRADE (Me notifie si un ami a la carte)
export async function checkWishlistMatch(userId: string, cardsLookingFor: CardAnalysisInput[]) {
    const db = getAdminFirestore();

    try {
        const friendsSnap = await db.collection(`users/${userId}/friends`).get();
        const friendIds = friendsSnap.docs.map(d => d.id);

        if (friendIds.length === 0) return { success: true, matches: 0 };

        let matchCount = 0;
        const batch = db.batch();

        await Promise.all(friendIds.map(async (friendId) => {
            
            const friendProfile = await db.doc(`users/${friendId}/public_profile/info`).get();
            const friendName = friendProfile.data()?.displayName || "Un ami";

            const targetCards = cardsLookingFor.slice(0, 10);

            for (const card of targetCards) {
                // On cherche dans la collection de l'ami par nom
                const colRef = db.collection(`users/${friendId}/collection`);
                const q = colRef.where('name', '==', card.name).limit(1);
                
                const snap = await q.get();

                if (!snap.empty) {
                    const friendCardData = snap.docs[0].data();
                    const tradeQty = friendCardData.quantityForTrade || 0;

                    // Si l'ami a la carte EN TRADE
                    if (tradeQty > 0) {
                        matchCount++;

                        // Notification pour MOI
                        const notifRefMe = db.collection(`users/${userId}/notifications`).doc();
                        batch.set(notifRefMe, {
                            type: 'match_found',
                            title: "Carte trouvée !",
                            message: `${friendName} possède "${card.name}" à l'échange !`,
                            link: `/trades/new/${friendId}`,
                            read: false,
                            createdAt: FieldValue.serverTimestamp(),
                            relatedCardOwner: friendId,
                            relatedCardId: snap.docs[0].id
                        });
                    }
                }
            }
        }));

        if (matchCount > 0) {
            await batch.commit();
        }

        return { success: true, matches: matchCount };

    } catch (error) {
        console.error("Erreur WishlistMatch:", error);
        return { success: false, error: "Erreur scan" };
    }
}

// 3. NETTOYAGE DES NOTIFICATIONS (Si carte plus dispo)
export async function removeAutoMatchNotification(userId: string, cardIdsToRemove: string[]) {
    const db = getAdminFirestore();

    try {
        const friendsSnap = await db.collection(`users/${userId}/friends`).get();
        const friendIds = friendsSnap.docs.map(d => d.id);

        if (friendIds.length === 0 || cardIdsToRemove.length === 0) return { success: true };

        const batch = db.batch();
        let deletedCount = 0;

        await Promise.all(friendIds.map(async (friendId) => {
            const notifRef = db.collection(`users/${friendId}/notifications`);
            
            // On cherche les notifs qui viennent de MOI (userId) et concernent CES cartes
            const safeIds = cardIdsToRemove.slice(0, 10); 

            const q = notifRef
                .where('relatedCardOwner', '==', userId)
                .where('relatedCardId', 'in', safeIds);

            const snap = await q.get();
            
            snap.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });
        }));

        if (deletedCount > 0) {
            await batch.commit();
        }

        return { success: true };

    } catch (error) {
        console.error("Erreur nettoyage notifs:", error);
        return { success: false };
    }
}