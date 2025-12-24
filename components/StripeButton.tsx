// components/StripeButton.tsx
'use client';

import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

type Props = {
  className?: string;
  children?: React.ReactNode;
};

export default function StripeButton({ className, children }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (!user) {
        // Si pas connecté, on envoie au login
        router.push('/login');
        return;
    }

    const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

    if (!paymentLink) {
        console.error("Configuration Stripe manquante : NEXT_PUBLIC_STRIPE_PAYMENT_LINK");
        alert("Erreur de configuration du paiement. Veuillez contacter le support.");
        return;
    }

    // Redirection vers le lien de paiement avec l'ID utilisateur
    // C'est exactement la même logique que dans Settings
    window.location.href = `${paymentLink}?client_reference_id=${user.uid}`;
  };

  return (
    <button 
      onClick={handleClick}
      className={className}
    >
      {children || "Passer Premium"}
    </button>
  );
}