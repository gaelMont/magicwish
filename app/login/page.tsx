// Fichier : app/login/page.tsx

'use client'; // Cette page est interactive

import { useRouter } from 'next/navigation'; // Pour rediriger l'utilisateur
import { useAuth } from '@/lib/AuthContext'; // On utilise notre "raccourci" !

export default function LoginPage() {
  // On récupère les infos de notre "carte d'identité"
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter(); // L'outil de redirection

  // Si le chargement est terminé ET que l'utilisateur est DÉJÀ connecté...
  if (!loading && user) {
    // ...on le renvoie à la page d'accueil.
    router.push('/');
    return null; // On n'affiche rien sur cette page
  }

  // Si on charge, on affiche un message simple
  if (loading) {
    return <p>Chargement...</p>;
  }

  // C'est le HTML (JSX) qui s'affiche
  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Bienvenue sur MagicWish</h1>
        <p className="mb-6">Veuillez vous connecter pour créer votre wishlist.</p>
        
        {/* LE BOUTON DE CONNEXION */}
        <button
          onClick={signInWithGoogle} // Au clic, on appelle la fonction du Contexte
          className="bg-blue-500 text-white p-3 rounded-lg font-semibold"
        >
          Se connecter avec Google
        </button>
      </div>
    </main>
  );
}