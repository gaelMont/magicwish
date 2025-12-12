// app/api/portal/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
    
    try {
        const body = await req.json();
        const { customerId } = body; 

        if (!customerId) {
             return NextResponse.json({ error: "Customer ID manquant" }, { status: 400 });
        }

        // Création de la session du portail de facturation
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/premium`, // Redirection après gestion
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error("Erreur création portail Stripe:", err);
        return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
    }
}