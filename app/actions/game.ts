// app/actions/game.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateUserStats } from '@/app/actions/stats';

// Définition stricte des données pour un joueur dans une partie
interface PlayerResult {
    uid: string;
    displayName: string;
    finalLife: number;
    isWinner: boolean;
    commanderNames: string[]; // Noms des commandants
    deckName: string;         // Nom du deck utilisé (si enregistré)
    startLife: number;
}

// CORRECTION : Élargissement du type GameFormat
// Ajout des formats Standard, Commander, Modern, Pauper, Legacy, DuelCommander
export type GameFormat = 'Commander' | 'Standard' | 'Modern' | 'Pauper' | 'Legacy' | 'DuelCommander' | 'Other';

// Schéma de l'enregistrement de partie
interface GameData {
    format: GameFormat; // Utilisation du type élargi
    players: PlayerResult[];
    winnerUid: string;
    durationMinutes: number; // Optionnel
}

type ActionResponse = {
    success: boolean;
    error?: string;
    id?: string;
};

export async function recordGameAction(data: GameData): Promise<ActionResponse> {
    const db = getAdminFirestore();

    try {
        // 1. Validation basique (s'assurer qu'il y a un gagnant et des joueurs)
        if (data.players.filter(p => p.isWinner).length !== 1) {
            throw new Error("Une partie doit avoir exactement un gagnant.");
        }
        if (data.players.length < 2) {
            throw new Error("Une partie nécessite au moins deux joueurs.");
        }

        // 2. Enregistrement de la partie
        const gameRef = await db.collection('games').add({
            ...data,
            createdAt: FieldValue.serverTimestamp()
        });

        // 3. Mise à jour des statistiques individuelles des joueurs (Background)
        data.players.forEach(player => {
            updateUserStats(player.uid).catch(console.error);
        });

        return { success: true, id: gameRef.id };

    } catch (error: unknown) {
        console.error("Erreur recordGameAction:", error);
        let message = "Erreur serveur";
        if (error instanceof Error) message = error.message;
        return { success: false, error: message };
    }
}