// app/actions/scanner.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { CardType } from '@/hooks/useCardCollection';
import { checkAndConsumeCredits } from '@/lib/limits';

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
    displayName?: unknown;
    username?: unknown;
    photoURL?: unknown;
}

interface FirestoreGroupData {
    members?: unknown;
}

// Typage strict pour les données brutes de la carte Firestore
interface FirestoreCardData {
    name?: unknown;
    imageUrl?: unknown;
    imageBackUrl?: unknown;
    price?: unknown;
    customPrice?: unknown;
    quantityForTrade?: unknown;
    quantity?: unknown;
    setCode?: unknown;
    setName?: unknown;
    isFoil?: unknown;
    isSpecificVersion?: unknown;
    isForTrade?: unknown;
    wishlistId?: unknown;
    scryfallData?: unknown;
    
    lastPriceUpdate?: unknown;
    addedAt?: unknown;
    importedAt?: unknown;
    lastUpdated?: unknown;
    
    [key: string]: unknown;
}

// --- FONCTION DE SÉRIALISATION AVEC VÉRIFICATION DES TYPES ---
const serializeCard = (docId: string, data: FirestoreCardData, forceIsWishlist: boolean): CardType => {
    
    const toDate = (val: unknown): Date | null => {
        if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
            return (val as { toDate: () => Date }).toDate();
        }
        if (val instanceof Date) return val;
        return null;
    };
    
    const isString = (val: unknown): string | undefined => typeof val === 'string' ? val : undefined;
    const isNumber = (val: unknown): number | undefined => typeof val === 'number' ? val : undefined;
    const isBoolean = (val: unknown): boolean => typeof val === 'boolean' ? val : false;

    // Pré-calcul pour éviter les assertions non nulles (!) plus bas
    const rawQuantity = isNumber(data.quantity);
    const rawQuantityForTrade = isNumber(data.quantityForTrade);
    const isForTradeBool = isBoolean(data.isForTrade);

    return {
        id: docId,
        name: isString(data.name) || 'Carte Inconnue',
        imageUrl: isString(data.imageUrl) || '',
        imageBackUrl: isString(data.imageBackUrl) ?? null,
        
        quantity: rawQuantity !== undefined ? rawQuantity : 1,
        price: isNumber(data.price) || 0,
        customPrice: isNumber(data.customPrice),
        
        setName: isString(data.setName) || '',
        setCode: isString(data.setCode) || '',
        
        isFoil: isBoolean(data.isFoil),
        isSpecificVersion: isBoolean(data.isSpecificVersion),
        
        // Logique stricte pour la quantité d'échange sans "any" ni "!"
        quantityForTrade: rawQuantityForTrade !== undefined
            ? rawQuantityForTrade
            : (isForTradeBool && rawQuantity !== undefined ? rawQuantity : 0),
        
        wishlistId: forceIsWishlist ? (isString(data.wishlistId) || 'default') : null,
        
        // On s'assure que c'est un objet Record<string, unknown> si non null
        scryfallData: (typeof data.scryfallData === 'object' && data.scryfallData !== null) 
            ? data.scryfallData as Record<string, unknown> : null,
            
        lastPriceUpdate: toDate(data.lastPriceUpdate)
    };
};

