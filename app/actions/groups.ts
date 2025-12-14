'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type ActionResponse = {
    success: boolean;
    error?: string;
    id?: string;
};

// Créer un groupe (Le créateur devient Admin et Membre)
export async function createGroupAction(userId: string, groupName: string): Promise<ActionResponse> {
    const db = getAdminFirestore();
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
        console.error(e);
        return { success: false, error: "Erreur lors de la création du groupe" };
    }
}

// Ajouter un membre (Seulement si le demandeur est Admin du groupe)
export async function addMemberAction(requesterUid: string, groupId: string, targetUid: string): Promise<ActionResponse> {
    const db = getAdminFirestore();
    try {
        const groupRef = db.collection('groups').doc(groupId);
        const docSnap = await groupRef.get();

        if (!docSnap.exists) return { success: false, error: "Groupe introuvable" };
        const data = docSnap.data();

        // SÉCURITÉ : Vérifier que celui qui invite est admin
        if (!data?.admins?.includes(requesterUid)) {
            return { success: false, error: "Permission refusée. Seul un admin peut inviter." };
        }

        if (data.members?.includes(targetUid)) {
            return { success: false, error: "Cet utilisateur est déjà membre." };
        }

        await groupRef.update({
            members: FieldValue.arrayUnion(targetUid)
        });

        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Erreur lors de l'ajout du membre" };
    }
}

// Promouvoir un membre en Admin
export async function promoteMemberAction(requesterUid: string, groupId: string, targetUid: string): Promise<ActionResponse> {
    const db = getAdminFirestore();
    try {
        const groupRef = db.collection('groups').doc(groupId);
        const docSnap = await groupRef.get();
        const data = docSnap.data();

        if (!data?.admins?.includes(requesterUid)) {
            return { success: false, error: "Permission refusée." };
        }

        await groupRef.update({
            admins: FieldValue.arrayUnion(targetUid)
        });

        return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return { success: false, error: "Erreur lors de la promotion" };
    }
}

// Quitter ou Exclure (Si admin exclut un autre, ou si l'utilisateur quitte lui-même)
export async function removeMemberAction(requesterUid: string, groupId: string, targetUid: string): Promise<ActionResponse> {
    const db = getAdminFirestore();
    try {
        const groupRef = db.collection('groups').doc(groupId);
        const docSnap = await groupRef.get();
        const data = docSnap.data();

        const isSelf = requesterUid === targetUid;
        const isAdmin = data?.admins?.includes(requesterUid);

        // On autorise si c'est soi-même OU si le demandeur est admin
        if (!isSelf && !isAdmin) {
            return { success: false, error: "Permission refusée." };
        }

        // On retire des deux tableaux pour être propre
        await groupRef.update({
            members: FieldValue.arrayRemove(targetUid),
            admins: FieldValue.arrayRemove(targetUid)
        });

        return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return { success: false, error: "Erreur lors de la suppression du membre" };
    }
}