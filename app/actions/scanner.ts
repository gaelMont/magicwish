// app/actions/scanner.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { CardType } from '@/hooks/useCardCollection';
import { Timestamp } from 'firebase-admin/firestore';

// Définition stricte des types de retour
export type ScannedPartnerInfo = {
    uid: string;
    displayName: string;
    photoURL: string | null;
};

export type ScannedProposal = {
    partnerInfo: ScannedPartnerInfo;
    toGive: CardType[];
    toReceive: CardType[];
    balance: number;
};

export type ScannerResult = {
    success: boolean;
    proposals?: ScannedProposal[];
    error?: string;
};

// Interfaces internes Firestore
interface FirestoreUserData {
    displayName?: string;
    username?: string;
    photoURL?: string;
}

interface FirestoreGroupData {
    members?: string[];
}

interface FirestoreCardData {
    name?: string;
    imageUrl?: string;
    imageBackUrl?: string;
    price?: number;
    customPrice?: number;
    quantityForTrade?: number;
    quantity?: number;
    setCode?: string;
    setName?: string;
    isFoil?: boolean;
    isSpecificVersion?: boolean;
    isForTrade?: boolean;
    wishlistId?: string;
    scryfallData?: Record<string, unknown>;
    
    lastPriceUpdate?: Timestamp | Date | null;
    addedAt?: Timestamp | Date | null;
    importedAt?: Timestamp | Date | null;
    lastUpdated?: Timestamp | Date | null;
    
    [key: string]: unknown;
}

// --- ON GARDE CETTE FONCTION VITALE ---
const serializeCard = (docId: string, data: FirestoreCardData, forceIsWishlist: boolean): CardType => {
    
    const toDate = (val: unknown): Date | undefined => {
        if (val instanceof Timestamp) return val.toDate();
        if (val instanceof Date) return val;
        return undefined;
    };

    return {
        id: docId,
        name: (data.name as string) || 'Carte Inconnue',
        imageUrl: (data.imageUrl as string) || '',
        imageBackUrl: (data.imageBackUrl as string) ?? null,
        
        quantity: typeof data.quantity === 'number' ? data.quantity : 1,
        price: typeof data.price === 'number' ? data.price : 0,
        customPrice: typeof data.customPrice === 'number' ? data.customPrice : undefined,
        
        setName: (data.setName as string) || '',
        setCode: (data.setCode as string) || '',
        
        isFoil: !!data.isFoil,
        isSpecificVersion: !!data.isSpecificVersion,
        
        quantityForTrade: typeof data.quantityForTrade === 'number' 
            ? data.quantityForTrade 
            : (data.isForTrade === true ? (typeof data.quantity === 'number' ? data.quantity : 1) : 0),
        
        wishlistId: forceIsWishlist ? (data.wishlistId || 'default') : undefined,
        scryfallData: (data.scryfallData as Record<string, unknown>) || undefined,
        lastPriceUpdate: toDate(data.lastPriceUpdate) || null
    };
};

export async function runServerScan(userId: string): Promise<ScannerResult> {
    const db = getAdminFirestore();

    try {
        // 1. Identifier tous les partenaires (Amis + Groupes)
        const partnersMap = new Map<string, ScannedPartnerInfo>();

        // A. Récupérer les Amis
        const friendsSnap = await db.collection(`users/${userId}/friends`).get();
        friendsSnap.forEach(doc => {
            const d = doc.data() as FirestoreUserData;
            partnersMap.set(doc.id, { 
                uid: doc.id, 
                displayName: d.displayName || 'Ami inconnu', 
                photoURL: d.photoURL || null 
            });
        });

        // B. Récupérer les Groupes
        const groupsSnap = await db.collection('groups').where('members', 'array-contains', userId).get();
        const memberUids = new Set<string>();
        
        groupsSnap.forEach(g => {
            const d = g.data() as FirestoreGroupData;
            const members = d.members || [];
            members.forEach((m: string) => {
                if (m !== userId && !partnersMap.has(m)) memberUids.add(m);
            });
        });

        // C. Récupérer les infos des inconnus du groupe
        if (memberUids.size > 0) {
            const unknownUids = Array.from(memberUids);
            await Promise.all(unknownUids.map(async (uid) => {
                const p = await db.doc(`users/${uid}/public_profile/info`).get();
                if (p.exists) {
                    const d = p.data() as FirestoreUserData;
                    partnersMap.set(uid, { 
                        uid, 
                        displayName: d.displayName || d.username || 'Membre Groupe', 
                        photoURL: d.photoURL || null 
                    });
                }
            }));
        }

        if (partnersMap.size === 0) return { success: true, proposals: [] };

        // 2. Charger MES données
        const myCollectionSnap = await db.collection(`users/${userId}/collection`).where('quantityForTrade', '>', 0).get();
        const myWishlistSnap = await db.collection(`users/${userId}/wishlist`).get();

        // Note: myTradeCards n'est plus utilisé ici pour le matching "give", on utilise myWishlistNames pour "receive"
        // On optimise en ne chargeant que ce dont on a besoin.
        
        const myWishlistNames = new Set<string>();
        myWishlistSnap.forEach(d => {
            const data = d.data() as FirestoreCardData;
            if (data.name) myWishlistNames.add(data.name);
        });

        // Pour le matching "Je donne", on a besoin de mes cartes à l'échange
        const myTradeCards = myCollectionSnap.docs.map(d => serializeCard(d.id, d.data() as FirestoreCardData, false));

        // 3. Scanner chaque partenaire
        const proposals: ScannedProposal[] = [];

        await Promise.all(Array.from(partnersMap.values()).map(async (partner) => {
            // Lecture Collection & Wishlist Partenaire
            const pColSnap = await db.collection(`users/${partner.uid}/collection`).where('quantityForTrade', '>', 0).get();
            const pWishSnap = await db.collection(`users/${partner.uid}/wishlist`).get();

            const pTradeCards = pColSnap.docs.map(d => serializeCard(d.id, d.data() as FirestoreCardData, false));
            
            // Pour la wishlist du partenaire, on a juste besoin des noms pour le matching
            const pWishListNames = new Set<string>();
            pWishSnap.forEach(d => {
                const data = d.data() as FirestoreCardData;
                if (data.name) pWishListNames.add(data.name);
            });

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // MATCH: Je reçois (Sa collection -> Ma Wishlist)
            pTradeCards.forEach(card => {
                if (myWishlistNames.has(card.name)) toReceive.push(card);
            });

            // MATCH: Je donne (Ma collection -> Sa Wishlist)
            myTradeCards.forEach(card => {
                if (pWishListNames.has(card.name)) toGive.push(card);
            });

            if (toReceive.length > 0 || toGive.length > 0) {
                const valReceive = toReceive.reduce((acc, c) => acc + (c.price || 0) * (c.quantityForTrade || 1), 0);
                const valGive = toGive.reduce((acc, c) => acc + (c.price || 0) * (c.quantityForTrade || 1), 0);

                proposals.push({
                    partnerInfo: partner,
                    toReceive,
                    toGive,
                    balance: valGive - valReceive
                });
            }
        }));

        return { 
            success: true, 
            proposals: proposals.sort((a, b) => b.balance - a.balance)
        };

    } catch (error: unknown) {
        console.error("Erreur Scan Serveur:", error);
        let message = "Erreur serveur inconnue";
        if (error instanceof Error) message = error.message;
        else if (typeof error === "string") message = error;
        
        return { success: false, error: message };
    }
}