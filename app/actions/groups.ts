// app/actions/groups.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// --- TYPES & SCHÉMAS ---

type ActionResponse = {
    success: boolean;
    error?: string;
    id?: string;
};

// Interface pour typer les données brutes de Firestore
interface FirestoreGroup {
    name: string;
    ownerUid: string;
    members: string[];
    admins: string[];
    createdAt?: unknown;
}

// Schémas de validation Zod
const createGroupSchema = z.object({
    userId: z.string().min(1, "ID utilisateur invalide"),
    groupName: z.string().min(3, "Le nom du groupe doit contenir au moins 3 caractères").max(50, "Le nom du groupe est trop long"),
});

const memberActionSchema = z.object({
    requesterUid: z.string().min(1, "ID demandeur invalide"),
    groupId: z.string().min(1, "ID groupe invalide"),
    targetUid: z.string().min(1, "ID cible invalide"),
});

// --- ACTIONS ---

// Créer un groupe (Le créateur devient Admin et Membre)
export async function createGroupAction(userId: string, groupName: string): Promise<ActionResponse> {
    const db = getAdminFirestore();

    // 1. Validation des entrées
    const validation = createGroupSchema.safeParse({ userId, groupName });
    if (!validation.success) {
        return { success: false, error: validation.error.issues[0].message };
    }

    try {
        const groupRef = await db.collection('groups').add({
            name: groupName,
            ownerUid: userId,
            members: [userId],
            admins: [userId],
            createdAt: FieldValue.serverTimestamp()
        });
        
        return { success: true, id: groupRef.id };
    } catch (e) {
        console.error("Erreur createGroupAction:", e);
        return { success: false, error: "Erreur technique lors de la création du groupe" };
    }
}

// Ajouter un membre (Seulement si le demandeur est Admin du groupe)
export async function addMemberAction(requesterUid: string, groupId: string, targetUid: string): Promise<ActionResponse> {
    const db = getAdminFirestore();

    // 1. Validation des entrées
    const validation = memberActionSchema.safeParse({ requesterUid, groupId, targetUid });
    if (!validation.success) {
        return { success: false, error: validation.error.issues[0].message };
    }

    try {
        await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const docSnap = await transaction.get(groupRef);

            if (!docSnap.exists) throw new Error("Groupe introuvable");
            
            const data = docSnap.data() as FirestoreGroup;

            // SÉCURITÉ : Vérifier que celui qui invite est admin
            if (!data.admins.includes(requesterUid)) {
                throw new Error("Permission refusée. Seul un admin peut inviter.");
            }

            if (data.members.includes(targetUid)) {
                throw new Error("Cet utilisateur est déjà membre.");
            }

            transaction.update(groupRef, {
                members: FieldValue.arrayUnion(targetUid)
            });
        });

        return { success: true };
    } catch (e) {
        console.error("Erreur addMemberAction:", e);
        const errorMessage = e instanceof Error ? e.message : "Erreur technique";
        return { success: false, error: errorMessage };
    }
}

// Promouvoir un membre en Admin
export async function promoteMemberAction(requesterUid: string, groupId: string, targetUid: string): Promise<ActionResponse> {
    const db = getAdminFirestore();

    // 1. Validation des entrées
    const validation = memberActionSchema.safeParse({ requesterUid, groupId, targetUid });
    if (!validation.success) {
        return { success: false, error: validation.error.issues[0].message };
    }

    try {
        await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const docSnap = await transaction.get(groupRef);

            if (!docSnap.exists) throw new Error("Groupe introuvable");
            const data = docSnap.data() as FirestoreGroup;

            if (!data.admins.includes(requesterUid)) {
                throw new Error("Permission refusée. Seul un admin peut promouvoir.");
            }

            if (!data.members.includes(targetUid)) {
                throw new Error("L'utilisateur cible n'est pas membre du groupe.");
            }

            if (data.admins.includes(targetUid)) {
                throw new Error("Cet utilisateur est déjà admin.");
            }

            transaction.update(groupRef, {
                admins: FieldValue.arrayUnion(targetUid)
            });
        });

        return { success: true };
    } catch (e) {
        console.error("Erreur promoteMemberAction:", e);
        const errorMessage = e instanceof Error ? e.message : "Erreur technique";
        return { success: false, error: errorMessage };
    }
}

// Quitter ou Exclure (Si admin exclut un autre, ou si l'utilisateur quitte lui-même)
export async function removeMemberAction(requesterUid: string, groupId: string, targetUid: string): Promise<ActionResponse> {
    const db = getAdminFirestore();

    // 1. Validation des entrées
    const validation = memberActionSchema.safeParse({ requesterUid, groupId, targetUid });
    if (!validation.success) {
        return { success: false, error: validation.error.issues[0].message };
    }

    try {
        await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const docSnap = await transaction.get(groupRef);

            if (!docSnap.exists) throw new Error("Groupe introuvable");
            const data = docSnap.data() as FirestoreGroup;

            // PROTECTION : On ne touche pas au propriétaire
            if (targetUid === data.ownerUid) {
                throw new Error("Impossible de retirer le propriétaire du groupe.");
            }

            const isSelf = requesterUid === targetUid;
            const isAdmin = data.admins.includes(requesterUid);

            // On autorise si c'est soi-même OU si le demandeur est admin
            if (!isSelf && !isAdmin) {
                throw new Error("Permission refusée.");
            }

            // On retire des deux tableaux pour être propre (membres et admins)
            transaction.update(groupRef, {
                members: FieldValue.arrayRemove(targetUid),
                admins: FieldValue.arrayRemove(targetUid)
            });
        });

        return { success: true };
    } catch (e) {
        console.error("Erreur removeMemberAction:", e);
        const errorMessage = e instanceof Error ? e.message : "Erreur technique";
        return { success: false, error: errorMessage };
    }
}