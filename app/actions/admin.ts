// app/actions/admin.ts
'use server';

import { getAdminAuth } from '@/lib/firebase-admin';
import { refreshUserCollectionPrices } from '@/app/actions/collection';

export async function forceUpdateAllUsersCardsAction() {
    const auth = getAdminAuth();

    try {
        console.log("Démarrage de la mise à jour globale via Auth...");
        
        let successCount = 0;
        let failCount = 0;
        let pageToken: string | undefined = undefined;
        let totalUsersFound = 0;

        do {
            const listUsersResult = await auth.listUsers(1000, pageToken);
            const users = listUsersResult.users;
            totalUsersFound += users.length;
            
            console.log(`Traitement d'un lot de ${users.length} utilisateurs...`);

            for (const userRecord of users) {
                const uid = userRecord.uid;
                try {
                    await refreshUserCollectionPrices(uid);
                    successCount++;
                } catch (e) {
                    console.error(`Erreur update user ${uid}:`, e);
                    failCount++;
                }
            }

            pageToken = listUsersResult.pageToken;
        } while (pageToken);

        return { 
            success: true, 
            message: `Terminé ! ${successCount}/${totalUsersFound} utilisateurs mis à jour. ${failCount} échecs.` 
        };

    } catch (e) {
        console.error("Erreur critique update all:", e);
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        return { success: false, error: msg };
    }
}