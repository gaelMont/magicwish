// app/api/webhook/stripe/route.ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Init Stripe Server-Side
// CORRECTION 1 : Mise à jour de la version API demandée par ton erreur
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover', // Version spécifique demandée par TypeScript
});

export async function POST(req: Request) {
  const body = await req.text();
  
  // CORRECTION 2 : headers() est async dans Next.js 15, il faut await
  const headerList = await headers();
  const signature = headerList.get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
        body, 
        signature, 
        process.env.STRIPE_WEBHOOK_SECRET!
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Webhook signature failed", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const db = getAdminFirestore();

  try {
      switch (event.type) {
        
        // CAS 1 : NOUVEL ABONNEMENT PAYÉ
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id; 
          
          if (userId) {
            await db.collection('users').doc(userId).set({
              isPremium: true,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              premiumSince: FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`✅ User ${userId} passed Premium`);
          }
          break;
        }

        // CAS 2 : ABONNEMENT SUPPRIMÉ (Annulation ou Défaut de paiement)
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const stripeSubId = subscription.id;

          const snapshot = await db.collection('users')
            .where('stripeSubscriptionId', '==', stripeSubId)
            .get();

          if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { 
                    isPremium: false,
                    premiumEndedAt: FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            console.log(`Subscription ${stripeSubId} deleted. User downgraded.`);
          }
          break;
        }
      }
  } catch (err) {
      console.error("Firebase update error", err);
      return new NextResponse("Server Error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}