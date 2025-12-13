// app/actions/trade-proposal.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CardSchema } from '@/lib/validators';

// On réutilise CardSchema pour définir la structure de la proposition
const ProposalSchema = z.object({
  senderUid: z.string().min(1),
  senderName: z.string().min(1),
  receiverUid: z.string().min(1),
  receiverName: z.string().min(1),
  itemsGiven: z.array(CardSchema),
  itemsReceived: z.array(CardSchema)
});

type ActionResponse = {
  success: boolean;
  error?: string;
  // Nouveau champ pour indiquer un conflit de proposition
  proposalConflict?: boolean; 
  existingTradeId?: string; // ID de la proposition existante
};

// Fonction utilitaire pour normaliser les cartes pour une comparaison stricte
const normalizeCards = (cards: z.infer<typeof CardSchema>[]) => 
    cards
        .map(c => ({ 
            id: c.id, 
            qty: c.quantity, 
            // Ajout du champ pour la comparaison de version spécifique (Foil/Exact)
            isFoil: c.isFoil || false,
            isSpecific: c.isSpecificVersion || false,
        }))
        // Trie par ID pour garantir que deux propositions avec le même contenu mais un ordre différent sont considérées comme identiques
        .sort((a, b) => a.id.localeCompare(b.id));


export async function proposeTradeAction(rawData: unknown): Promise<ActionResponse> {
  const db = getAdminFirestore();

  try {
    // 1. PARSING & VALIDATION
    const data = ProposalSchema.parse(rawData);

    // 2. PRÉPARATION DES HASHES POUR LA COMPARAISON
    const normalizedGiven = normalizeCards(data.itemsGiven);
    const normalizedReceived = normalizeCards(data.itemsReceived);
    
    // Convertir les objets normalisés en chaîne JSON pour une comparaison stricte
    const hashGiven = JSON.stringify(normalizedGiven);
    const hashReceived = JSON.stringify(normalizedReceived);

    // 3. VÉRIFICATION DES DOUBLONS EN COURS (pending)
    
    const duplicateQuery = db.collection('trades')
      .where('senderUid', '==', data.senderUid)
      .where('receiverUid', '==', data.receiverUid)
      .where('status', '==', 'pending')
      .limit(10); 

    const snapshot = await duplicateQuery.get();
    let existingTradeId: string | null = null;
    let proposalsAreIdentical = false;

    // Vérification approfondie du contenu
    snapshot.docs.forEach(doc => {
      const existingData = doc.data();
      
      const existingNormalizedGiven = normalizeCards(existingData.itemsGiven as z.infer<typeof CardSchema>[]);
      const existingNormalizedReceived = normalizeCards(existingData.itemsReceived as z.infer<typeof CardSchema>[]);
      
      const existingHashGiven = JSON.stringify(existingNormalizedGiven);
      const existingHashReceived = JSON.stringify(existingNormalizedReceived);

      // Comparaison stricte des deux côtés de l'échange
      if (existingHashGiven === hashGiven && existingHashReceived === hashReceived) {
          proposalsAreIdentical = true;
          existingTradeId = doc.id;
      }
    });

    // 4. GESTION DU CONFLIT
    if (proposalsAreIdentical && existingTradeId) {
        // Renvoie une réponse spéciale pour le client
        return { 
            success: false, 
            error: "Une proposition identique est déjà en attente.", 
            proposalConflict: true, 
            existingTradeId
        };
    }

    // 5. ENREGISTREMENT (Si pas de doublon)
    await db.collection('trades').add({
      senderUid: data.senderUid,
      senderName: data.senderName,
      receiverUid: data.receiverUid,
      receiverName: data.receiverName,
      itemsGiven: data.itemsGiven,
      itemsReceived: data.itemsReceived,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp()
    });

    return { success: true };

  } catch (error: unknown) {
    console.error("Erreur proposeTradeAction:", error);
    let errorMessage = "Erreur lors de la proposition";
    
    if (error instanceof z.ZodError) {
      errorMessage = "Données invalides : " + error.issues.map(i => i.message).join(', ');
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}