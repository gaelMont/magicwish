'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut, 
  User 
} from 'firebase/auth';
import { doc, onSnapshot, collection, Unsubscribe } from 'firebase/firestore'; 
import { auth, db } from './firebase'; 
import toast from 'react-hot-toast';

// Typage strict
type AuthContextType = {
  user: User | null;
  username: string | null;
  loading: boolean;
  friendRequestCount: number;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  signUpWithEmail: (email: string, pass: string) => Promise<boolean>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  username: null,
  loading: true,
  friendRequestCount: 0,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => false,
  signUpWithEmail: async () => false,
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Helper pour traduire les erreurs Firebase
const getErrorMessage = (code: string) => {
    switch (code) {
        case 'auth/email-already-in-use': return "Cet email est déjà utilisé.";
        case 'auth/invalid-email': return "Email invalide.";
        case 'auth/weak-password': return "Le mot de passe doit faire 6 caractères min.";
        case 'auth/user-not-found': return "Aucun compte avec cet email.";
        case 'auth/wrong-password': return "Mot de passe incorrect.";
        case 'auth/too-many-requests': return "Trop de tentatives. Réessayez plus tard.";
        case 'auth/credential-already-in-use': return "Ce compte existe déjà.";
        default: return "Erreur d'authentification.";
    }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Variables pour stocker les fonctions de nettoyage
    let unsubProfile: Unsubscribe | null = null;
    let unsubRequests: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // 1. NETTOYAGE IMMÉDIAT des anciens écouteurs avant toute chose
      // Cela empêche l'erreur "Permission Denied" lors de la déconnexion
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (unsubRequests) { unsubRequests(); unsubRequests = null; }

      setUser(currentUser);

      if (currentUser) {
        // 2. Initialisation des nouveaux écouteurs (si connecté)
        
        // A. Profil Public
        const profileRef = doc(db, 'users', currentUser.uid, 'public_profile', 'info');
        unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setUsername(docSnap.data().username);
          } else {
            setUsername(null);
          }
          setLoading(false);
        }, (error) => {
            console.log("Info: Profil non chargé (peut-être nouvelle inscription)", error.code);
            setLoading(false);
        });

        // B. Notifications
        const requestsRef = collection(db, 'users', currentUser.uid, 'friend_requests_received');
        unsubRequests = onSnapshot(requestsRef, (snap) => {
          setFriendRequestCount(snap.docs.length);
        }, (error) => {
            console.error("Erreur listener requests:", error);
        });

      } else {
        // 3. Reset de l'état (si déconnecté)
        setUsername(null);
        setFriendRequestCount(0);
        setLoading(false);
      }
    });

    // Nettoyage global lors du démontage du composant
    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubRequests) unsubRequests();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Connexion Google réussie !');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
          const firebaseError = error as { code: string };
          if (firebaseError.code === 'auth/cancelled-popup-request' || 
              firebaseError.code === 'auth/popup-closed-by-user') {
              return; 
          }
      }
      console.error(error);
      toast.error("Erreur connexion Google");
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
      try {
          await signInWithEmailAndPassword(auth, email, pass);
          toast.success("Bon retour !");
          return true;
      } catch (error: unknown) {
          console.error(error);
          let msg = "Erreur connexion";
          if (error && typeof error === 'object' && 'code' in error) {
              msg = getErrorMessage((error as { code: string }).code);
          }
          toast.error(msg);
          return false;
      }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
      try {
          await createUserWithEmailAndPassword(auth, email, pass);
          toast.success("Compte créé avec succès !");
          return true;
      } catch (error: unknown) {
          console.error(error);
          let msg = "Erreur inscription";
          if (error && typeof error === 'object' && 'code' in error) {
              msg = getErrorMessage((error as { code: string }).code);
          }
          toast.error(msg);
          return false;
      }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
      toast.success('Déconnecté');
    } catch (error) {
      console.error(error);
      toast.error("Erreur déconnexion");
    }
  };

  const value = useMemo(() => ({
    user,
    username,
    friendRequestCount,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logOut
  }), [user, username, loading, friendRequestCount]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};