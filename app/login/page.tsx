'use client';

import { useState, useEffect } from 'react'; // Ajout de useEffect
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const router = useRouter();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- CORRECTION ICI ---
  // On utilise useEffect pour gérer la redirection APRES le rendu
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // On retourne null pour ne rien afficher pendant la redirection
  // cela évite un "flash" du formulaire de connexion
  if (!loading && user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    let success = false;

    if (isLoginMode) {
        success = await signInWithEmail(email, password);
    } else {
        success = await signUpWithEmail(email, password);
    }

    if (success) {
        router.push('/');
    } else {
        setIsSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted">Chargement...</div>;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background transition-colors duration-300">
      
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* EN-TÊTE */}
        <div className="p-8 text-center bg-linear-to-b from-primary/10 to-transparent">
            <h1 className="text-3xl font-black text-primary mb-2">MagicWish</h1>
            <p className="text-muted text-sm">
                {isLoginMode ? 'Heureux de vous revoir !' : 'Rejoignez la communauté.'}
            </p>
        </div>

        {/* TABS (Connexion / Inscription) */}
        <div className="flex border-b border-border">
            <button 
                onClick={() => setIsLoginMode(true)}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${isLoginMode ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted hover:text-foreground hover:bg-secondary'}`}
            >
                Connexion
            </button>
            <button 
                onClick={() => setIsLoginMode(false)}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${!isLoginMode ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted hover:text-foreground hover:bg-secondary'}`}
            >
                Inscription
            </button>
        </div>

        {/* FORMULAIRE */}
        <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-muted uppercase mb-1">Email</label>
                    <input 
                        type="email" 
                        required
                        placeholder="exemple@email.com"
                        className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-muted uppercase mb-1">Mot de passe</label>
                    <input 
                        type="password" 
                        required
                        placeholder="••••••••"
                        className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {!isLoginMode && <p className="text-[10px] text-muted mt-1">Au moins 6 caractères.</p>}
                </div>

                <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl shadow-lg mt-2 flex justify-center items-center"
                >
                    {isSubmitting 
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : (isLoginMode ? 'Se connecter' : 'Créer un compte')
                    }
                </button>
            </form>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-muted">Ou continuer avec</span></div>
            </div>

            <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-border hover:bg-zinc-50 dark:hover:bg-zinc-700 font-bold py-3 rounded-xl transition shadow-sm"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
            </button>
        </div>
        
        <div className="bg-secondary/50 p-4 text-center border-t border-border">
            <Link href="/" className="text-xs text-muted hover:text-primary transition">Retour à l&apos;accueil</Link>
        </div>
      </div>
    </main>
  );
}