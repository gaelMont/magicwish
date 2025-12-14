import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { updateUserStats } from '@/app/actions/stats';
import { checkAutoMatch, removeAutoMatchNotification } from '@/app/actions/matching';

type ScryfallDataRaw = {
    id: string;
    prices?: { eur?: string; usd?: string };
    [key: string]: unknown; 
};

export type CardType = {
  uid?: string;
  id: string;
  name: string;
  imageUrl: string;
  imageBackUrl: string | null; // Strictement null si pas d'image
  quantity: number;
  price?: number; 
  customPrice?: number;
  setName: string;
  setCode: string;
  wishlistId?: string | null;
  
  isFoil: boolean;             
  isSpecificVersion: boolean;
  quantityForTrade: number; 
  
  lastPriceUpdate?: Date | null; 
  scryfallData?: Record<string, unknown> | null;
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
  // Correction : isOwner est false si user est null
  const isOwner = !!user && user.uid === effectiveUid; 

  useEffect(() => {
    if (!effectiveUid || authLoading) {
        if (!authLoading && !effectiveUid) {
            setLoading(false);
            setCards([]);
        }
        return;
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
      // --- NETTOYAGE DES DONNÉES À LA SOURCE ---
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            uid: effectiveUid, // On attache l'UID du propriétaire
            wishlistId: listId === 'default' ? null : listId,
            
            // Valeurs par défaut sécurisées (jamais undefined)
            name: data.name || 'Carte Inconnue',
            imageUrl: data.imageUrl || '',
            imageBackUrl: data.imageBackUrl ?? null, // Convertit undefined en null
            
            quantity: typeof data.quantity === 'number' ? data.quantity : 1,
            price: typeof data.price === 'number' ? data.price : 0,
            customPrice: data.customPrice, // Peut rester undefined (optionnel)
            
            setName: data.setName || '',
            setCode: data.setCode || '',
            
            isFoil: !!data.isFoil,
            isSpecificVersion: !!data.isSpecificVersion,
            quantityForTrade: typeof data.quantityForTrade === 'number' ? data.quantityForTrade : 0,
            
            lastPriceUpdate: data.lastPriceUpdate?.toDate ? data.lastPriceUpdate.toDate() : null,
            scryfallData: data.scryfallData || null
        } as CardType;
      });
      
      setCards(items);
      setLoading(false);
    }, (error) => {
        if (error.code === 'permission-denied') {
            console.warn(`Permission refusée pour ${collectionPath}`);
            setCards([]);
            setLoading(false);
        } else {
            console.error(`Erreur inattendue`, error);
        }
    });
    
    return () => unsubscribe();
  }, [effectiveUid, target, listId, authLoading]);

  // --- ACTIONS HELPER ---
  const triggerStatsUpdate = () => {
      if (user?.uid && isOwner) {
          updateUserStats(user.uid).catch(e => console.error("Stats BG error", e));
      }
  };

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
          triggerStatsUpdate();
      }
  };

  const setTradeQuantity = async (cardId: string, quantity: number) => {
      if (!isOwner || !user || target !== 'collection') return;
      
      const card = cards.find(c => c.id === cardId);
      if (!card) return;

      const maxQty = card.quantity;
      const safeQty = Math.min(maxQty, Math.max(0, quantity));
      
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { quantityForTrade: safeQty });
          
          if (safeQty > 0) {
              checkAutoMatch(user.uid, [{ id: card.id, name: card.name, isFoil: !!card.isFoil }])
                  .then(res => {
                      if (res.matches && res.matches > 0) toast(`🎉 ${res.matches} Matchs trouvés !`, { icon: '🔔' });
                  });
          } else {
              removeAutoMatchNotification(user.uid, [card.id]);
          }
      }
  };

  const toggleAttribute = async (
      cardId: string, 
      field: 'isFoil' | 'isSpecificVersion', 
      currentValue: boolean
  ) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { [field]: !currentValue });
          if (field === 'isFoil') triggerStatsUpdate();
      }
  };

  const updateQuantity = async (cardId: string, amount: number, currentQuantity: number) => {
    if (!isOwner) return;
    const ref = getDocRef(cardId);
    if (!ref) return;
    if (currentQuantity + amount <= 0) return 'shouldDelete';
    try {
      await updateDoc(ref, { quantity: increment(amount) });
      triggerStatsUpdate();
      return 'updated';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) { return 'error'; }
  };

  const removeCard = async (cardId: string) => {
    if (!isOwner) return;
    const ref = getDocRef(cardId);
    if(ref) { 
        await deleteDoc(ref); 
        toast.success('Carte retirée');
        triggerStatsUpdate();
        if (target === 'collection' && user) {
            removeAutoMatchNotification(user.uid, [cardId]);
        }
    }
  };

  const refreshCollectionPrices = async () => {
      if (!isOwner || cards.length === 0) return;
      const toastId = toast.loading(`Mise à jour des prix...`);

      const NOW = Date.now();
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

      const cardsToUpdate = cards.filter(card => {
          const lastUpdateMS = card.lastPriceUpdate ? card.lastPriceUpdate.getTime() : 0;
          return (NOW - lastUpdateMS) > FORTY_EIGHT_HOURS_MS;
      });
      
      if (cardsToUpdate.length === 0) {
          toast.success("Prix déjà à jour !", { id: toastId });
          return;
      }
      
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
              await new Promise(r => setTimeout(r, 100));
          }

          toast.success(`Succès : ${cardsToUpdate.length} cartes mises à jour !`, { id: toastId });
          triggerStatsUpdate();

      } catch (e: unknown) {
          console.error(e);
          toast.error("Erreur lors de la mise à jour", { id: toastId });
      }
  };

  const bulkSetTradeStatus = async (
      action: 'excess' | 'all' | 'reset', 
      threshold: number = 4
  ) => {
      if (!isOwner || !user || cards.length === 0) return;
      
      const batch = writeBatch(db);
      let opCount = 0;

      const cardsToScan: { id: string, name: string, isFoil: boolean }[] = [];
      const cardsToRemoveNotif: string[] = [];

      cards.forEach(card => {
          let shouldUpdate = false;
          let newValue = 0; 

          if (action === 'reset') {
              if ((card.quantityForTrade ?? 0) > 0) {
                  shouldUpdate = true;
                  newValue = 0;
              }
          } 
          else if (action === 'all') {
              if ((card.quantityForTrade ?? 0) !== card.quantity) {
                  shouldUpdate = true;
                  newValue = card.quantity;
              }
          } 
          else if (action === 'excess') {
              const tradeableQty = Math.max(0, card.quantity - threshold);
              if ((card.quantityForTrade ?? 0) !== tradeableQty) {
                  shouldUpdate = true;
                  newValue = tradeableQty;
              }
          }

          if (shouldUpdate) {
              const ref = getDocRef(card.id);
              if (ref) {
                  batch.update(ref, { quantityForTrade: newValue });
                  opCount++;

                  if (newValue > 0) {
                      cardsToScan.push({ id: card.id, name: card.name, isFoil: !!card.isFoil });
                  } else {
                      cardsToRemoveNotif.push(card.id);
                  }
              }
          }
      });

      if (opCount > 0) {
          await batch.commit();
          toast.success(`${opCount} cartes mises à jour`);

          if (cardsToScan.length > 0) {
              checkAutoMatch(user.uid, cardsToScan).then(res => {
                  if (res.matches && res.matches > 0) toast(`🎉 ${res.matches} Matchs trouvés !`, { icon: '🔔' });
              });
          }

          if (cardsToRemoveNotif.length > 0) {
              removeAutoMatchNotification(user.uid, cardsToRemoveNotif);
          }

      } else {
          toast(`Aucune carte ne correspond aux critères.`);
      }
  };

  const bulkRemoveCards = async (cardIds: string[]) => {
      if (!isOwner || !user || cardIds.length === 0) return;
      
      const batch = writeBatch(db);
      cardIds.forEach(id => {
          const ref = getDocRef(id);
          if (ref) batch.delete(ref);
      });

      await batch.commit();
      toast.success(`${cardIds.length} cartes supprimées`);
      triggerStatsUpdate();
      
      if (target === 'collection') {
          removeAutoMatchNotification(user.uid, cardIds);
      }
  };

  const bulkUpdateAttribute = async (cardIds: string[], field: 'quantityForTrade' | 'isFoil' | 'isSpecificVersion', value: boolean | number) => {
      if (!isOwner || !user || cardIds.length === 0) return;

      const batch = writeBatch(db);
      const cardsToScan: { id: string, name: string, isFoil: boolean }[] = [];
      const cardsToRemoveNotif: string[] = [];

      cardIds.forEach(id => {
          const ref = getDocRef(id);
          if (ref) {
             batch.update(ref, { [field]: value });
             
             if (field === 'quantityForTrade') {
                 const card = cards.find(c => c.id === id);
                 if (card) {
                     const numValue = value as number;
                     if (numValue > 0) {
                         cardsToScan.push({ id: card.id, name: card.name, isFoil: !!card.isFoil });
                     } else {
                         cardsToRemoveNotif.push(card.id);
                     }
                 }
             }
          }
      });

      await batch.commit();
      toast.success("Mise à jour effectuée");
      if (field === 'isFoil') triggerStatsUpdate();

      if (cardsToScan.length > 0) checkAutoMatch(user.uid, cardsToScan);
      if (cardsToRemoveNotif.length > 0) removeAutoMatchNotification(user.uid, cardsToRemoveNotif);
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
      setTradeQuantity, 
      refreshCollectionPrices, bulkSetTradeStatus,
      bulkRemoveCards, bulkUpdateAttribute 
  };
}