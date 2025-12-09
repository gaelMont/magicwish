// Fichier : lib/AuthContext.tsx

'use client'; // Ce fichier est côté client (navigateur)

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  type User // Le "type" de l'utilisateur Firebase
} from 'firebase/auth';
import { auth } from './firebase'; // On importe 'auth' de notre fichier firebase.ts

// 1. On définit la forme de notre "carte d'identité" (le Contexte)
interface AuthContextType {
  user: User | null; // L'utilisateur (ou null s'il n'est pas connecté)
  loading: boolean; // Pour savoir si on est en train de vérifier (au chargement)
  signInWithGoogle: () => Promise<void>; // La fonction pour se connecter
  logOut: () => Promise<void>; // La fonction pour se déconnecter
}

// 2. On crée le Contexte
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. On crée "l'Enveloppe" (le Fournisseur/Provider)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // On commence en mode "chargement"

  // Cette fonction s'exécute quand on se connecte avec Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erreur lors de la connexion Google", error);
    }
  };

  // Cette fonction s'exécute quand on se déconnecte
  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erreur lors de la déconnexion", error);
    }
  };

  // C'est le CŒUR du système.
  // Ce 'useEffect' s'exécute une fois au démarrage.
  // 'onAuthStateChanged' est un "auditeur" de Firebase.
  // Il nous dit "un utilisateur s'est connecté" ou "il s'est déconnecté".
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user); // On met à jour la "carte d'identité"
      setLoading(false); // On a fini de vérifier, on arrête de charger
    });

    // On "nettoie" l'auditeur quand le composant est détruit
    return () => unsubscribe();
  }, []);

  // On fournit la "carte d'identité" (valeur) à tous les enfants (children)
  const value = {
    user,
    loading,
    signInWithGoogle,
    logOut
  };

  // On n'affiche l'app que si on n'est pas en train de charger
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// 4. On crée un "raccourci" (un Hook) pour lire le contexte facilement
// Au lieu d'écrire 'useContext(AuthContext)' partout, on écrira 'useAuth()'
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};