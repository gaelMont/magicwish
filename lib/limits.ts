// lib/limits.ts
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { UserProfile } from '@/lib/types';

// RECOMMANDATION : 5 Crédits gratuits par jour
const FREE_DAILY_CREDITS = 5;

// LIMITES FREEMIUM
const MAX_FREE_COLLECTIONS = 1; // 1 Classeur principal
const MAX_FREE_WISHLISTS = 1;   // 1 Wishlist générale uniquement

export const COSTS = {
  TRADE_MATCH: 1, // Le "Scanner" de match
  IMPORT: 1,      // Import CSV coûte 1 crédit
  EXPORT: 1,      // Export CSV coûte 1 crédit
  CREATE_LIST: 0, // Le coût est géré par la limite stricte (MAX_FREE_...), pas par les crédits
} as const;

type CostType = keyof typeof COSTS;

/**
 * Vérifie et consomme les crédits pour une action donnée.
 */
export async function checkAndConsumeCredits(userId: string, action: CostType): Promise<{ allowed: boolean; error?: string }> {
  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(userId);
  const cost = COSTS[action];
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error("Utilisateur introuvable");
      }

      const userData = userDoc.data() as UserProfile;
      
      // 1. Si Premium, TOUT est illimité (pas de consommation de crédits)
      if (userData.isPremium) {
        return { allowed: true };
      }

      // 2. Gestion du Reset Quotidien
      let currentCredits = userData.dailyCredits ?? 0;
      const lastReset = userData.lastCreditReset;

      if (lastReset !== todayStr) {
        currentCredits = FREE_DAILY_CREDITS;
        transaction.update(userRef, {
          dailyCredits: FREE_DAILY_CREDITS,
          lastCreditReset: todayStr
        });
      }

      // 3. Vérification du solde
      if (currentCredits < cost) {
        return { 
          allowed: false, 
          error: `Crédits insuffisants (${currentCredits}/${cost}). Revenez demain ou passez Premium.` 
        };
      }

      // 4. Consommation
      if (cost > 0) {
        transaction.update(userRef, {
          dailyCredits: FieldValue.increment(-cost)
        });
      }

      return { allowed: true };
    });

    return result;

  } catch (error) {
    console.error("Erreur checkAndConsumeCredits:", error);
    const message = error instanceof Error ? error.message : "Erreur lors de la vérification des crédits";
    return { allowed: false, error: message };
  }
}

/**
 * Vérifie si l'utilisateur a atteint sa limite de listes.
 */
export async function canCreateNewList(userId: string, type: 'collection' | 'wishlist'): Promise<{ allowed: boolean; error?: string }> {
  const db = getAdminFirestore();
  
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return { allowed: false, error: "Utilisateur introuvable" };
  
  const userData = userDoc.data() as UserProfile;
  if (userData.isPremium) return { allowed: true };

  const targetCollection = type === 'collection' ? 'collections_meta' : 'wishlists_meta';
  const limit = type === 'collection' ? MAX_FREE_COLLECTIONS : MAX_FREE_WISHLISTS;

  const snapshot = await db
    .collection('users')
    .doc(userId)
    .collection(targetCollection)
    .count()
    .get();

  const count = snapshot.data().count;

  if (count >= limit) {
    const message = type === 'collection' 
        ? "Vous êtes limité à 1 Collection Principale." 
        : "Vous êtes limité à 1 Wishlist Générale.";
    return { allowed: false, error: `${message} Passez Premium pour créer des listes illimitées.` };
  }

  return { allowed: true };
}