// hooks/useFriends.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { 
  doc, setDoc, deleteDoc, 
  collection, onSnapshot, serverTimestamp, writeBatch,
  query, collectionGroup, where, getDocs, limit 
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
      // CORRECTION : On ne set que si nécessaire pour éviter la boucle
      setFriends(prev => prev.length > 0 ? [] : prev);
      setRequestsReceived(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
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

  // 1. Rechercher des utilisateurs (Partiel : "Commence par...")
  const searchUsers = async (searchTerm: string) => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < 2) return [];

    // Technique Firestore pour "Starts With"
    const usersQuery = query(
      collectionGroup(db, 'public_profile'), // Cherche dans TOUS les profils publics
      where('username', '>=', term),
      where('username', '<=', term + '\uf8ff'),
      limit(5)
    );

    const snapshot = await getDocs(usersQuery);
    
    const results: FriendProfile[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Retrouver l'UID parent (users/{uid}/public_profile/info)
      const foundUid = doc.ref.parent.parent?.id;

      if (foundUid && foundUid !== user?.uid) {
        results.push({
            uid: foundUid,
            username: data.username,
            displayName: data.displayName,
            photoURL: data.photoURL
        });
      }
    });

    return results;
  };

  // 2. Envoyer une demande
  const sendFriendRequest = async (targetUser: FriendProfile) => {
    if (!user || !username) return;

    // Check si déjà ami
    if (friends.some(f => f.uid === targetUser.uid)) {
      toast.error("Vous êtes déjà amis !");
      return;
    }

    try {
      // On écrit dans SA collection 'friend_requests_received'
      await setDoc(doc(db, 'users', targetUser.uid, 'friend_requests_received', user.uid), {
        uid: user.uid,
        username: username,
        displayName: user.displayName,
        photoURL: user.photoURL,
        sentAt: serverTimestamp()
      });
      
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
      batch.set(myFriendRef, sender);

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
      toast.success(`Ami ajouté : @${sender.username}`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur validation");
    }
  };

  // 4. Refuser
  const declineRequest = async (senderUid: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'friend_requests_received', senderUid));
    toast.success("Demande supprimée");
  };
  
  // 5. Supprimer ami
  const removeFriend = async (friendUid: string) => {
      if(!user) return;
      if(!confirm("Retirer cet ami ?")) return;
      
      await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
      toast.success("Ami retiré");
  };

  return { 
    friends, 
    requestsReceived, 
    loading, 
    searchUsers, 
    sendFriendRequest, 
    acceptRequest, 
    declineRequest, 
    removeFriend
  };
}