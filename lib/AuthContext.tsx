'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { doc, onSnapshot, collection } from 'firebase/firestore'; 
import { auth, db } from './firebase'; 
import toast from 'react-hot-toast';

type AuthContextType = {
  user: User | null;
  username: string | null;
  loading: boolean;
  friendRequestCount: number; // Compteur pour les notifications
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  username: null,
  loading: true,
  friendRequestCount: 0,
  signInWithGoogle: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // 1. Écoute du Pseudo (Profil Public)
        const profileRef = doc(db, 'users', currentUser.uid, 'public_profile', 'info');
        const unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setUsername(docSnap.data().username);
          } else {
            setUsername(null);
          }
          // On ne met loading à false qu'ici pour être sûr d'avoir le username
          setLoading(false);
        });

        // 2. Écoute des Demandes d'amis (Notifications)
        const requestsRef = collection(db, 'users', currentUser.uid, 'friend_requests_received');
        const unsubRequests = onSnapshot(requestsRef, (snap) => {
          setFriendRequestCount(snap.docs.length);
        });

        // Nettoyage quand l'utilisateur change ou se déconnecte
        return () => {
          unsubProfile();
          unsubRequests();
        };
      } else {
        setUsername(null);
        setFriendRequestCount(0);
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
    username,
    friendRequestCount,
    loading,
    signInWithGoogle,
    logOut
  }), [user, username, loading, friendRequestCount]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};