// app/actions/lists.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canCreateNewList } from '@/lib/limits';
import { z } from 'zod';

const createListSchema = z.object({
  userId: z.string().min(1),
  listName: z.string().min(3).max(50),
  type: z.enum(['collection', 'wishlist']),
});

type ActionResponse = {
  success: boolean;
  error?: string;
  listId?: string;
};

export async function createListAction(userId: string, listName: string, type: 'collection' | 'wishlist'): Promise<ActionResponse> {
  const db = getAdminFirestore();

  const validation = createListSchema.safeParse({ userId, listName, type });
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    // 1. Vérifier la limite Freemium
    // Appelle la fonction mise à jour qui accepte (userId, type)
    const limitCheck = await canCreateNewList(userId, type);
    
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.error };
    }

    // 2. Création de la liste
    // Note : On utilise la même logique de nommage que dans canCreateNewList pour la cohérence
    const collectionName = type === 'collection' ? 'collections_meta' : 'wishlists_meta';
    
    const newListRef = await db.collection('users').doc(userId).collection(collectionName).add({
      name: listName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      itemCount: 0, // Initialisation utile pour l'affichage
      type: type // Stocker le type explicitement peut aider pour le debugging
    });

    return { success: true, listId: newListRef.id };
  } catch (e) {
    console.error("Erreur createListAction:", e);
    const errorMessage = e instanceof Error ? e.message : "Erreur technique";
    return { success: false, error: errorMessage };
  }
}