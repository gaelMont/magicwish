// hooks/useTradeMatcher.ts
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore'; 
import { useWishlists, WishlistMeta } from './useWishlists'; 
import { useFriends, FriendProfile } from './useFriends';
import { CardType } from './useCardCollection';

export type TradeProposal = {
  friend: FriendProfile;
  toReceive: CardType[]; 
  toGive: CardType[];    
  balance: number;       
};

// Typage strict pour la réponse de l'API Scryfall dans refreshPrices
type ScryfallPriceUpdate = {
    id: string;
    prices: {
        eur: string | null;
        usd: string | null;
    };
};

type ScryfallCollectionResponse = {
    data: ScryfallPriceUpdate[];
    not_found?: unknown[];
    object: string;
};

export function useTradeMatcher() {
  const { user } = useAuth();
  const { lists } = useWishlists();
  const { friends } = useFriends();
  
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // --- 1. CHARGEMENT OPTIMISÉ (Avec filtrage 'isForTrade' côté serveur) ---
  const fetchCardsAsMap = async (
      uid: string, 
      mode: 'collection' | 'wishlist', 
      userLists: WishlistMeta[] = [],
      onlyTradeable: boolean = false // <--- Nouveau paramètre d'optimisation
  ) => {
    const cardsMap = new Map<string, CardType>();

    try {
        if (mode === 'collection') {
            const colRef = collection(db, 'users', uid, 'collection');
            
            // OPTIMISATION : Si on ne veut que les échanges, on filtre via Firestore (économie de lectures)
            let q;
            if (onlyTradeable) {
                q = query(colRef, where('isForTrade', '==', true));
            } else {
                q = colRef;
            }

            const snap = await getDocs(q);
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

  // --- 2. MISE À JOUR PRIX CIBLÉE (CORRIGÉE & STRICTE) ---
  const refreshPricesForProposals = async (currentProposals: TradeProposal[], myUid: string) => {
     // On extrait toutes les cartes uniques impliquées
     const cardsToUpdateMap = new Map<string, { card: CardType, ownerUid: string, collection: string }>();

     currentProposals.forEach(p => {
         // IMPORTANT: On ne mettra pas à jour les cartes de l'ami ici car on n'a pas les droits d'écriture
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

             // Typage strict de la réponse
             const data = await res.json() as ScryfallCollectionResponse;
             const foundCards = data.data || [];

             foundCards.forEach(scryCard => {
                 const newPrice = parseFloat(scryCard.prices.eur || "0");
                 
                 // On retrouve les cartes locales qui correspondent à cet ID Scryfall
                 const localMatches = chunk.filter(item => item.card.id === scryCard.id);

                 localMatches.forEach(match => {
                     // Update mémoire (ref) pour l'affichage immédiat
                     if (match.card.price !== newPrice) {
                         match.card.price = newPrice;
                         
                         // Update Firestore : UNIQUEMENT SI C'EST MA CARTE
                         if (match.ownerUid === myUid) {
                             const ref = doc(db, 'users', match.ownerUid, match.collection, match.card.id);
                             batch.update(ref, { price: newPrice });
                             hasUpdates = true;
                         }
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
        // OPTIMISATION: Pour ma collection, je ne charge que ce qui est "For Trade"
        const [myCollectionMap, myWishlistMap] = await Promise.all([
            fetchCardsAsMap(user.uid, 'collection', [], true), 
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
        // Note: myCollectionMap ne contient déjà QUE les cartes isForTrade grâce au filtre Firestore
        const myTradeCards = Array.from(myCollectionMap.values());

        setStatus(`Analyse simultanée de ${friends.length} amis...`);

        // D. SCAN PARALLÈLE DES AMIS
        const matchPromises = friends.map(async (friend) => {
            // OPTIMISATION: On ne charge que les cartes échangeables de l'ami
            const [friendCollectionMap, friendWishlistMap] = await Promise.all([
                fetchCardsAsMap(friend.uid, 'collection', [], true),
                fetchCardsAsMap(friend.uid, 'wishlist')
            ]);

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // 1. Check ce que JE reçois (Sa Collection [déjà filtrée Trade] vs Ma Wishlist)
            friendCollectionMap.forEach(card => {
                // Le check isForTrade est redondant ici si le serveur a bien filtré, mais on garde par sécurité
                if (card.isForTrade) { 
                    if (myWishlistIds.has(card.id) || myWishlistNames.has(card.name)) {
                        toReceive.push(card);
                    }
                }
            });

            // 2. Check ce que JE donne (Ma Collection vs Sa Wishlist)
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
                    balance: 0 
                } as TradeProposal;
            }
            return null;
        });

        const results = await Promise.all(matchPromises);
        const validProposals = results.filter((p): p is TradeProposal => p !== null);

        // E. MISE À JOUR DES PRIX (Seulement pour les cartes matchées)
        if (validProposals.length > 0) {
            setStatus("Actualisation des prix...");
            await refreshPricesForProposals(validProposals, user.uid);
            
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