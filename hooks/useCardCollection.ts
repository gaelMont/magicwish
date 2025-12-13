// hooks/useCardCollection.ts
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

// Definition d'un type partiel pour Scryfall
type ScryfallDataRaw = {
    id: string;
    prices?: { eur?: string; usd?: string };
    [key: string]: unknown; 
};

export type CardType = {
  uid: string;
  id: string;
  name: string;
  imageUrl: string;
  imageBackUrl?: string | null;
  quantity: number;
  price?: number; 
  customPrice?: number;
  setName?: string;
  setCode?: string;
  wishlistId?: string;
  
  isFoil?: boolean;             
  isSpecificVersion?: boolean;
  
  // Remplacement de isForTrade
  quantityForTrade?: number; 
  
  lastPriceUpdate?: Date | null; 
  
  scryfallData?: Record<string, unknown>;
};

export function useCardCollection(
    target: 'collection' | 'wishlist', 
    listId: string = 'default',
    targetUid?: string
) {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveUid = targetUid || user?.uid;
  const isOwner = user?.uid === effectiveUid; 

  useEffect(() => {
    if (!effectiveUid || authLoading) {
        if (!authLoading) {
            setLoading(false);
            setCards([]); // Nettoie l'état si l'utilisateur se déconnecte
        }
        return; // Stoppe l'exécution si pas d'UID ou si l'authentification charge
    }
    setLoading(true);

    let collectionPath = '';
    if (target === 'collection') {
        collectionPath = `users/${effectiveUid}/collection`;
    } else {
        if (listId === 'default') collectionPath = `users/${effectiveUid}/wishlist`;
        else collectionPath = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
    }

    const colRef = collection(db, collectionPath);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        wishlistId: listId,
        ...doc.data(),
      })) as CardType[];
      setCards(items);
      setLoading(false);
    }, (error) => {
        // Gère les erreurs de permission lors de la déconnexion
        if (error.code === 'permission-denied') {
            console.warn(`useCardCollection: Permission refusée pour ${collectionPath}. Arrêt de l'écoute.`);
            setCards([]);
            setLoading(false);
        } else {
            console.error(`useCardCollection: Erreur inattendue sur ${collectionPath}:`, error);
        }
    });
    
    return () => unsubscribe();
  }, [effectiveUid, target, listId, authLoading]);

  // --- ACTIONS ---

  const getDocRef = (cardId: string) => {
      if (!isOwner || !effectiveUid) return null;
      let path = '';
      if (target === 'collection') path = `users/${effectiveUid}/collection`;
      else if (listId === 'default') path = `users/${effectiveUid}/wishlist`;
      else path = `users/${effectiveUid}/wishlists_data/${listId}/cards`;
      return doc(db, path, cardId);
  };

  const setCustomPrice = async (cardId: string, price: number) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { customPrice: price });
          toast.success("Prix mis à jour");
      }
  };

  // NOUVELLE FONCTION pour la quantité d'échange
  const setTradeQuantity = async (cardId: string, quantity: number) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { quantityForTrade: quantity });
      }
  };


  const toggleAttribute = async (
      cardId: string, 
      field: 'isFoil' | 'isSpecificVersion', // 'isForTrade' est retiré
      currentValue: boolean
  ) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { [field]: !currentValue });
      }
  };

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!isOwner) return;
    const ref = getDocRef(cardId);
    if (!ref) return;
    if (currentQuantity + amount <= 0) return 'shouldDelete';
    try {
      await updateDoc(ref, { quantity: increment(amount) });
      return 'updated';
    } catch (err) { return 'error'; }
  };

  const removeCard = async (cardId: string) => {
    if (!isOwner) return;
    const ref = getDocRef(cardId);
    if(ref) { await deleteDoc(ref); toast.success('Carte retirée', { icon: '🗑️' }); }
  };

  // --- MISE À JOUR GLOBALE DES PRIX ---
  const refreshCollectionPrices = async () => {
      if (!isOwner || cards.length === 0) return;
      const toastId = toast.loading(`Mise à jour des prix...`);

      // 1. DÉFINITION DE LA LOGIQUE TTL (48h pour toutes les cartes lors d'une action manuelle)
      const NOW = Date.now();
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

      const cardsToUpdate = cards.filter(card => {
          const lastUpdateMS = card.lastPriceUpdate instanceof Date ? card.lastPriceUpdate.getTime() : 0;
          const freshness = NOW - lastUpdateMS;

          return freshness > FORTY_EIGHT_HOURS_MS;
      });
      
      if (cardsToUpdate.length === 0) {
          toast.success("Prix déjà à jour !", { id: toastId });
          return;
      }
      
      // 2. LOGIQUE D'APPEL ET DE BATCH (Utilise cardsToUpdate)
      try {
          const chunks = [];
          for (let i = 0; i < cardsToUpdate.length; i += 75) {
              chunks.push(cardsToUpdate.slice(i, i + 75));
          }

          for (const chunk of chunks) {
              const identifiers = chunk.map(c => ({ id: c.id }));

              const res = await fetch('https://api.scryfall.com/cards/collection', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ identifiers })
              });

              if (!res.ok) continue;

              const data = await res.json();
              const foundCards = (data.data as ScryfallDataRaw[]) || [];
              
              const batch = writeBatch(db);
              let batchHasOps = false;

              foundCards.forEach(scryCard => {
                  const localCard = chunk.find(c => c.id === scryCard.id);
                  const newPrice = parseFloat(scryCard.prices?.eur || "0");

                  if (localCard) {
                      const ref = getDocRef(localCard.id);
                      if (ref) {
                          batch.update(ref, { 
                              price: newPrice,
                              lastPriceUpdate: new Date(),
                              scryfallData: scryCard as Record<string, unknown>
                          });
                          batchHasOps = true;
                      }
                  }
              });

              if (batchHasOps) await batch.commit();
              await new Promise(r => setTimeout(r, 100)); // Respect de la limite Scryfall
          }

          toast.success(`Succès : ${cardsToUpdate.length} cartes mises à jour !`, { id: toastId });

      } catch (e) {
          console.error(e);
          toast.error("Erreur lors de la mise à jour", { id: toastId });
      }
  };

  // --- GESTION DE MASSE DU CLASSEUR D'ÉCHANGE ---
  // Mise à jour pour utiliser setTradeQuantity (met à jour le nombre)
  const bulkSetTradeStatus = async (
      action: 'excess' | 'all' | 'reset', 
      threshold: number = 4
  ) => {
      if (!isOwner || cards.length === 0) return;
      
      const batch = writeBatch(db);
      let opCount = 0;
      let label = "";

      cards.forEach(card => {
          let shouldUpdate = false;
          let newValue = 0; 

          if (action === 'reset') {
              if ((card.quantityForTrade ?? 0) > 0) {
                  shouldUpdate = true;
                  newValue = 0;
              }
              label = "Remise à zéro";
          } 
          else if (action === 'all') {
              if ((card.quantityForTrade ?? 0) !== card.quantity) {
                  shouldUpdate = true;
                  newValue = card.quantity; // Met tout le stock à l'échange
              }
              label = "Tout ajouter";
          } 
          else if (action === 'excess') {
              const tradeableQty = Math.max(0, card.quantity - threshold);
              if ((card.quantityForTrade ?? 0) !== tradeableQty) {
                  shouldUpdate = true;
                  newValue = tradeableQty; // Met le surplus à l'échange
              }
          }

          if (shouldUpdate) {
              const ref = getDocRef(card.id);
              if (ref) {
                  batch.update(ref, { quantityForTrade: newValue });
                  opCount++;
              }
          }
      });

      if (opCount > 0) {
          await batch.commit();
          toast.success(`${opCount} cartes mises à jour (${action === 'excess' ? `Quantité > ${threshold}` : label})`);
      } else {
          toast(`Aucune carte ne correspond aux critères.`);
      }
  };

  // --- NOUVEAU : ACTIONS DE SÉLECTION MULTIPLE (Mise à jour) ---

  const bulkRemoveCards = async (cardIds: string[]) => {
      if (!isOwner || cardIds.length === 0) return;
      
      const batch = writeBatch(db);
      cardIds.forEach(id => {
          const ref = getDocRef(id);
          if (ref) batch.delete(ref);
      });

      await batch.commit();
      toast.success(`${cardIds.length} cartes supprimées`);
  };

  // Mise à jour pour gérer le statut de trade différemment
  const bulkUpdateAttribute = async (cardIds: string[], field: 'isFoil' | 'quantityForTrade' | 'isSpecificVersion', value: boolean | number) => {
      if (!isOwner || cardIds.length === 0) return;

      const batch = writeBatch(db);
      cardIds.forEach(id => {
          const ref = getDocRef(id);
          if (ref) {
             if (field === 'quantityForTrade') {
                 // Si on passe une valeur booléenne pour l'échange (ex: true/false), on la convertit en quantité 
                 const tradeQty = typeof value === 'boolean' ? (value ? 99 : 0) : value; // 99 si true
                 batch.update(ref, { [field]: tradeQty });
             } else {
                 batch.update(ref, { [field]: value });
             }
          }
      });

      await batch.commit();
      toast.success("Mise à jour effectuée");
  };

  const totalPrice = useMemo(() => {
    return cards.reduce((acc, card) => {
        const effectivePrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);
        return acc + effectivePrice * card.quantity;
    }, 0);
  }, [cards]);

  return { 
      cards, loading, isOwner, totalPrice,
      updateQuantity, removeCard, setCustomPrice, toggleAttribute,
      setTradeQuantity, // NOUVEAU
      refreshCollectionPrices, bulkSetTradeStatus,
      bulkRemoveCards, bulkUpdateAttribute 
  };
}