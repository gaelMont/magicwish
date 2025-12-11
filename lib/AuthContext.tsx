'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; // <--- NOUVEAU
import { auth, db } from './firebase'; // <--- NOUVEAU (db)
import toast from 'react-hot-toast';

type AuthContextType = {
  user: User | null;
  username: string | null; // <--- NOUVEAU : Le pseudo unique
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  username: null,
  loading: true,
  signInWithGoogle: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null); // <--- ETAT DU PSEUDO
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // SI CONNECTÉ : On écoute le profil public pour récupérer le pseudo
        const profileRef = doc(db, 'users', currentUser.uid, 'public_profile', 'info');
        
        const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setUsername(docSnap.data().username);
          } else {
            setUsername(null); // Pas encore de profil
          }
          setLoading(false);
        });

        // Nettoyage de l'écouteur profil quand on change d'user
        return () => unsubscribeProfile();
      } else {
        // SI DÉCONNECTÉ
        setUsername(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Connexion réussie !');
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la connexion Google");
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
    username, // On expose le username
    loading,
    signInWithGoogle,
    logOut
  }), [user, username, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};