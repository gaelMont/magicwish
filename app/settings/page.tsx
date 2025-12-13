'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { usePremium } from '@/hooks/usePremium';
import { useState, useTransition, useEffect } from 'react'; // AJOUT de useEffect
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc, DocumentData } from 'firebase/firestore'; 
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


// --- Composant spécifique pour la gestion Premium ---
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
                    toast.error("Abonnement non trouvé. Réessayez plus tard.");
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
                toast.error("Erreur gestion d'abonnement. Vérifiez la console.");
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
                    {isPremium ? 'ACTIF 💎' : 'INACTIF'}
                </span>
            </h3>

            {isPremium ? (
                <>
                    <p className="text-muted text-sm mb-4">
                        Merci pour votre soutien. Vous profitez d&apos;une application sans publicité.
                    </p>
                    <button 
                        onClick={handleManageSubscription}
                        disabled={isRedirecting || isPending}
                        className="text-sm text-primary hover:underline font-medium"
                    >
                        {isRedirecting || isPending ? 'Redirection...' : 'Gérer mon abonnement Stripe'}
                    </button>
                </>
            ) : (
                <>
                    <p className="text-muted text-sm mb-4">
                        Passez Premium pour 1€/mois et retirez toutes les publicités.
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


// --- COMPOSANT : Gestion du Profil (Pseudo) ---
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
            // 1. Mettre à jour le displayName de l'utilisateur Firebase Auth
            await updateProfile(user, {
                displayName: trimmedPseudo
            });

            // 2. Mettre à jour le document utilisateur dans Firestore
            // CORRECTION CRITIQUE (Erreur Firebase : Permission)
            // On cible spécifiquement le document 'info' dans la sous-collection 'public_profile'
            const profileInfoRef = doc(db, 'users', user.uid, 'public_profile', 'info');
            
            await updateDoc(profileInfoRef, {
                username: trimmedPseudo,
                updatedAt: new Date(),
            });

            toast.success("Pseudo mis à jour !");
            setIsEditing(false);
        } catch (error) {
            console.error("Erreur lors de la mise à jour du pseudo:", error);
            toast.error("Échec de la mise à jour du pseudo. Réessayez.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
            <h3 className="text-lg font-bold text-foreground mb-3">Informations de base</h3>
            
            {/* Pseudo Modifiable */}
            <div className="mb-4">
                <p className="text-sm font-medium text-muted mb-1">Pseudo:</p>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <input 
                            type="text"
                            value={pseudo}
                            onChange={(e) => setPseudo(e.target.value)}
                            className="flex-grow p-2 border border-border rounded-lg bg-background text-foreground"
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

            {/* Email (Lecture Seule) - L'UID est supprimé */}
            <p className="text-sm mb-4"><span className="font-medium text-muted">Email:</span> {user.email}</p>
            
            <button onClick={logOut} className="text-sm text-danger hover:underline">
                Déconnexion
            </button>
        </div>
    );
};

// --- COMPOSANT : Sécurité (Changement de MDP) ---
const SecuritySettingsCard = () => {
    const { user } = useAuth(); 
    const [isLoading, setIsLoading] = useState(false); 
    
    if (!user) return null; 
    
    if (!user.email) return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
             <h3 className="text-lg font-bold text-foreground mb-3">Sécurité</h3>
             <p className="text-danger text-sm">
                 Votre compte n&apos;a pas d&apos;adresse email enregistrée. Le changement de mot de passe n&apos;est pas disponible pour cette méthode de connexion.
             </p>
        </div>
    );
    
    const handlePasswordChange = async () => {
        setIsLoading(true);
        try {
            const authInstance = getFirebaseAuthInstance();
            
            await sendPasswordResetEmail(authInstance, user.email); 
            
            toast.success("Un lien de réinitialisation du mot de passe a été envoyé à votre adresse email. Vérifiez vos spams !");
        } catch (error) {
            console.error("Erreur lors de l'envoi de l'email:", error);
            toast.error("Échec de l'envoi du lien. Veuillez contacter le support.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border">
            <h3 className="text-lg font-bold text-foreground mb-3">Sécurité</h3>
            <p className="text-muted text-sm mb-4">
                Utilisez votre adresse email pour mettre à jour votre mot de passe en toute sécurité.
            </p>
            <button 
                onClick={handlePasswordChange}
                disabled={isLoading}
                className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition inline-block"
            >
                {isLoading ? 'Envoi...' : 'Changer le mot de passe'}
            </button>
        </div>
    );
}


// --- Page principale des paramètres (Mise à jour Finale) ---
export default function SettingsPage() {
    // On déstructure user et loading: authLoading
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // CORRECTION REACT : Déplacer la redirection dans useEffect
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Retourne null pendant que l'authentification charge ou si l'utilisateur n'est pas là (pour éviter le flash)
    if (authLoading || !user) {
        return null;
    }
    
    return (
        <main className="container mx-auto p-4 max-w-4xl min-h-[80vh]">
            <h1 className="text-3xl font-bold text-foreground mb-8 border-b border-border pb-4">
                ⚙️ Paramètres du compte
            </h1>

            <div className="grid md:grid-cols-2 gap-8">
                
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-primary mb-3">Mon Profil</h2>
                    
                    <ProfileSettingsCard />

                    <SecuritySettingsCard />
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-primary mb-3">Abonnement</h2>
                    
                    <PremiumSettingsCard />
                </div>

            </div>
        </main>
    );
}