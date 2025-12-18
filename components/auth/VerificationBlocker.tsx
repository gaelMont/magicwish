// components/auth/VerificationBlocker.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';

export default function VerificationBlocker({ children }: { children: React.ReactNode }) {
    const { user, loading, sendVerificationEmail, reloadUser, logOut } = useAuth();
    const [isSending, setIsSending] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // 1. Si chargement, on ne fait rien (ou on affiche un spinner)
    if (loading) return null;

    // 2. Si pas connecté, on laisse passer (pour qu'il puisse aller sur /login ou /register)
    if (!user) return <>{children}</>;

    // 3. Si connecté ET vérifié, on laisse passer l'application
    if (user.emailVerified) return <>{children}</>;

    // 4. SINON (Connecté mais NON vérifié) : On affiche l'écran de blocage
    const handleResend = async () => {
        setIsSending(true);
        await sendVerificationEmail();
        setIsSending(false);
    };

    const handleCheck = async () => {
        setIsChecking(true);
        await reloadUser();
        setIsChecking(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full bg-surface border border-border rounded-xl shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-2">Vérification Requise</h1>
                
                <p className="text-muted text-sm mb-6 leading-relaxed">
                    Un email de validation a été envoyé à <strong>{user.email}</strong>.
                    <br/><br/>
                    Pour des raisons de sécurité, vous devez valider votre adresse email avant d&apos;accéder à MagicWish.
                </p>

                <div className="space-y-3">
                    <button 
                        onClick={handleCheck}
                        disabled={isChecking}
                        className="w-full btn-primary py-3 font-bold flex justify-center items-center gap-2"
                    >
                        {isChecking ? 'Vérification...' : 'J\'ai validé mon email'}
                    </button>

                    <button 
                        onClick={handleResend}
                        disabled={isSending}
                        className="w-full bg-secondary hover:bg-border text-foreground py-3 rounded-xl font-medium text-sm transition"
                    >
                        {isSending ? 'Envoi en cours...' : 'Renvoyer l\'email'}
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                    <button onClick={() => logOut()} className="text-xs text-muted hover:text-danger hover:underline">
                        Se déconnecter / Changer de compte
                    </button>
                </div>
            </div>
        </div>
    );
}