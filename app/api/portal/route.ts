// app/api/portal/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover', // Ta version installée
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { customerId } = body; 

        if (!customerId) {
             return NextResponse.json({ error: "Customer ID manquant" }, { status: 400 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/premium`,
        });

        return NextResponse.json({ url: session.url });
        
    } catch (err: unknown) { // <--- ON REMPLACE 'any' PAR 'unknown'
        console.error("Erreur création portail Stripe:", err);
        
        let errorMessage = "Erreur serveur";
        
        // On vérifie proprement le type de l'erreur (Type Narrowing)
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}