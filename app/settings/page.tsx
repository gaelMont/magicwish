// app/settings/page.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { usePremium } from '@/hooks/usePremium';
import { useState, useTransition, useEffect } from 'react';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc, setDoc, DocumentData } from 'firebase/firestore'; 
import { db } from '@/lib/firebase';
import { updateProfile, sendPasswordResetEmail, getAuth, Auth } from 'firebase/auth'; 

// --- Typage pour la réponse de l'API Portal ---
interface PortalResponse {
    url?: string;
    error?: string;
}

// Fonction utilitaire pour obtenir l'instance d'authentification
const getFirebaseAuthInstance = (): Auth => {
    return getAuth(); 
};

// --- Composant spécifique pour la gestion Premium (inchangé) ---
const PremiumSettingsCard = () => {
    const { user } = useAuth();
    const { isPremium, loading } = usePremium();
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [isPending, startTransition] = useTransition();

    if (!user) return null; 
    if (loading) return <div className="p-4 text-center text-muted">Chargement...</div>;

    const paymentLink = `${process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}?client_reference_id=${user.uid}`;

    const handleManageSubscription = async () => {
        if (isPending) return;
        setIsRedirecting(true);
        startTransition(async () => {
            try {
                const docRef = await getDoc(doc(db, 'users', user.uid));
                const customerData = docRef.data() as DocumentData | undefined; 
                const customerId = customerData?.stripeCustomerId as string | undefined;
    
                if (!customerId) {
                    toast.error("Abonnement non trouve. Reesayez plus tard.");
                    setIsRedirecting(false);
                    return;
                }
    
                const res = await fetch('/api/portal', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerId })
                });
                
                const data: PortalResponse = await res.json();

                if (data.url) {
                    window.location.href = data.url; 
                } else {
                    throw new Error(data.error || "Erreur redirection Stripe inconnue."); 
                }
            } catch (e) {
                console.error(e);
                toast.error("Erreur gestion d'abonnement. Verifiez la console.");
            } finally {
                setIsRedirecting(false);
            }
        });
    };

    return (
        <div className={`p-5 rounded-xl border transition-all ${isPremium ? 'bg-success/10 border-success/30' : 'bg-surface border-border'}`}>
            <h3 className="text-lg font-bold text-foreground mb-3 flex justify-between items-center">
                Statut Premium
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isPremium ? 'bg-success text-primary-foreground' : 'bg-muted/20 text-muted'}`}>
                    {isPremium ? 'ACTIF' : 'INACTIF'}
                </span>
            </h3>

            {isPremium ? (
                <>
                    <p className="text-muted text-sm mb-4">
                        Merci pour votre soutien. Vous profitez d&apos;une application sans publicite.
                    </p>
                    <button 
                        onClick={handleManageSubscription}
                        disabled={isRedirecting || isPending}
                        className="text-sm text-primary hover:underline font-medium"
                    >
                        {isRedirecting || isPending ? 'Redirection...' : 'Gerer mon abonnement Stripe'}
                    </button>
                </>
            ) : (
                <>
                    <p className="text-muted text-sm mb-4">
                        Passez Premium pour 1 EUR/mois et retirez toutes les publicites.
                    </p>
                    <a 
                        href={paymentLink} 
                        className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition inline-block"
                    >
                        Activer le Premium
                    </a>
                </>
            )}
        </div>
    );
};

// --- COMPOSANT : Gestion du Profil (Pseudo) (inchangé) ---
const ProfileSettingsCard = () => {
    const { user, logOut } = useAuth();
    const initialPseudo = user?.displayName || user?.email?.split('@')[0] || ''; 
    const [isEditing, setIsEditing] = useState(false);
    const [pseudo, setPseudo] = useState(initialPseudo);
    const [isLoading, setIsLoading] = useState(false);
    
    if (!user) return null;

    const handleSavePseudo = async () => {
        const trimmedPseudo = pseudo.trim();
        
        if (trimmedPseudo === '' || trimmedPseudo === initialPseudo) {
            setIsEditing(false);
            return;
        }

        setIsLoading(true);
        try {
            await updateProfile(user, {
                displayName: trimmedPseudo
            });

            const profileInfoRef = doc(db, 'users', user.uid, 'public_profile', 'info');
            
            await updateDoc(profileInfoRef, {
                username: trimmedPseudo,
                updatedAt: new Date(),
            });

            toast.success("Pseudo mis a jour !");
            setIsEditing(false);
        } catch (error) {
            console.error("Erreur lors de la mise a jour du pseudo:", error);
            toast.error("Echec de la mise a jour du pseudo. Reesayez.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
            <h3 className="text-lg font-bold text-foreground mb-3">Informations de base</h3>
            
            <div className="mb-4">
                <p className="text-sm font-medium text-muted mb-1">Pseudo:</p>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <input 
                            type="text"
                            value={pseudo}
                            onChange={(e) => setPseudo(e.target.value)}
                            className="grow p-2 border border-border rounded-lg bg-background text-foreground"
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleSavePseudo} 
                            disabled={isLoading || pseudo.trim() === ''}
                            className="bg-primary hover:opacity-90 text-primary-foreground px-3 py-2 rounded-lg text-sm font-bold transition"
                        >
                            {isLoading ? 'Sauvegarde...' : 'Enregistrer'}
                        </button>
                        <button 
                            onClick={() => { setPseudo(initialPseudo); setIsEditing(false); }}
                            disabled={isLoading}
                            className="text-sm text-muted hover:text-foreground p-2"
                        >
                            Annuler
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="text-primary font-bold text-base">@{user.displayName || initialPseudo}</span>
                        <button 
                            onClick={() => setIsEditing(true)} 
                            className="text-sm text-primary hover:underline font-medium"
                        >
                            Modifier
                        </button>
                    </div>
                )}
            </div>

            <p className="text-sm mb-4"><span className="font-medium text-muted">Email:</span> {user.email}</p>
            
            <button onClick={logOut} className="text-sm text-danger hover:underline">
                Deconnexion
            </button>
        </div>
    );
};

// --- NOUVEAU COMPOSANT : Vérification Email ---
const EmailVerificationCard = () => {
    const { user, sendVerificationEmail, reloadUser } = useAuth();
    const [isSending, setIsSending] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // Si pas d'user ou si déjà vérifié, on n'affiche rien (ou un badge succès si on veut)
    if (!user) return null;
    if (user.emailVerified) return null;

    const handleSend = async () => {
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
        <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-xl border border-amber-200 dark:border-amber-800">
            <h3 className="text-lg font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
                ⚠️ Email non verifie
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                Veuillez verifier votre adresse email ({user.email}) pour securiser votre compte.
            </p>
            
            <div className="flex gap-3">
                <button 
                    onClick={handleSend}
                    disabled={isSending}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                >
                    {isSending ? 'Envoi...' : 'Envoyer le lien'}
                </button>
                <button 
                    onClick={handleCheck}
                    disabled={isChecking}
                    className="bg-surface hover:bg-secondary text-foreground border border-border px-3 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                >
                    {isChecking ? '...' : 'J\'ai clique sur le lien'}
                </button>
            </div>
        </div>
    );
};

// --- COMPOSANT : Sécurité (Changement de MDP) (inchangé) ---
const SecuritySettingsCard = () => {
    const { user } = useAuth(); 
    const [isLoading, setIsLoading] = useState(false); 
    
    if (!user) return null; 
    
    if (!user.email) return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
             <h3 className="text-lg font-bold text-foreground mb-3">Securite</h3>
             <p className="text-danger text-sm">
                 Votre compte n&apos;a pas d&apos;adresse email enregistree.
             </p>
        </div>
    );
    
    const handlePasswordChange = async () => {
        setIsLoading(true);
        try {
            const authInstance = getFirebaseAuthInstance();
            await sendPasswordResetEmail(authInstance, user.email!); 
            toast.success("Email envoye !");
        } catch (error) {
            console.error("Erreur lors de l'envoi de l'email:", error);
            toast.error("Erreur technique.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
            <h3 className="text-lg font-bold text-foreground mb-3">Securite</h3>
            <p className="text-muted text-sm mb-4">
                Changer votre mot de passe par email.
            </p>
            <button 
                onClick={handlePasswordChange}
                disabled={isLoading}
                className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition inline-block"
            >
                {isLoading ? 'Envoi...' : 'Reinitialiser le mot de passe'}
            </button>
        </div>
    );
};

// --- NOUVEAU COMPOSANT : Confidentialité & Échanges ---
const PrivacySettingsCard = () => {
    const { user } = useAuth();
    const [allowFull, setAllowFull] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'users', user.uid, 'public_profile', 'info');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setAllowFull(snap.data().allowFullCollectionInTrade || false);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [user]);

    const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.checked;
        setAllowFull(newValue); // Optimistic update
        
        if (!user) return;
        try {
            const docRef = doc(db, 'users', user.uid, 'public_profile', 'info');
            await setDoc(docRef, { allowFullCollectionInTrade: newValue }, { merge: true });
            toast.success("Preference mise a jour");
        } catch (error) {
            console.error(error);
            toast.error("Erreur de sauvegarde");
            setAllowFull(!newValue); // Rollback
        }
    };

    if (!user) return null;

    return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
            <h3 className="text-lg font-bold text-foreground mb-3">Confidentialite & Echanges</h3>
            
            <div className="flex items-start gap-3">
                <div className="relative flex items-center pt-1">
                    <input 
                        type="checkbox"
                        id="privacy-collection"
                        checked={allowFull}
                        disabled={isLoading}
                        onChange={handleToggle}
                        className="w-5 h-5 text-primary border-border rounded focus:ring-primary cursor-pointer accent-primary"
                    />
                </div>
                <label htmlFor="privacy-collection" className="cursor-pointer">
                    <span className="block font-bold text-foreground text-sm">Partager ma collection complete</span>
                    <span className="block text-xs text-muted mt-1 leading-relaxed">
                        Par defaut, les autres utilisateurs ne voient que votre <strong>Classeur d&apos;echange</strong>.
                        <br/>
                        Cochez cette case pour autoriser vos partenaires d&apos;echange a consulter <strong>toute votre collection</strong> (lecture seule).
                    </span>
                </label>
            </div>
        </div>
    );
};

// --- COMPOSANT : Suggestions d'Amélioration (inchangé) ---
const SuggestionsCard = () => {
    const { user, username } = useAuth();
    const [suggestionText, setSuggestionText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    if (!user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedSuggestion = suggestionText.trim();

        if (trimmedSuggestion.length < 10) {
            toast.error("La suggestion doit contenir au moins 10 caracteres.");
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                userId: user.uid,
                username: username || user.displayName || 'Joueur Inconnu',
                suggestion: trimmedSuggestion,
                context: 'settings-page'
            };

            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success("Suggestion envoyee ! Merci pour votre idee.");
                setSuggestionText('');
            } else {
                const data = await res.json() as { error?: string };
                toast.error(data.error || "Echec de l'envoi.");
            }
        } catch (error) {
            console.error("Erreur d'envoi de feedback:", error);
            toast.error("Erreur reseau ou serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
            <h3 className="text-lg font-bold text-primary mb-3">
                Idees & Suggestions
            </h3>
            <p className="text-muted text-sm mb-4">
                Aidez-nous a ameliorer MagicWish. Votre feedback sera enregistre directement.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                    value={suggestionText}
                    onChange={(e) => setSuggestionText(e.target.value)}
                    rows={4}
                    placeholder="Entrez votre idee d'amelioration ici (10 caracteres minimum)..."
                    className="w-full p-3 border border-border rounded-lg bg-background text-foreground resize-none focus:ring-2 focus:ring-primary outline-none"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || suggestionText.trim().length < 10}
                    className="w-full bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-bold py-3 rounded-xl transition shadow-sm"
                >
                    {isLoading ? 'Envoi en cours...' : 'Soumettre mon idee'}
                </button>
            </form>
        </div>
    );
};


// --- Page principale des paramètres (Mise à jour Finale) ---
export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) {
        return null;
    }
    
    return (
        <main className="container mx-auto p-4 max-w-4xl min-h-[80vh]">
            <h1 className="text-3xl font-bold text-foreground mb-8 border-b border-border pb-4">
                Parametres du compte
            </h1>

            <div className="grid md:grid-cols-2 gap-8">
                
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-primary mb-3">Mon Profil</h2>
                    
                    {/* Bloc Vérification Email (S'affiche seulement si non vérifié) */}
                    <EmailVerificationCard />

                    <ProfileSettingsCard />

                    <SecuritySettingsCard />

                    <PrivacySettingsCard />
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-primary mb-3">Abonnement & Feedback</h2>
                    
                    <PremiumSettingsCard />
                    
                    <SuggestionsCard /> 
                </div>

            </div>
        </main>
    );
}