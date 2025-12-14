import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, writeBatch } from 'firebase/firestore';
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

  // --- 1. CHARGEMENT DES CARTES (Map) ---
  const fetchCardsAsMap = async (
      uid: string, 
      subCollection: 'collection' | 'wishlist',
      userLists?: WishlistMeta[]
  ): Promise<Map<string, CardType>> => {
      const cardsMap = new Map<string, CardType>();
      const paths: string[] = [];

      if (subCollection === 'collection') {
          paths.push(`users/${uid}/collection`); // Chemin simplifié (V2)
      } else {
          // Gestion des wishlists multiples
          if (userLists && userLists.length > 0) {
              userLists.forEach(list => paths.push(`users/${uid}/wishlists_data/${list.id}/cards`));
              // Toujours inclure la default si elle n'est pas dans la liste des metas (cas legacy)
              if (!userLists.some(l => l.id === 'default')) {
                  paths.push(`users/${uid}/wishlist`);
              }
          } else {
              // Fallback : On tente de récupérer la liste par défaut + on devine les autres
              paths.push(`users/${uid}/wishlist`);
              try {
                   const listsSnap = await getDocs(collection(db, `users/${uid}/wishlists_meta`));
                   listsSnap.forEach(doc => {
                       paths.push(`users/${uid}/wishlists_data/${doc.id}/cards`);
                   });
              } catch (error: unknown) {
                  // Silencieux si pas de permission ou collection vide
              }
          }
      }

      // Exécution parallèle
      const promises = paths.map(path => getDocs(collection(db, path)).catch(() => null));
      
      try {
          const snapshots = await Promise.all(promises);
          snapshots.forEach(snap => {
              if (snap) {
                  snap.forEach(doc => {
                      const data = doc.data() as CardType;
                      // On utilise l'ID comme clé. Si doublon (plusieurs wishlists), le dernier écrase.
                      cardsMap.set(doc.id, { ...data, id: doc.id });
                  });
              }
          });
      } catch (error: unknown) {
          console.error(`Erreur fetchCardsAsMap (${subCollection}):`, error);
      }

      return cardsMap;
  };

  // --- 2. RÉCUPÉRATION DE TOUS LES PARTENAIRES (AMIS + GROUPES) ---
  const getAllPartners = async (): Promise<FriendProfile[]> => {
      if (!user) return [];
      const partnersMap = new Map<string, FriendProfile>();

      // A. Amis directs
      friends.forEach(f => partnersMap.set(f.uid, f));

      // B. Membres des Playgroups
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

          // Récupération des profils manquants
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
                  console.error(`Erreur profil ${uid}`, e); 
              }
          }

      } catch (e: unknown) {
          console.error("Erreur groupes", e);
      }

      return Array.from(partnersMap.values());
  };

  // --- 3. ALGORITHME DE MATCHING ---
  const runScan = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("Recensement...");

    try {
        // 1. Identifier les partenaires
        const allPartners = await getAllPartners();
        
        if (allPartners.length === 0) {
            setProposals([]);
            setLoading(false);
            setStatus("Aucun partenaire trouvé.");
            return;
        }

        // 2. Charger MES données
        const [myCollectionMap, myWishlistMap] = await Promise.all([
            fetchCardsAsMap(user.uid, 'collection'), 
            fetchCardsAsMap(user.uid, 'wishlist', lists)
        ]);

        // Indexation de ma Wishlist (Set pour rapidité)
        const myWishlistIds = new Set<string>();
        const myWishlistNames = new Set<string>();
        
        myWishlistMap.forEach(c => {
            if (c.isSpecificVersion) myWishlistIds.add(c.id);
            else myWishlistNames.add(c.name);
        });

        // Indexation de mon Trade Binder (Ce que JE donne)
        // CORRECTION MAJEURE ICI : quantityForTrade > 0
        const myTradeCards = Array.from(myCollectionMap.values()).filter(c => (c.quantityForTrade ?? 0) > 0);

        setStatus(`Analyse de ${allPartners.length} collections...`);

        // 3. Scan Parallèle
        const matchPromises = allPartners.map(async (partner) => {
            const [friendCollectionMap, friendWishlistMap] = await Promise.all([
                fetchCardsAsMap(partner.uid, 'collection'),
                fetchCardsAsMap(partner.uid, 'wishlist') 
            ]);
            
            // Ce que L'AMI donne
            // CORRECTION MAJEURE ICI : quantityForTrade > 0
            const friendTradeCards = Array.from(friendCollectionMap.values()).filter(c => (c.quantityForTrade ?? 0) > 0);

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // A. MATCH : Ce qu'il a QUE JE VEUX (Je reçois)
            friendTradeCards.forEach(card => {
                if (myWishlistIds.has(card.id) || myWishlistNames.has(card.name)) {
                    toReceive.push({ ...card });
                }
            });

            // B. MATCH : Ce que j'ai QU'IL VEUT (Je donne)
            // On indexe sa wishlist à la volée
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

        // 4. Calcul des Balances
        if (validProposals.length > 0) {
            setStatus("Finalisation...");
            
            // On peut lancer une mise à jour des prix en tâche de fond ici si besoin
            // Pour l'instant on utilise les prix stockés
            
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