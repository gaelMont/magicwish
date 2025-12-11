// hooks/useTradeMatcher.ts
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore'; 
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

  // --- 1. CHARGEMENT OPTIMISÉ (Retourne une Map directement) ---
  const fetchCardsAsMap = async (uid: string, mode: 'collection' | 'wishlist', userLists: WishlistMeta[] = []) => {
    const cardsMap = new Map<string, CardType>();

    try {
        if (mode === 'collection') {
            const snap = await getDocs(collection(db, 'users', uid, 'collection'));
            snap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
        } else {
            // Charge la liste par défaut
            const defSnap = await getDocs(collection(db, 'users', uid, 'wishlist'));
            defSnap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
            
            // Charge les listes customs en parallèle
            if (userLists.length > 0) {
                const listPromises = userLists
                    .filter(l => l.id !== 'default')
                    .map(list => getDocs(collection(db, 'users', uid, 'wishlists_data', list.id, 'cards')));
                
                const snapshots = await Promise.all(listPromises);
                snapshots.forEach(snap => {
                    snap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
                });
            } else {
                // Fallback si pas de userLists fournies (pour les amis) : on lit les métadonnées
                const metaSnap = await getDocs(collection(db, 'users', uid, 'wishlists_meta'));
                const listPromises = metaSnap.docs.map(m => getDocs(collection(db, 'users', uid, 'wishlists_data', m.id, 'cards')));
                const snapshots = await Promise.all(listPromises);
                snapshots.forEach(snap => {
                     snap.forEach(d => cardsMap.set(d.id, { id: d.id, ...d.data() } as CardType));
                });
            }
        }
    } catch (e) {
        console.error(`Erreur chargement ${mode} pour ${uid}`, e);
    }
    return cardsMap;
  };

  // --- 2. MISE À JOUR PRIX CIBLÉE (Uniquement sur les matchs) ---
  const refreshPricesForProposals = async (currentProposals: TradeProposal[], myUid: string) => {
     // On extrait toutes les cartes uniques impliquées
     const cardsToUpdateMap = new Map<string, { card: CardType, ownerUid: string, collection: string }>();

     currentProposals.forEach(p => {
         p.toReceive.forEach(c => cardsToUpdateMap.set(`${p.friend.uid}_${c.id}`, { card: c, ownerUid: p.friend.uid, collection: 'collection' }));
         p.toGive.forEach(c => cardsToUpdateMap.set(`${myUid}_${c.id}`, { card: c, ownerUid: myUid, collection: 'collection' }));
     });

     const updatesArray = Array.from(cardsToUpdateMap.values());
     if (updatesArray.length === 0) return;

     // On traite par paquets de 75 (limite Scryfall)
     const chunks = [];
     for (let i = 0; i < updatesArray.length; i += 75) {
         chunks.push(updatesArray.slice(i, i + 75));
     }

     const batch = writeBatch(db); 
     let hasUpdates = false;

     for (const chunk of chunks) {
         try {
             // On ne demande à Scryfall que les IDs
             const identifiers = chunk.map(item => ({ id: item.card.id }));
             
             const res = await fetch('https://api.scryfall.com/cards/collection', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ identifiers })
             });

             if (!res.ok) continue;

             const data = await res.json();
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const foundCards: any[] = data.data || [];

             foundCards.forEach(scryCard => {
                 const newPrice = parseFloat(scryCard.prices?.eur || "0");
                 
                 // On retrouve les cartes locales qui correspondent à cet ID Scryfall
                 // (Il peut y en avoir plusieurs si moi et mon ami avons la même carte)
                 const localMatches = chunk.filter(item => item.card.id === scryCard.id);

                 localMatches.forEach(match => {
                     // Si le prix a changé, on met à jour l'objet en mémoire ET Firestore
                     if (match.card.price !== newPrice) {
                         match.card.price = newPrice; // Update mémoire (ref)
                         
                         const ref = doc(db, 'users', match.ownerUid, match.collection, match.card.id);
                         batch.update(ref, { price: newPrice });
                         hasUpdates = true;
                     }
                 });
             });
         } catch (e) { console.error("Err price fetch batch", e); }
     }

     if (hasUpdates) {
         await batch.commit();
     }
  };

  // --- 3. ALGORITHME PRINCIPAL ---
  const runScan = async () => {
    if (!user || friends.length === 0) return;
    setLoading(true);
    setStatus("Chargement de vos données...");

    try {
        // A. Charger MES données
        const [myCollectionMap, myWishlistMap] = await Promise.all([
            fetchCardsAsMap(user.uid, 'collection'),
            fetchCardsAsMap(user.uid, 'wishlist', lists)
        ]);

        // B. Indexation de MA Wishlist (Set pour O(1))
        const myWishlistIds = new Set<string>();
        const myWishlistNames = new Set<string>();
        myWishlistMap.forEach(c => {
            if (c.isSpecificVersion) myWishlistIds.add(c.id);
            else myWishlistNames.add(c.name);
        });

        // C. Indexation de MON Trade Binder
        // On ne garde que celles que je veux échanger
        const myTradeCards = Array.from(myCollectionMap.values()).filter(c => c.isForTrade);

        setStatus(`Analyse simultanée de ${friends.length} amis...`);

        // D. SCAN PARALLÈLE DES AMIS
        const matchPromises = friends.map(async (friend) => {
            // Chargement parallèle des données de l'ami
            const [friendCollectionMap, friendWishlistMap] = await Promise.all([
                fetchCardsAsMap(friend.uid, 'collection'),
                fetchCardsAsMap(friend.uid, 'wishlist')
            ]);

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // 1. Check ce que JE reçois (Sa Collection vs Ma Wishlist)
            friendCollectionMap.forEach(card => {
                if (card.isForTrade) { // Il doit vouloir l'échanger
                    if (myWishlistIds.has(card.id) || myWishlistNames.has(card.name)) {
                        toReceive.push(card);
                    }
                }
            });

            // 2. Check ce que JE donne (Ma Collection vs Sa Wishlist)
            // Indexation rapide de SA wishlist
            const friendWishlistIds = new Set<string>();
            const friendWishlistNames = new Set<string>();
            friendWishlistMap.forEach(c => {
                if (c.isSpecificVersion) friendWishlistIds.add(c.id);
                else friendWishlistNames.add(c.name);
            });

            myTradeCards.forEach(card => {
                if (friendWishlistIds.has(card.id) || friendWishlistNames.has(card.name)) {
                    toGive.push(card);
                }
            });

            if (toReceive.length > 0 || toGive.length > 0) {
                return {
                    friend,
                    toReceive,
                    toGive,
                    balance: 0 // Sera calculé après refresh
                } as TradeProposal;
            }
            return null;
        });

        // Attente de tous les scans
        const results = await Promise.all(matchPromises);
        const validProposals = results.filter((p): p is TradeProposal => p !== null);

        // E. MISE À JOUR DES PRIX (Seulement pour les cartes matchées)
        if (validProposals.length > 0) {
            setStatus("Actualisation des prix...");
            await refreshPricesForProposals(validProposals, user.uid);
            
            // Recalcul des balances avec les prix frais
            validProposals.forEach(p => {
                const valReceive = p.toReceive.reduce((sum, c) => sum + (c.customPrice ?? c.price ?? 0), 0);
                const valGive = p.toGive.reduce((sum, c) => sum + (c.customPrice ?? c.price ?? 0), 0);
                p.balance = valGive - valReceive;
            });
        }

        setProposals(validProposals);

    } catch (error) {
        console.error("Erreur scan", error);
    } finally {
        setLoading(false);
        setStatus("");
    }
  };

  return { proposals, loading, status, runScan };
}