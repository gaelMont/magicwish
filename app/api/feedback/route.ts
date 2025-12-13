// app/api/feedback/route.ts
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// Schéma de validation de la suggestion entrante
const FeedbackSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1).max(50),
  suggestion: z.string().min(10).max(1000),
  context: z.string().default('settings-page') 
});

export async function POST(req: Request) {
  const db = getAdminFirestore();

  try {
    const body = await req.json();
    const validation = FeedbackSchema.safeParse(body);

    if (!validation.success) {
      console.error("Erreur de validation Feedback:", validation.error);
      return NextResponse.json(
        { error: 'Données invalides. La suggestion doit être entre 10 et 1000 caractères.' }, 
        { status: 400 }
      );
    }

    const data = validation.data;

    // Enregistrement dans une nouvelle collection 'app_feedback'
    await db.collection('app_feedback').add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      status: 'new' // Statut initial pour le suivi
    });

    return NextResponse.json({ success: true, message: 'Merci pour votre suggestion !' }, { status: 200 });

  } catch (error) {
    console.error('Erreur interne du serveur lors de l\'enregistrement du feedback:', error);
    return NextResponse.json(
      { error: 'Une erreur interne est survenue.' }, 
      { status: 500 }
    );
  }
}