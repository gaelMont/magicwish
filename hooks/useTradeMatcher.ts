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

  // --- 1. CHARGEMENT OPTIMISÉ ---
  const fetchCardsAsMap = async (
      uid: string, 
      mode: 'collection' | 'wishlist', 
      userLists: WishlistMeta[] = [],
      // 'onlyTradeable' est retiré ou non utilisé ici car le filtre se fait côté client/mémoire
  ) => {
    const cardsMap = new Map<string, CardType>();

    try {
        if (mode === 'collection') {
            const colRef = collection(db, 'users', uid, 'collection');
            // Retrait de la query where('isForTrade', '==', true) 
            // pour charger toutes les cartes et filtrer sur quantityForTrade plus tard.
            const snap = await getDocs(colRef);
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

  // --- 2. MISE À JOUR PRIX CIBLÉE (TTL 48h) ---
  const refreshPricesForProposals = async (currentProposals: TradeProposal[], myUid: string) => {
     
     // Logique TTL de 48 heures
     const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
     const NOW = Date.now();

     // On extrait toutes les cartes uniques impliquées
     const cardsToCheckMap = new Map<string, { card: CardType, ownerUid: string, collection: string }>();

     currentProposals.forEach(p => {
         // Mes cartes à donner
         p.toGive.forEach(c => cardsToCheckMap.set(`${myUid}_${c.id}`, { card: c, ownerUid: myUid, collection: 'collection' }));
         // Cartes de l'ami à recevoir
         p.toReceive.forEach(c => cardsToCheckMap.set(`${p.friend.uid}_${c.id}`, { card: c, ownerUid: p.friend.uid, collection: 'collection' }));
     });

     const updatesArray = Array.from(cardsToCheckMap.values());
     
     // FILTRER SEULEMENT LES CARTES VIEILLES DE + DE 48H
     const cardsToUpdate = updatesArray.filter(item => {
         const lastUpdateMS = item.card.lastPriceUpdate instanceof Date ? item.card.lastPriceUpdate.getTime() : 0;
         const freshness = NOW - lastUpdateMS;
         return freshness > FORTY_EIGHT_HOURS_MS;
     });

     if (cardsToUpdate.length === 0) return;

     // On traite par paquets de 75 (limite Scryfall)
     const chunks = [];
     for (let i = 0; i < cardsToUpdate.length; i += 75) {
         chunks.push(cardsToUpdate.slice(i, i + 75));
     }

     const batch = writeBatch(db); 
     let hasUpdates = false;

     for (const chunk of chunks) {
         try {
             const identifiers = chunk.map(item => ({ id: item.card.id }));
             
             const res = await fetch('https://api.scryfall.com/cards/collection', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ identifiers })
             });

             if (!res.ok) continue;

             const data = await res.json() as ScryfallCollectionResponse;
             const foundCards = data.data || [];

             foundCards.forEach(scryCard => {
                 const newPrice = parseFloat(scryCard.prices.eur || "0");
                 
                 const localMatches = chunk.filter(item => item.card.id === scryCard.id);

                 localMatches.forEach(match => {
                     if (match.card.price !== newPrice) {
                         // 1. Update mémoire pour l'affichage immédiat
                         match.card.price = newPrice;
                         
                         // 2. Update Firestore : ON UPDATE MA CARTE ET LA CARTE DE L'AMI
                         const ref = doc(db, 'users', match.ownerUid, match.collection, match.card.id);
                         batch.update(ref, { 
                             price: newPrice,
                             lastPriceUpdate: new Date(), // <-- MARQUE L'HEURE D'ACTUALISATION
                         });
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
        // On charge tout, le filtre de trade se fait en mémoire après
        const [myCollectionMap, myWishlistMap] = await Promise.all([
            fetchCardsAsMap(user.uid, 'collection'), 
            fetchCardsAsMap(user.uid, 'wishlist', lists)
        ]);

        // B. Indexation de MA Wishlist
        const myWishlistIds = new Set<string>();
        const myWishlistNames = new Set<string>();
        myWishlistMap.forEach(c => {
            if (c.isSpecificVersion) myWishlistIds.add(c.id);
            else myWishlistNames.add(c.name);
        });

        // C. Indexation de MON Trade Binder (Filtrage sur la quantité)
        const myTradeCards = Array.from(myCollectionMap.values()).filter(c => (c.quantityForTrade ?? 0) > 0);

        setStatus(`Analyse simultanée de ${friends.length} amis...`);

        // D. SCAN PARALLÈLE DES AMIS
        const matchPromises = friends.map(async (friend) => {
            // On charge tout, le filtre de trade se fait en mémoire après
            const [friendCollectionMap, friendWishlistMap] = await Promise.all([
                fetchCardsAsMap(friend.uid, 'collection'),
                fetchCardsAsMap(friend.uid, 'wishlist')
            ]);
            
            // FILTRER SES CARTES ÉCHANGEABLES
            const friendTradeCards = Array.from(friendCollectionMap.values()).filter(c => (c.quantityForTrade ?? 0) > 0);

            const toReceive: CardType[] = [];
            const toGive: CardType[] = [];

            // 1. Check ce que JE reçois (Sa Collection [Tradeable] vs Ma Wishlist)
            friendTradeCards.forEach(card => {
                // On s'assure que la carte est bien marquée comme tradeable
                if ((card.quantityForTrade ?? 0) > 0) { 
                    if (myWishlistIds.has(card.id) || myWishlistNames.has(card.name)) {
                        toReceive.push(card);
                    }
                }
            });

            // 2. Check ce que JE donne (Ma Collection [Tradeable] vs Sa Wishlist)
            const friendWishlistIds = new Set<string>();
            const friendWishlistNames = new Set<string>();
            friendWishlistMap.forEach(c => {
                if (c.isSpecificVersion) friendWishlistIds.add(c.id);
                else friendWishlistNames.add(c.name);
            });

            myTradeCards.forEach(card => {
                // On s'assure que ma carte est bien marquée comme tradeable
                if ((card.quantityForTrade ?? 0) > 0) {
                    if (friendWishlistIds.has(card.id) || friendWishlistNames.has(card.name)) {
                        toGive.push(card);
                    }
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
            // APPEL PROACTIF DU TTL 48H SUR TOUTES LES CARTES IMPLIQUÉES
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