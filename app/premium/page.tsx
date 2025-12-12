// app/premium/page.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { usePremium } from '@/hooks/usePremium';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore'; // Import supplémentaire
import { db } from '@/lib/firebase';

export default function PremiumPage() {
    const { user } = useAuth();
    const { isPremium, loading } = usePremium();
    const [isRedirecting, setIsRedirecting] = useState(false);

    // Le lien de paiement avec le client_reference_id pour l'identification
    const paymentLink = `${process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}?client_reference_id=${user?.uid}`;

    // Gérer la redirection vers le portail client Stripe pour annuler/modifier
    const handleManageSubscription = async () => {
        if (!user) return;
        setIsRedirecting(true);
        try {
            // On doit lire l'ID client Stripe stocké dans le profil de l'utilisateur
            const docRef = await getDoc(doc(db, 'users', user.uid));
            const customerId = docRef.data()?.stripeCustomerId;

            if (!customerId) {
                toast.error("Impossible de trouver votre abonnement. Contactez le support.");
                setIsRedirecting(false);
                return;
            }

            // Appel de l'API pour générer le lien de gestion du portail Stripe
            const res = await fetch('/api/portal', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId })
            });
            
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url; // Redirection vers Stripe
            } else {
                throw new Error(data.error || "Erreur redirection Stripe");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur gestion d'abonnement.");
            setIsRedirecting(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;
    if (!user) return <div className="p-10 text-center">Connectez-vous pour accéder au Premium.</div>;

    return (
        <div className="container mx-auto p-8 text-center max-w-lg min-h-[80vh] flex flex-col justify-center">
            
            {isPremium ? (
                // --- VUE DÉJÀ ABONNÉ ---
                <div className="bg-green-50 dark:bg-green-900/20 p-8 rounded-2xl border border-green-200 dark:border-green-800">
                    <div className="text-5xl mb-4">💎</div>
                    <h1 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">Vous êtes Premium !</h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Merci de soutenir le projet.
                    </p>
                    <button 
                        onClick={handleManageSubscription}
                        disabled={isRedirecting}
                        className="text-sm text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-200 font-medium"
                    >
                        {isRedirecting ? 'Chargement...' : 'Gérer mon abonnement / Annuler'}
                    </button>
                </div>
            ) : (
                // --- VUE VENTE ---
                <>
                    <h1 className="text-4xl font-bold mb-4 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Passez Premium
                    </h1>
                    <p className="mb-8 text-gray-600 dark:text-gray-300 text-lg">
                        Soutenez le développement pour 1€ / mois.
                    </p>
                    
                    <ul className="text-left bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 space-y-4">
                        <li className="flex items-center gap-3">
                            <span className="bg-green-100 text-green-700 p-1 rounded-full text-xs">✓</span>
                            <span>Plus aucune publicité</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="bg-purple-100 text-purple-700 p-1 rounded-full text-xs">♥</span>
                            <span className="font-bold">Juste 1,00 € / mois</span>
                        </li>
                    </ul>

                    <a 
                        href={paymentLink} 
                        className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg hover:scale-105 transition transform"
                    >
                        Devenir Premium (1€)
                    </a>
                    <p className="text-xs text-gray-400 mt-4">Paiement sécurisé par Stripe.</p>
                </>
            )}
        </div>
    );
}