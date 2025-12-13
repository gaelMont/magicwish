// app/actions/friends.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';

// Définition stricte des types pour éviter le 'any'
type FriendInput = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
};

type ActionResponse = {
  success: boolean;
  error?: string;
};

export async function acceptFriendRequestAction(
  currentUserId: string,
  targetUser: FriendInput
): Promise<ActionResponse> {
  const db = getAdminFirestore();
  
  try {
    // 1. Récupérer les infos à jour de l'utilisateur courant (pour être sûr des données)
    const currentUserDoc = await db.doc(`users/${currentUserId}/public_profile/info`).get();
    
    if (!currentUserDoc.exists) {
      throw new Error("Profil utilisateur introuvable.");
    }

    const currentUserData = currentUserDoc.data();
    
    // On sécurise les données de l'utilisateur courant
    const currentUserPayload: FriendInput = {
        uid: currentUserId,
        username: currentUserData?.username || "Inconnu",
        displayName: currentUserData?.displayName || "Sans nom",
        photoURL: currentUserData?.photoURL || null
    };

    // 2. Préparer le Batch
    const batch = db.batch();

    // A. Ajouter l'ami dans MA liste
    const myFriendRef = db.doc(`users/${currentUserId}/friends/${targetUser.uid}`);
    batch.set(myFriendRef, {
      uid: targetUser.uid,
      username: targetUser.username,
      displayName: targetUser.displayName,
      photoURL: targetUser.photoURL || null,
      addedAt: new Date()
    });

    // B. M'ajouter dans SA liste (C'est ici que ça bloquait côté client)
    const hisFriendRef = db.doc(`users/${targetUser.uid}/friends/${currentUserId}`);
    batch.set(hisFriendRef, {
      ...currentUserPayload,
      addedAt: new Date()
    });

    // C. Supprimer la demande d'ami reçue
    const reqRef = db.doc(`users/${currentUserId}/friend_requests_received/${targetUser.uid}`);
    batch.delete(reqRef);

    // 3. Valider la transaction
    await batch.commit();

    return { success: true };

  } catch (error: unknown) {
    console.error("Erreur acceptFriendRequestAction:", error);
    let errorMessage = "Erreur serveur";
    
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === "string") {
        errorMessage = error;
    }

    return { success: false, error: errorMessage };
  }
}