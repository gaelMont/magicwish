// hooks/useTradeMatcher.ts
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'; 
import { useWishlists, WishlistMeta } from './useWishlists'; // <--- 1. Import WishlistMeta
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

  // 2. Correction ici : Remplacement de any[] par WishlistMeta[]
  const fetchAllCards = async (uid: string, mode: 'collection' | 'wishlist', userLists: WishlistMeta[] = []) => {
    const cardsMap = new Map<string, CardType>();

    if (mode === 'collection') {
        const snap = await getDocs(collection(db, 'users', uid, 'collection'));
        snap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
    } else {
        const defSnap = await getDocs(collection(db, 'users', uid, 'wishlist'));
        defSnap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
        
        if (userLists.length > 0) {
            for (const list of userLists) {
                 if (list.id === 'default') continue;
                 const snap = await getDocs(collection(db, 'users', uid, 'wishlists_data', list.id, 'cards'));
                 snap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
            }
        } else {
            const metaSnap = await getDocs(collection(db, 'users', uid, 'wishlists_meta'));
            for (const meta of metaSnap.docs) {
                const snap = await getDocs(collection(db, 'users', uid, 'wishlists_data', meta.id, 'cards'));
                snap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
            }
        }
    }
    return cardsMap;
  };

  const refreshPrices = async (cardsToUpdate: CardType[], uid: string, collectionName: string) => {
     if (cardsToUpdate.length === 0) return;

     const chunks = [];
     for (let i = 0; i < cardsToUpdate.length; i += 75) {
         chunks.push(cardsToUpdate.slice(i, i + 75));
     }

     const batch = writeBatch(db); 
     let hasUpdates = false;

     for (const chunk of chunks) {
         try {
             const identifiers = chunk.map(c => ({ id: c.id }));
             
             const res = await fetch('https://api.scryfall.com/cards/collection', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ identifiers })
             });

             if (!res.ok) continue;

             const data = await res.json();
             
             // 3. Correction ici : On utilise le commentaire spécial pour autoriser any juste ici
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const foundCards: any[] = data.data || [];

             foundCards.forEach(scryCard => {
                 const newPrice = parseFloat(scryCard.prices?.eur || "0");
                 const localCard = chunk.find(c => c.id === scryCard.id);

                 if (localCard && localCard.price !== newPrice) {
                     localCard.price = newPrice; 
                     
                     if (collectionName === 'collection') {
                         const ref = doc(db, 'users', uid, 'collection', localCard.id);
                         batch.update(ref, { price: newPrice });
                         hasUpdates = true;
                     }
                 }
             });
         } catch (e) { console.error("Err price fetch batch", e); }
     }

     if (hasUpdates) {
         await batch.commit();
     }
  };

  const runScan = async () => {
    if (!user || friends.length === 0) return;
    setLoading(true);
    setStatus("Chargement de vos données...");

    try {
        const myCollectionMap = await fetchAllCards(user.uid, 'collection');
        const myWishlistMap = await fetchAllCards(user.uid, 'wishlist', lists);

        const myWishlistNames = new Set<string>();
        const myWishlistIds = new Set<string>();

        myWishlistMap.forEach(card => {
            if (card.isSpecificVersion) {
                myWishlistIds.add(card.id);
            } else {
                myWishlistNames.add(card.name);
            }
        });

        const myCollectionNames = new Set<string>();
        myCollectionMap.forEach(card => myCollectionNames.add(card.name));

        const newProposals: TradeProposal[] = [];

        let i = 0;
        for (const friend of friends) {
            i++;
            setStatus(`Analyse de ${friend.username} (${i}/${friends.length})...`);
            
            const friendCollectionMap = await fetchAllCards(friend.uid, 'collection');
            const friendWishlistMap = await fetchAllCards(friend.uid, 'wishlist');

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            friendCollectionMap.forEach((card) => {
                if (myWishlistIds.has(card.id)) {
                    toReceive.push(card);
                } 
                else if (myWishlistNames.has(card.name)) {
                    toReceive.push(card);
                }
            });

            const friendWishlistNames = new Set<string>();
            const friendWishlistIds = new Set<string>();

            friendWishlistMap.forEach(c => {
                if (c.isSpecificVersion) friendWishlistIds.add(c.id);
                else friendWishlistNames.add(c.name);
            });

            myCollectionMap.forEach((card) => {
                if (friendWishlistIds.has(card.id)) {
                    toGive.push(card);
                }
                else if (friendWishlistNames.has(card.name)) {
                    toGive.push(card);
                }
            });

            if (toReceive.length > 0 || toGive.length > 0) {
                await refreshPrices(toReceive, friend.uid, 'collection');
                await refreshPrices(toGive, user.uid, 'collection');

                const valueReceive = toReceive.reduce((sum, c) => sum + (c.customPrice ?? c.price ?? 0), 0);
                const valueGive = toGive.reduce((sum, c) => sum + (c.customPrice ?? c.price ?? 0), 0);

                newProposals.push({
                    friend,
                    toReceive,
                    toGive,
                    balance: valueGive - valueReceive
                });
            }
        }

        setProposals(newProposals);

    } catch (error) {
        console.error("Erreur scan", error);
    } finally {
        setLoading(false);
        setStatus("");
    }
  };

  return { proposals, loading, status, runScan };
}