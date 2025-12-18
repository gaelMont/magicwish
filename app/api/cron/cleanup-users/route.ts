// app/api/cron/cleanup-users/route.ts
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import type { UserRecord } from 'firebase-admin/auth'; // Import du type pour corriger l'erreur 'any'

// Pour empecher le cache sur cette route
export const dynamic = 'force-dynamic';

interface DeleteResult {
    uid: string;
    success: boolean;
    error?: string;
}

export async function GET(request: Request) {
    // SECURITE : Verification du header d'autorisation
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    // INITIALISATION DES INSTANCES ADMIN
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    try {
        console.log("Demarrage du nettoyage des comptes inactifs...");
        
        // 1. Definir la date limite (il y a 30 jours)
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const cutoffDate = now - THIRTY_DAYS_MS;

        // 2. Recuperer les utilisateurs (par lots de 1000)
        const listUsersResult = await auth.listUsers(1000);
        
        // Typage explicite de 'user' ici pour éviter l'erreur "implicitly has an 'any' type"
        const usersToDelete = listUsersResult.users.filter((user: UserRecord) => {
            if (!user.metadata.creationTime) return false;
            const creationTime = new Date(user.metadata.creationTime).getTime();
            
            // Condition : Email NON verifie ET Compte cree AVANT la date limite
            return !user.emailVerified && creationTime < cutoffDate;
        });

        console.log(`Utilisateurs trouves a supprimer : ${usersToDelete.length}`);

        // 3. Supprimer les utilisateurs identifies
        const results: DeleteResult[] = [];

        // On traite les suppressions en parallele
        await Promise.all(usersToDelete.map(async (user: UserRecord) => {
            try {
                // A. Supprimer de l'Authentication
                await auth.deleteUser(user.uid);

                // B. Supprimer le document User racine dans Firestore
                await db.collection('users').doc(user.uid).delete();

                // Note : Firestore ne supprime pas les sous-collections automatiquement.
                // Il faudrait un script recursif pour nettoyer parfaitement, 
                // mais supprimer le parent suffit pour invalider le compte.
                
                results.push({ uid: user.uid, success: true });
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`Erreur suppression user ${user.uid}:`, errorMessage);
                results.push({ uid: user.uid, success: false, error: errorMessage });
            }
        }));

        console.log("Nettoyage termine.");

        return NextResponse.json({
            success: true,
            message: "Nettoyage termine.",
            countDeleted: results.filter(r => r.success).length,
            details: results
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Erreur critique Cron:", errorMessage);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}