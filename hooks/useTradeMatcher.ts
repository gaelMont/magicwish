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

  // --- 1. CHARGEMENT ROBUSTE (Gère les données manquantes et la rétrocompatibilité) ---
  const fetchCardsAsMap = async (
      uid: string, 
      subCollection: 'collection' | 'wishlist',
      userLists?: WishlistMeta[]
  ): Promise<Map<string, CardType>> => {
      const cardsMap = new Map<string, CardType>();
      const paths: string[] = [];

      // Déterminer les chemins de lecture
      if (subCollection === 'collection') {
          paths.push(`users/${uid}/collection`);
      } else {
          paths.push(`users/${uid}/wishlist`); // Liste par défaut (ancienne structure)
          if (userLists) {
              userLists.filter(l => l.id !== 'default').forEach(list => paths.push(`users/${uid}/wishlists_data/${list.id}/cards`));
          }
      }

      const promises = paths.map(path => getDocs(collection(db, path)).catch(() => null));
      const snapshots = await Promise.all(promises);

      snapshots.forEach(snap => {
          if (snap) {
              snap.forEach(doc => {
                  const data = doc.data();
                  
                  // --- VÉRIFICATION CRITIQUE DU STATUT TRADE ---
                  let computedTradeQty = 0;
                  if (typeof data.quantityForTrade === 'number') {
                      computedTradeQty = data.quantityForTrade; // Nouveau système
                  } else if (data.isForTrade === true) {
                      computedTradeQty = typeof data.quantity === 'number' ? data.quantity : 1; // Ancien système
                  }
                  
                  // --- CONSTRUCTION SÉCURISÉE DE L'OBJET CardType ---
                  const cleanCard: CardType = {
                      id: doc.id,
                      name: data.name || 'Carte Inconnue',
                      imageUrl: data.imageUrl || '',
                      imageBackUrl: data.imageBackUrl || null,
                      quantity: typeof data.quantity === 'number' ? data.quantity : 1,
                      price: typeof data.price === 'number' ? data.price : 0,
                      customPrice: data.customPrice,
                      setName: data.setName || '',
                      setCode: data.setCode || '',
                      isFoil: !!data.isFoil,
                      isSpecificVersion: !!data.isSpecificVersion,
                      quantityForTrade: computedTradeQty,
                      wishlistId: data.wishlistId || null,
                      scryfallData: data.scryfallData || null,
                      // On n'inclut pas le uid ici, car il est parfois undefined dans le type CardType, 
                      // on le gère avec l'objet parent si besoin.
                  };

                  cardsMap.set(doc.id, cleanCard);
              });
          }
      });

      return cardsMap;
  };

  // --- 2. RÉCUPÉRATION PARTENAIRES (Playgroups inclus) ---
  const getAllPartners = async (): Promise<FriendProfile[]> => {
      if (!user) return [];
      const partnersMap = new Map<string, FriendProfile>();

      friends.forEach(f => partnersMap.set(f.uid, f));

      try {
          const groupsQuery = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
          const groupsSnap = await getDocs(groupsQuery);
          
          const unknownUids = new Set<string>();
          groupsSnap.forEach(g => {
              const d = g.data();
              if (Array.isArray(d.members)) {
                  d.members.forEach((mUid: string) => {
                      if (mUid !== user.uid && !partnersMap.has(mUid)) unknownUids.add(mUid);
                  });
              }
          });

          for (const uid of Array.from(unknownUids)) {
              try {
                  const docSnap = await getDoc(doc(db, 'users', uid, 'public_profile', 'info'));
                  if (docSnap.exists()) {
                      const d = docSnap.data();
                      partnersMap.set(uid, {
                          uid,
                          username: d.username || 'Inconnu',
                          displayName: d.displayName || 'Joueur',
                          photoURL: d.photoURL || null
                      });
                  }
              } catch (e) { console.error(e); }
          }
      } catch (e) { console.error(e); }

      return Array.from(partnersMap.values());
  };

  // --- 3. ALGORITHME DE MATCHING (Aligné sur la notification) ---
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

        // 1. Charger MES données
        const [myCollectionMap, myWishlistMap] = await Promise.all([
            fetchCardsAsMap(user.uid, 'collection'), 
            fetchCardsAsMap(user.uid, 'wishlist', lists)
        ]);

        // 2. Indexation de MA Wishlist (PAR NOM - Match Souple)
        const myWishlistNames = new Set<string>();
        myWishlistMap.forEach(c => myWishlistNames.add(c.name));

        // 3. Indexation de MON Trade Binder (Filtré par Qty > 0)
        // CORRECTION CRITIQUE: on filtre par la quantité calculée dans fetchCardsAsMap
        const myTradeCards = Array.from(myCollectionMap.values()).filter(c => c.quantityForTrade > 0);

        setStatus(`Analyse de ${allPartners.length} collections...`);

        // 4. SCAN PARALLÈLE
        const matchPromises = allPartners.map(async (partner) => {
            const [friendCollectionMap, friendWishlistMap] = await Promise.all([
                fetchCardsAsMap(partner.uid, 'collection'),
                fetchCardsAsMap(partner.uid, 'wishlist') 
            ]);
            
            // FILTRE AMIS : Cartes dispo chez l'ami
            // CORRECTION CRITIQUE: On filtre par Qty > 0 calculée dans fetchCardsAsMap
            const friendTradeCards = Array.from(friendCollectionMap.values()).filter(c => c.quantityForTrade > 0);

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // A. JE REÇOIS (Match par Nom)
            friendTradeCards.forEach(card => {
                if (myWishlistNames.has(card.name)) {
                    toReceive.push({ ...card });
                }
            });

            // B. JE DONNE (Match par Nom)
            const friendWishlistNames = new Set<string>();
            friendWishlistMap.forEach(c => friendWishlistNames.add(c.name));

            myTradeCards.forEach(card => {
                if (friendWishlistNames.has(card.name)) {
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

        // 5. Calcul des Balances
        if (validProposals.length > 0) {
            setStatus("Finalisation...");
            
            validProposals.forEach(p => {
                // IMPORTANT: On utilise la quantité réelle (quantity) ici, pas quantityForTrade
                // car on veut la valeur totale du stock matché, mais on filtre sur quantityForTrade.
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