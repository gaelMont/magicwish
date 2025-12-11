// hooks/useTradeMatcher.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useWishlists } from './useWishlists';
import { useFriends, FriendProfile } from './useFriends';
import { CardType } from './useCardCollection';

export type TradeMatch = {
  card: CardType; // La carte que tu veux
  owners: FriendProfile[]; // Qui l'a ?
};

export function useTradeMatcher() {
  const { user } = useAuth();
  const { lists } = useWishlists(); // Pour savoir quoi chercher
  const { friends } = useFriends(); // Pour savoir chez qui chercher
  
  const [matches, setMatches] = useState<TradeMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);

  // Fonction qu'on appellera manuellement pour lancer le scan
  // (Pour éviter de cramer ton quota Firestore à chaque chargement de page)
  const runScan = async () => {
    if (!user || lists.length === 0 || friends.length === 0) return;
    
    setLoading(true);
    setMatches([]);
    setScannedCount(0);

    try {
        // 1. Récupérer TOUTE ma wishlist (comme la Vue Globale)
        // On fusionne tous les IDs de cartes que je veux
        const myWantedCardIds = new Set<string>();
        const myWantedCardsMap = new Map<string, CardType>();

        // A. Wishlist par défaut
        const defaultSnap = await getDocs(collection(db, 'users', user.uid, 'wishlist'));
        defaultSnap.forEach(doc => {
            myWantedCardIds.add(doc.id);
            myWantedCardsMap.set(doc.id, { id: doc.id, ...doc.data() } as CardType);
        });

        // B. Wishlists customs
        const customLists = lists.filter(l => l.id !== 'default');
        for (const list of customLists) {
            const snap = await getDocs(collection(db, 'users', user.uid, 'wishlists_data', list.id, 'cards'));
            snap.forEach(doc => {
                myWantedCardIds.add(doc.id);
                // On écrase si doublon, pas grave, c'est la même carte
                myWantedCardsMap.set(doc.id, { id: doc.id, ...doc.data() } as CardType);
            });
        }

        if (myWantedCardIds.size === 0) {
            setLoading(false);
            return; // Rien à chercher
        }

        // 2. Scanner les collections des amis
        const foundMatches = new Map<string, FriendProfile[]>();

        // On lance les requêtes en parallèle pour la vitesse
        const promises = friends.map(async (friend) => {
            const friendColRef = collection(db, 'users', friend.uid, 'collection');
            const snapshot = await getDocs(friendColRef);
            
            snapshot.forEach(doc => {
                // EST-CE QUE CETTE CARTE EST DANS MA LISTE ?
                if (myWantedCardIds.has(doc.id)) {
                    const currentOwners = foundMatches.get(doc.id) || [];
                    foundMatches.set(doc.id, [...currentOwners, friend]);
                }
            });
            setScannedCount(prev => prev + 1);
        });

        await Promise.all(promises);

        // 3. Formater le résultat
        const finalResults: TradeMatch[] = [];
        foundMatches.forEach((owners, cardId) => {
            const cardInfo = myWantedCardsMap.get(cardId);
            if (cardInfo) {
                finalResults.push({ card: cardInfo, owners });
            }
        });

        setMatches(finalResults);

    } catch (error) {
        console.error("Erreur scan trade", error);
    } finally {
        setLoading(false);
    }
  };

  return { matches, loading, runScan, friendCount: friends.length, scannedCount };
}