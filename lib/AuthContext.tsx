'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut, 
  User,
  Unsubscribe,
  sendEmailVerification 
} from 'firebase/auth';
import { doc, onSnapshot, collection, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore'; 
import { auth, db } from './firebase'; 
import toast from 'react-hot-toast';
import { UserProfile } from '@/lib/types';

type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  username: string | null;
  loading: boolean;
  friendRequestCount: number;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  signUpWithEmail: (email: string, pass: string) => Promise<boolean>;
  logOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<boolean>;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  username: null,
  loading: true,
  friendRequestCount: 0,
  isAdmin: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => false,
  signUpWithEmail: async () => false,
  logOut: async () => {},
  sendVerificationEmail: async () => false,
  reloadUser: async () => {},
});

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

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubProfile: Unsubscribe | null = null;
    let unsubUserData: Unsubscribe | null = null;
    let unsubRequests: Unsubscribe | null = null;
    let unsubAdmin: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (unsubUserData) { unsubUserData(); unsubUserData = null; }
      if (unsubRequests) { unsubRequests(); unsubRequests = null; }
      if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }

      setUser(currentUser);

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);

        // --- Check & Reset Daily Credits ---
        const checkDailyCredits = async () => {
             try {
                 const userSnap = await getDoc(userRef);
                 
                 // Initialisation si nouveau user
                 if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        displayName: currentUser.displayName,
                        photoURL: currentUser.photoURL,
                        createdAt: serverTimestamp(),
                        lastLogin: serverTimestamp(),
                        cardCount: 0,
                        isCollectionPublic: false,
                        isPremium: false,
                        dailyCredits: 5,
                        lastCreditReset: new Date().toISOString().split('T')[0]
                    }, { merge: true });
                    return; // Le listener prendra le relais
                 }

                 // Logique de reset
                 const data = userSnap.data() as UserProfile;
                 const todayStr = new Date().toISOString().split('T')[0];
                 
                 // Si pas premium et nouvelle journée => Reset
                 if (!data.isPremium && data.lastCreditReset !== todayStr) {
                     await updateDoc(userRef, {
                         dailyCredits: 5,
                         lastCreditReset: todayStr
                     });
                 }
             } catch (err) {
                 console.error("Erreur checkDailyCredits:", err);
             }
        };
        
        // On lance la vérification sans bloquer le reste
        checkDailyCredits();

        // --- Listeners ---

        // 1. User Data (Credits, Premium)
        unsubUserData = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(docSnap.data() as UserProfile);
            }
        });

        // 2. Admin Check
        const adminRef = doc(db, 'admins', currentUser.uid);
        unsubAdmin = onSnapshot(adminRef, (docSnap) => {
            setIsAdmin(docSnap.exists());
        }, (error) => {
            console.error("Erreur vérification admin:", error);
            setIsAdmin(false);
        });

        // 3. Public Profile
        const profileRef = doc(db, 'users', currentUser.uid, 'public_profile', 'info');
        unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setUsername(docSnap.data().username as string);
          } else {
            setUsername(null);
          }
          setLoading(false);
        }, () => {
            setLoading(false);
        });

        // 4. Friend Requests
        const requestsRef = collection(db, 'users', currentUser.uid, 'friend_requests_received');
        unsubRequests = onSnapshot(requestsRef, (snap) => {
          setFriendRequestCount(snap.docs.length);
        }, (error) => {
          console.error("Erreur listener requests:", error);
        });

      } else {
        setUserProfile(null);
        setUsername(null);
        setFriendRequestCount(0);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubUserData) unsubUserData();
      if (unsubRequests) unsubRequests();
      if (unsubAdmin) unsubAdmin();
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
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        toast.success("Compte créé avec succès !");
        
        if (userCred.user) {
            try {
                await sendEmailVerification(userCred.user);
                toast("Un email de vérification a été envoyé.");
            } catch (err) {
                console.warn("Erreur envoi email vérif auto", err);
            }
        }

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

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) return false;
    try {
        await sendEmailVerification(auth.currentUser);
        toast.success("Email envoyé ! Vérifiez vos spams.");
        return true;
    } catch (e) {
        console.error(e);
        toast.error("Erreur lors de l'envoi.");
        return false;
    }
  };

  const reloadUser = async () => {
    if (!auth.currentUser) return;
    try {
        await auth.currentUser.reload();
        setUser({ ...auth.currentUser });
        
        if (auth.currentUser.emailVerified) {
            toast.success("Compte vérifié !");
        } else {
            toast("Email toujours non vérifié.");
        }
    } catch (e) {
        console.error(e);
    }
  };

  const value = useMemo(() => ({
    user,
    userProfile,
    username,
    friendRequestCount,
    loading,
    isAdmin,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logOut,
    sendVerificationEmail,
    reloadUser
  }), [user, userProfile, username, loading, friendRequestCount, isAdmin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};