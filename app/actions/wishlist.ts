// app/actions/wishlist.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';

type ActionResponse = {
  success: boolean;
  error?: string;
};

export async function deleteWishlistAction(userId: string, listId: string): Promise<ActionResponse> {
  const db = getAdminFirestore();

  try {
    // 1. Récupérer toutes les cartes de la sous-collection
    // Note : Si la liste contient plus de 500 cartes, il faudrait boucler. 
    // Ici on gère un batch simple (jusqu'à 500 ops), suffisant pour une wishlist standard.
    const cardsRef = db.collection(`users/${userId}/wishlists_data/${listId}/cards`);
    const snapshot = await cardsRef.get();

    const batch = db.batch();

    // 2. Ajouter la suppression de chaque carte au batch
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 3. Supprimer le document de métadonnées (le pointeur de la liste)
    const metaRef = db.doc(`users/${userId}/wishlists_meta/${listId}`);
    batch.delete(metaRef);

    // 4. Exécuter
    await batch.commit();

    return { success: true };

  } catch (error: unknown) {
    console.error("Erreur deleteWishlistAction:", error);
    let errorMessage = "Erreur suppression";
    if (error instanceof Error) errorMessage = error.message;
    
    return { success: false, error: errorMessage };
  }
}