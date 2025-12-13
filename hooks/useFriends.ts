// hooks/useFriends.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { 
  doc, setDoc, deleteDoc, 
  collection, onSnapshot, serverTimestamp, 
  query, collectionGroup, where, getDocs, limit,
  writeBatch // <--- C'était l'import manquant
} from 'firebase/firestore';
import { acceptFriendRequestAction } from '@/app/actions/friends';
import toast from 'react-hot-toast';

export type FriendProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string; 
};

type FirestoreProfileData = {
    username: string;
    displayName: string;
    photoURL?: string;
    [key: string]: unknown;
};

export function useFriends() {
  const { user, username } = useAuth();
  
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requestsReceived, setRequestsReceived] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFriends(prev => prev.length > 0 ? [] : prev);
      setRequestsReceived(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
      return;
    }

    const friendsRef = collection(db, 'users', user.uid, 'friends');
    const unsubFriends = onSnapshot(friendsRef, (snap) => {
      const list = snap.docs.map(d => d.data() as FriendProfile);
      setFriends(list);
    });

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

  const searchUsers = async (searchTerm: string) => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < 2) return [];

    const usersQuery = query(
      collectionGroup(db, 'public_profile'), 
      where('username', '>=', term),
      where('username', '<=', term + '\uf8ff'),
      limit(5)
    );

    const snapshot = await getDocs(usersQuery);
    
    const results: FriendProfile[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as FirestoreProfileData;
      const foundUid = docSnap.ref.parent.parent?.id;

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

  const sendFriendRequest = async (targetUser: FriendProfile) => {
    if (!user || !username) return;

    if (friends.some(f => f.uid === targetUser.uid)) {
      toast.error("Vous êtes déjà amis !");
      return;
    }

    try {
      await setDoc(doc(db, 'users', targetUser.uid, 'friend_requests_received', user.uid), {
        uid: user.uid,
        username: username,
        displayName: user.displayName,
        photoURL: user.photoURL || null,
        sentAt: serverTimestamp()
      });
      
      toast.success(`Demande envoyée à @${targetUser.username}`);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'envoi.");
    }
  };

  const acceptRequest = async (sender: FriendProfile) => {
    if (!user) return;

    const toastId = toast.loading("Acceptation...");

    try {
        const cleanSender = {
            ...sender,
            photoURL: sender.photoURL || null
        };

        const result = await acceptFriendRequestAction(user.uid, cleanSender);

        if (result.success) {
            toast.success(`Ami ajouté : @${sender.username}`, { id: toastId });
        } else {
            throw new Error(result.error);
        }
    } catch (err: unknown) {
      console.error(err);
      let msg = "Erreur validation";
      if (err instanceof Error) msg = err.message;
      toast.error(msg, { id: toastId });
    }
  };

  const declineRequest = async (senderUid: string) => {
    if (!user) return;
    try {
        await deleteDoc(doc(db, 'users', user.uid, 'friend_requests_received', senderUid));
        toast.success("Demande supprimée");
    } catch (error) {
        console.error(error);
        toast.error("Erreur lors du refus");
    }
  };
  
  // Suppression avec nettoyage complet (nécessite writeBatch)
  const removeFriend = async (friendUid: string) => {
      if(!user) return;
      if(!confirm("Retirer cet ami définitivement ?")) return;
      
      try {
        const batch = writeBatch(db);
        
        // 1. Supprimer de MA liste
        batch.delete(doc(db, 'users', user.uid, 'friends', friendUid));
        
        // 2. Me supprimer de SA liste (Le "Unfriend" réciproque)
        // La règle de sécurité 'allow delete' doit être déployée pour que cela fonctionne
        batch.delete(doc(db, 'users', friendUid, 'friends', user.uid));

        await batch.commit();
        
        toast.success("Ami retiré (Liaison coupée)");
      } catch (error) {
        console.error("Erreur suppression ami:", error);
        toast.error("Erreur lors de la suppression");
      }
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