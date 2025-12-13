// app/actions/trade-proposal.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
// Import du schéma partagé pour éviter la duplication
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
};

export async function proposeTradeAction(rawData: unknown): Promise<ActionResponse> {
  const db = getAdminFirestore();

  try {
    // 1. PARSING & VALIDATION
    const data = ProposalSchema.parse(rawData);

    // 2. VALIDATION MÉTIER SUPPLÉMENTAIRE
    if (data.itemsGiven.length === 0 && data.itemsReceived.length === 0) {
      throw new Error("La proposition ne peut pas être vide.");
    }

    // 3. ENREGISTREMENT
    // Les données sont garanties propres par Zod
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