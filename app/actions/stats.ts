'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';

export async function updateUserStats(userId: string) {
    const db = getAdminFirestore();
    
    try {
        const collectionRef = db.collection(`users/${userId}/collection`);
        const snapshot = await collectionRef.get();

        let totalValue = 0;
        let totalCards = 0;
        let foilCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const qty = (typeof data.quantity === 'number') ? data.quantity : 0;
            
            // Gestion sécurisée des prix (priorité au customPrice)
            let price = 0;
            if (typeof data.customPrice === 'number') {
                price = data.customPrice;
            } else if (typeof data.price === 'number') {
                price = data.price;
            }
            
            totalValue += price * qty;
            totalCards += qty;
            if (data.isFoil === true) foilCount += qty;
        });

        const uniqueCards = snapshot.size;
        const avgPrice = totalCards > 0 ? totalValue / totalCards : 0;

        // Sauvegarde dans un document léger dédié à la lecture rapide
        await db.doc(`users/${userId}/public_profile/stats`).set({
            totalValue,
            totalCards,
            uniqueCards,
            foilCount,
            avgPrice,
            lastUpdated: new Date()
        }, { merge: true });

        return { success: true };

    } catch (error) {
        console.error("Erreur update stats:", error);
        return { success: false, error: "Echec du calcul des statistiques" };
    }
}