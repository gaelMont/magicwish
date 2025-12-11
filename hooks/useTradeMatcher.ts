// hooks/useTradeMatcher.ts
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useWishlists } from './useWishlists';
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

  const fetchAllCards = async (uid: string, mode: 'collection' | 'wishlist', userLists: any[] = []) => {
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
     for (const card of cardsToUpdate) {
         try {
             const res = await fetch(`https://api.scryfall.com/cards/${card.id}`);
             if (res.ok) {
                 const scryfallData = await res.json();
                 const newPrice = parseFloat(scryfallData.prices?.eur || "0");
                 
                 if (newPrice !== card.price) {
                     if (collectionName === 'collection') {
                        const ref = doc(db, 'users', uid, 'collection', card.id);
                        updateDoc(ref, { price: newPrice });
                     }
                     card.price = newPrice;
                 }
             }
         } catch (e) { console.error("Err price fetch", e); }
     }
  };

  const runScan = async () => {
    if (!user || friends.length === 0) return;
    setLoading(true);
    setStatus("Chargement de vos données...");

    try {
        // 1. CHARGER MES DONNÉES
        const myCollectionMap = await fetchAllCards(user.uid, 'collection');
        const myWishlistMap = await fetchAllCards(user.uid, 'wishlist', lists);

        // --- PRÉPARATION DE MA WISHLIST (HYBRIDE) ---
        const myWishlistNames = new Set<string>(); // Pour les cartes "N'importe quelle version"
        const myWishlistIds = new Set<string>();   // Pour les cartes "Version Exacte"

        myWishlistMap.forEach(card => {
            if (card.isSpecificVersion) {
                myWishlistIds.add(card.id); // ID Scryfall exact
            } else {
                myWishlistNames.add(card.name); // Nom uniquement
            }
        });

        // --- PRÉPARATION DE MA COLLECTION (POUR CE QUE JE DONNE) ---
        // Ici, c'est plus simple : on propose ce qu'on a. C'est l'autre qui décide si ça lui va.
        // Donc on garde Map et Noms pour matcher les désirs de l'autre.
        const myCollectionNames = new Set<string>();
        myCollectionMap.forEach(card => myCollectionNames.add(card.name));

        const newProposals: TradeProposal[] = [];

        // 2. BOUCLE SUR AMIS
        let i = 0;
        for (const friend of friends) {
            i++;
            setStatus(`Analyse de ${friend.username} (${i}/${friends.length})...`);
            
            const friendCollectionMap = await fetchAllCards(friend.uid, 'collection');
            const friendWishlistMap = await fetchAllCards(friend.uid, 'wishlist');

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // MATCH A : Ce qu'il a (sa Collection) que je veux (ma Wishlist)
            friendCollectionMap.forEach((card) => {
                // 1. Est-ce que cette carte précise est dans ma liste stricte ?
                if (myWishlistIds.has(card.id)) {
                    toReceive.push(card);
                } 
                // 2. Sinon, est-ce que son NOM est dans ma liste générique ?
                else if (myWishlistNames.has(card.name)) {
                    toReceive.push(card);
                }
            });

            // MATCH B : Ce que j'ai (ma Collection) qu'il veut (sa Wishlist)
            // On doit analyser SA wishlist pour savoir s'il est strict ou pas
            const friendWishlistNames = new Set<string>();
            const friendWishlistIds = new Set<string>();

            friendWishlistMap.forEach(c => {
                if (c.isSpecificVersion) friendWishlistIds.add(c.id);
                else friendWishlistNames.add(c.name);
            });

            myCollectionMap.forEach((card) => {
                // Même logique : est-ce que ma carte matche ses critères ?
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