export async function runServerScan(userId: string): Promise<ScannerResult> {
    const db = getAdminFirestore();

    // --- VERIFICATION CREDIT ---
    // On vérifie et consomme le crédit AVANT de lancer les requêtes lourdes
    const creditCheck = await checkAndConsumeCredits(userId, 'TRADE_MATCH');
    if (!creditCheck.allowed) {
        return { success: false, error: creditCheck.error };
    }
    // ---------------------------

    try {
        // 1. Identifier tous les partenaires (Amis + Groupes)
        const partnersMap = new Map<string, ScannedPartnerInfo>();

        // A. Récupérer les Amis
        const friendsSnap = await db.collection(`users/${userId}/friends`).get();
        friendsSnap.forEach(doc => {
            const d = doc.data() as FirestoreUserData;
            partnersMap.set(doc.id, { 
                uid: doc.id, 
                displayName: typeof d.displayName === 'string' ? d.displayName : 'Ami inconnu', 
                photoURL: typeof d.photoURL === 'string' ? d.photoURL : null 
            });
        });

        // B. Récupérer les Groupes
        const groupsSnap = await db.collection('groups').where('members', 'array-contains', userId).get();
        const memberUids = new Set<string>();
        
        groupsSnap.forEach(g => {
            const d = g.data() as FirestoreGroupData;
            const members = Array.isArray(d.members) ? d.members : [];
            members.forEach((m: unknown) => {
                if (typeof m === 'string' && m !== userId && !partnersMap.has(m)) {
                    memberUids.add(m);
                }
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
                        displayName: typeof d.displayName === 'string' ? d.displayName : (typeof d.username === 'string' ? d.username : 'Membre Groupe'),
                        photoURL: typeof d.photoURL === 'string' ? d.photoURL : null 
                    });
                }
            }));
        }

        if (partnersMap.size === 0) return { success: true, proposals: [] };

        // 2. Charger MES données (pour l'ajustement de la quantité reçue)
        const myCollectionSnap = await db.collection(`users/${userId}/collection`).where('quantityForTrade', '>', 0).get();
        const myWishlistSnap = await db.collection(`users/${userId}/wishlist`).get();

        // Indexation de MA Wishlist par Nom -> Quantité désirée
        const myWishlistDetails = new Map<string, { quantity: number, card: CardType }>();
        myWishlistSnap.forEach(d => {
            const card = serializeCard(d.id, d.data() as FirestoreCardData, true);
            if (card.name) {
                myWishlistDetails.set(card.name, {
                    quantity: card.quantity, 
                    card
                });
            }
        });

        // Pour le matching "Je donne"
        const myTradeCards = myCollectionSnap.docs.map(d => serializeCard(d.id, d.data() as FirestoreCardData, false));

        // 3. Scanner chaque partenaire
        const proposals: ScannedProposal[] = [];

        await Promise.all(Array.from(partnersMap.values()).map(async (partner) => {
            // Lecture Collection & Wishlist Partenaire
            const pColSnap = await db.collection(`users/${partner.uid}/collection`).where('quantityForTrade', '>', 0).get();
            const pWishSnap = await db.collection(`users/${partner.uid}/wishlist`).get();

            const pTradeCards = pColSnap.docs.map(d => serializeCard(d.id, d.data() as FirestoreCardData, false));
            
            // Pour la wishlist du partenaire (pour le matching "Je donne")
            const pWishListDetails = new Map<string, { quantity: number, card: CardType }>();
            pWishSnap.forEach(d => {
                const card = serializeCard(d.id, d.data() as FirestoreCardData, true);
                if (card.name) {
                    pWishListDetails.set(card.name, { 
                        quantity: card.quantity, 
                        card
                    });
                }
            });

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // MATCH: Je reçois (Sa collection -> Ma Wishlist)
            pTradeCards.forEach(card => {
                const myWish = myWishlistDetails.get(card.name);
                if (myWish) {
                    
                    const neededQty = myWish.quantity; 
                    const friendTradeQty = card.quantityForTrade; 
                    
                    const finalReceiveQty = Math.min(neededQty, friendTradeQty);

                    if (finalReceiveQty > 0) {
                        const cardToReceive: CardType = { ...card, quantity: finalReceiveQty, quantityForTrade: finalReceiveQty };
                        toReceive.push(cardToReceive);
                    }
                }
            });

            // MATCH: Je donne (Ma collection -> Sa Wishlist)
            myTradeCards.forEach(card => {
                const partnerWish = pWishListDetails.get(card.name);
                if (partnerWish) {
                    
                    const neededQty = partnerWish.quantity; 
                    const myTradeQty = card.quantityForTrade; 

                    const finalGiveQty = Math.min(neededQty, myTradeQty);
                    
                    if (finalGiveQty > 0) {
                        const cardToGive: CardType = { ...card, quantity: finalGiveQty, quantityForTrade: finalGiveQty };
                        toGive.push(cardToGive);
                    }
                }
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