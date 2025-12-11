// hooks/useFriends.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { 
  doc, getDoc, setDoc, deleteDoc, 
  collection, onSnapshot, serverTimestamp, writeBatch 
} from 'firebase/firestore';
import toast from 'react-hot-toast';

export type FriendProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
};

export function useFriends() {
  const { user, username } = useAuth();
  
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requestsReceived, setRequestsReceived] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Écouter les amis et les demandes en temps réel
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setRequestsReceived([]);
      return;
    }

    // 1. Écoute Mes Amis
    const friendsRef = collection(db, 'users', user.uid, 'friends');
    const unsubFriends = onSnapshot(friendsRef, (snap) => {
      const list = snap.docs.map(d => d.data() as FriendProfile);
      setFriends(list);
    });

    // 2. Écoute Demandes Reçues
    const reqRef = collection(db, 'users', user.uid, 'friend_requests_received');
    const unsubReq = onSnapshot(reqRef, (snap) => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as FriendProfile));
      setRequestsReceived(list);
    });

    setLoading(false);

    return () => {
      unsubFriends();
      unsubReq();
    };
  }, [user]);

  // --- ACTIONS ---

  // 1. Rechercher un utilisateur par son pseudo exact
  const searchUserByUsername = async (targetUsername: string) => {
    const cleanName = targetUsername.trim().toLowerCase();
    if (cleanName === username) throw new Error("C'est vous !");

    // On cherche dans l'index 'usernames'
    const usernameRef = doc(db, 'usernames', cleanName);
    const snap = await getDoc(usernameRef);

    if (!snap.exists()) return null; // Pas trouvé

    const targetUid = snap.data().uid;
    
    // On récupère son profil public
    const profileSnap = await getDoc(doc(db, 'users', targetUid, 'public_profile', 'info'));
    if (!profileSnap.exists()) return null;

    return { uid: targetUid, ...profileSnap.data() } as FriendProfile;
  };

  // 2. Envoyer une demande
  const sendFriendRequest = async (targetUser: FriendProfile) => {
    if (!user || !username) return;

    // A. Check si déjà ami
    if (friends.some(f => f.uid === targetUser.uid)) {
      toast.error("Vous êtes déjà amis !");
      return;
    }

    try {
      // On écrit dans SA collection 'friend_requests_received'
      // On y met NOS infos pour qu'il sache qui on est
      await setDoc(doc(db, 'users', targetUser.uid, 'friend_requests_received', user.uid), {
        uid: user.uid,
        username: username, // Notre pseudo
        displayName: user.displayName,
        photoURL: user.photoURL,
        sentAt: serverTimestamp()
      });
      
      // Optionnel: On pourrait écrire dans 'friend_requests_sent' chez nous pour suivi
      toast.success(`Demande envoyée à @${targetUser.username}`);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'envoi.");
    }
  };

  // 3. Accepter une demande (Transaction Batch)
  const acceptRequest = async (sender: FriendProfile) => {
    if (!user || !username) return;

    try {
      const batch = writeBatch(db);

      // A. Ajouter dans MES amis
      const myFriendRef = doc(db, 'users', user.uid, 'friends', sender.uid);
      batch.set(myFriendRef, sender); // On stocke ses infos

      // B. Ajouter MOI dans SES amis
      const hisFriendRef = doc(db, 'users', sender.uid, 'friends', user.uid);
      batch.set(hisFriendRef, {
        uid: user.uid,
        username: username,
        displayName: user.displayName,
        photoURL: user.photoURL
      });

      // C. Supprimer la demande reçue
      const reqRef = doc(db, 'users', user.uid, 'friend_requests_received', sender.uid);
      batch.delete(reqRef);

      await batch.commit();
      toast.success(`Vous êtes maintenant ami avec @${sender.username} !`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur validation");
    }
  };

  // 4. Refuser/Supprimer
  const declineRequest = async (senderUid: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'friend_requests_received', senderUid));
    toast.success("Demande supprimée");
  };
  
  const removeFriend = async (friendUid: string) => {
      if(!user) return;
      if(!confirm("Retirer cet ami ?")) return;
      
      // On supprime juste de NOTRE liste (l'autre nous verra toujours, ou on fait un cloud function plus tard)
      // Pour faire simple et propre, on supprime le lien localement
      await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
      toast.success("Ami retiré");
  };

  return { 
    friends, 
    requestsReceived, 
    loading, 
    searchUserByUsername, 
    sendFriendRequest, 
    acceptRequest, 
    declineRequest,
    removeFriend
  };
}