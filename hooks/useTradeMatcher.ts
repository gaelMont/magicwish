import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { useWishlists, WishlistMeta } from './useWishlists';
import { useFriends, FriendProfile } from './useFriends';
import { CardType } from './useCardCollection';

export type TradeProposal = {
  friend: FriendProfile;
  toReceive: CardType[];
  toGive: CardType[];
  balance: number;
};

export function useTradeMatcher() {
  const { user } = useAuth();
  const { lists } = useWishlists();
  const { friends } = useFriends();
  
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const fetchCardsAsMap = async (
      uid: string, 
      subCollection: 'collection' | 'wishlist',
      userLists?: WishlistMeta[]
  ): Promise<Map<string, CardType>> => {
      const cardsMap = new Map<string, CardType>();
      const paths: string[] = [];

      if (subCollection === 'collection') {
          paths.push(`users/${uid}/collection/default/cards`);
      } else {
          if (userLists && userLists.length > 0) {
              userLists.forEach(list => paths.push(`users/${uid}/wishlist/${list.id}/cards`));
          } else {
              paths.push(`users/${uid}/wishlist/default/cards`);
              try {
                   const listsSnap = await getDocs(collection(db, `users/${uid}/wishlist`));
                   listsSnap.forEach(doc => {
                       const data = doc.data();
                       if (!data.scryfallId) { 
                           paths.push(`users/${uid}/wishlist/${doc.id}/cards`);
                       }
                   });
              } catch (error: unknown) {
                  console.error("Erreur lecture wishlists:", error);
              }
          }
      }

      const promises = paths.map(path => getDocs(collection(db, path)));
      
      try {
          const snapshots = await Promise.all(promises);
          snapshots.forEach(snap => {
              snap.forEach(doc => {
                  const data = doc.data() as CardType;
                  cardsMap.set(doc.id, { ...data, id: doc.id });
              });
          });
      } catch (error: unknown) {
          console.error(`Erreur fetchCardsAsMap (${subCollection}):`, error);
      }

      return cardsMap;
  };

  const getAllPartners = async (): Promise<FriendProfile[]> => {
      if (!user) return [];
      const partnersMap = new Map<string, FriendProfile>();

      friends.forEach(f => partnersMap.set(f.uid, f));

      try {
          const groupsQuery = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
          const groupsSnap = await getDocs(groupsQuery);
          
          const unknownUids = new Set<string>();
          
          groupsSnap.forEach(g => {
              const data = g.data();
              if (Array.isArray(data.members)) {
                  data.members.forEach((memberUid: string) => {
                      if (memberUid !== user.uid && !partnersMap.has(memberUid)) {
                          unknownUids.add(memberUid);
                      }
                  });
              }
          });

          for (const uid of Array.from(unknownUids)) {
              try {
                  const docSnap = await getDoc(doc(db, 'users', uid, 'public_profile', 'info'));
                  if (docSnap.exists()) {
                      const data = docSnap.data();
                      partnersMap.set(uid, {
                          uid: uid,
                          username: typeof data.username === 'string' ? data.username : 'Inconnu',
                          displayName: typeof data.displayName === 'string' ? data.displayName : 'Joueur',
                          photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined
                      });
                  }
              } catch (e: unknown) { 
                  console.error(`Erreur récupération profil ${uid}`, e); 
              }
          }

      } catch (e: unknown) {
          console.error("Erreur lors de la récupération des groupes", e);
      }

      return Array.from(partnersMap.values());
  };

  const runScan = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("Recensement des partenaires...");

    try {
        const allPartners = await getAllPartners();
        
        if (allPartners.length === 0) {
            setProposals([]);
            setLoading(false);
            setStatus("Aucun partenaire trouvé.");
            return;
        }

        const [myCollectionMap, myWishlistMap] = await Promise.all([
            fetchCardsAsMap(user.uid, 'collection'), 
            fetchCardsAsMap(user.uid, 'wishlist', lists)
        ]);

        const myWishlistIds = new Set<string>();
        const myWishlistNames = new Set<string>();
        
        myWishlistMap.forEach(c => {
            if (c.isSpecificVersion) myWishlistIds.add(c.id);
            else myWishlistNames.add(c.name);
        });

        const myTradeCards = Array.from(myCollectionMap.values()).filter(c => (c.quantityForTrade ?? 0) > 0);

        setStatus(`Analyse de ${allPartners.length} collections...`);

        const matchPromises = allPartners.map(async (partner) => {
            const [friendCollectionMap, friendWishlistMap] = await Promise.all([
                fetchCardsAsMap(partner.uid, 'collection'),
                fetchCardsAsMap(partner.uid, 'wishlist') 
            ]);
            
            const friendTradeCards = Array.from(friendCollectionMap.values()).filter(c => (c.quantityForTrade ?? 0) > 0);

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            friendTradeCards.forEach(card => {
                if (myWishlistIds.has(card.id) || myWishlistNames.has(card.name)) {
                    toReceive.push({ ...card });
                }
            });

            const friendWishlistIds = new Set<string>();
            const friendWishlistNames = new Set<string>();
            
            friendWishlistMap.forEach(c => {
                if (c.isSpecificVersion) friendWishlistIds.add(c.id);
                else friendWishlistNames.add(c.name);
            });

            myTradeCards.forEach(card => {
                if (friendWishlistIds.has(card.id) || friendWishlistNames.has(card.name)) {
                    toGive.push({ ...card });
                }
            });

            if (toReceive.length > 0 || toGive.length > 0) {
                return {
                    friend: partner, 
                    toReceive,
                    toGive,
                    balance: 0 
                } as TradeProposal;
            }
            return null;
        });

        const results = await Promise.all(matchPromises);
        const validProposals = results.filter((p): p is TradeProposal => p !== null);

        if (validProposals.length > 0) {
            setStatus("Finalisation...");
            
            validProposals.forEach(p => {
                const valReceive = p.toReceive.reduce((sum, c) => sum + ((c.customPrice ?? c.price ?? 0) * (c.quantity || 1)), 0);
                const valGive = p.toGive.reduce((sum, c) => sum + ((c.customPrice ?? c.price ?? 0) * (c.quantity || 1)), 0);
                p.balance = valGive - valReceive;
            });
        }

        setProposals(validProposals);

    } catch (error: unknown) {
        console.error("Erreur critique Scanner", error);
        setStatus("Erreur lors de l'analyse.");
    } finally {
        setLoading(false);
    }
  };

  return { proposals, loading, status, runScan };
}