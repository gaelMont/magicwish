// hooks/useCardCollection.ts
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { updateUserStats } from '@/app/actions/stats';
import { checkAutoMatch, removeAutoMatchNotification } from '@/app/actions/matching';
import { refreshUserCollectionPrices } from '@/app/actions/collection'; 

export type CardType = {
  uid?: string;
  id: string;
  name: string;
  imageUrl: string;
  imageBackUrl: string | null;
  quantity: number;
  
  price?: number;         // Prix du marché (Scryfall)
  purchasePrice?: number; // NOUVEAU : Prix d'achat/échange (Historique)
  customPrice?: number;   // Prix temporaire ou forcé

  setName: string;
  setCode: string;
  wishlistId?: string | null;
  
  isFoil: boolean;             
  isSpecificVersion: boolean;
  quantityForTrade: number; 
  isForTrade?: boolean; 
  
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
  const isOwner = !!user && user.uid === effectiveUid; 

  // --- LECTURE TEMPS RÉEL ---
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
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        
        let lastUpdate: Date | null = null;
        if (data.lastPriceUpdate && typeof data.lastPriceUpdate.toDate === 'function') {
            lastUpdate = data.lastPriceUpdate.toDate();
        } else if (data.lastPriceUpdate instanceof Date) {
            lastUpdate = data.lastPriceUpdate;
        }

        return {
            id: doc.id,
            uid: effectiveUid,
            wishlistId: listId === 'default' ? null : listId,
            
            name: (data.name as string) || 'Carte Inconnue',
            imageUrl: (data.imageUrl as string) || '',
            imageBackUrl: (data.imageBackUrl as string) ?? null,
            
            quantity: typeof data.quantity === 'number' ? data.quantity : 1,
            
            price: typeof data.price === 'number' ? data.price : 0,
            
            // ICI : Lecture du nouveau champ purchasePrice
            purchasePrice: typeof data.purchasePrice === 'number' ? data.purchasePrice : undefined,
            
            customPrice: typeof data.customPrice === 'number' ? data.customPrice : undefined,

            setName: (data.setName as string) || '',
            setCode: (data.setCode as string) || '',
            
            isFoil: !!data.isFoil,
            isSpecificVersion: !!data.isSpecificVersion,
            quantityForTrade: typeof data.quantityForTrade === 'number' ? data.quantityForTrade : 0,
            isForTrade: !!data.isForTrade,
            
            lastPriceUpdate: lastUpdate,
            scryfallData: (data.scryfallData as Record<string, unknown>) || null
        } as CardType;
      });
      
      // On filtre les cartes à 0
      const validItems = items.filter(card => card.quantity > 0);

      setCards(validItems);
      setLoading(false);
    }, (error) => {
        console.error(`Erreur inattendue`, error);
    });
    
    return () => unsubscribe();
  }, [effectiveUid, target, listId, authLoading]);

  // --- ACTIONS ---

  const triggerStatsUpdate = () => {
      if (user?.uid && isOwner && target === 'collection') {
          updateUserStats(user.uid).catch(e => console.error("Erreur Stats BG", e));
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

  // Modification du prix d'achat (Historique) - NOUVEAU
  const setPurchasePrice = async (cardId: string, price: number) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { purchasePrice: price });
          toast.success("Prix d'acquisition enregistré");
      }
  };

  const setCustomPrice = async (cardId: string, price: number) => {
      if (!isOwner) return;
      const ref = getDocRef(cardId);
      if (ref) {
          await updateDoc(ref, { customPrice: price });
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
          await updateDoc(ref, { 
              quantityForTrade: safeQty,
              isForTrade: safeQty > 0 
          });
          
          if (safeQty > 0) {
              checkAutoMatch(user.uid, [{ id: card.id, name: card.name, isFoil: !!card.isFoil }])
                  .then(res => {
                      if (res.matches && res.matches > 0) {
                          toast(`Match trouvé !`, { icon: '🔔' });
                      }
                  });
          } else {
              removeAutoMatchNotification(user.uid, [card.id]);
          }
      }
  };

  const toggleAttribute = async (cardId: string, field: 'isFoil' | 'isSpecificVersion', currentValue: boolean) => {
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
      if (!isOwner || !user || cards.length === 0) return;
      const toastId = toast.loading("Actualisation des prix via le Cloud...");
      try {
          const result = await refreshUserCollectionPrices(user.uid);
          if (result.success) {
              toast.success(`${result.updatedCount} cartes mises à jour !`, { id: toastId });
          } else {
              throw new Error(result.error);
          }
      } catch (e: unknown) {
          console.error(e);
          toast.error("Erreur technique", { id: toastId });
      }
  };

  const bulkSetTradeStatus = async (action: 'excess' | 'all' | 'reset', threshold: number = 4) => {
      if (!isOwner || !user || cards.length === 0) return;
      const batch = writeBatch(db);
      let opCount = 0;
      const cardsToScan: { id: string, name: string, isFoil: boolean }[] = [];
      const cardsToRemoveNotif: string[] = [];

      cards.forEach(card => {
          let shouldUpdate = false;
          let newTradeQty = 0; 
          if (action === 'reset') {
              if (card.quantityForTrade > 0) { shouldUpdate = true; newTradeQty = 0; }
          } else if (action === 'all') {
              if (card.quantityForTrade !== card.quantity) { shouldUpdate = true; newTradeQty = card.quantity; }
          } else if (action === 'excess') {
              const tradeableQty = Math.max(0, card.quantity - threshold);
              if (card.quantityForTrade !== tradeableQty) { shouldUpdate = true; newTradeQty = tradeableQty; }
          }
          if (shouldUpdate) {
              const ref = getDocRef(card.id);
              if (ref) {
                  batch.update(ref, { quantityForTrade: newTradeQty, isForTrade: newTradeQty > 0 });
                  opCount++;
                  if (newTradeQty > 0) cardsToScan.push({ id: card.id, name: card.name, isFoil: !!card.isFoil });
                  else cardsToRemoveNotif.push(card.id);
              }
          }
      });

      if (opCount > 0) {
          await batch.commit();
          toast.success(`${opCount} cartes mises à jour`);
          if (cardsToScan.length > 0) checkAutoMatch(user.uid, cardsToScan);
          if (cardsToRemoveNotif.length > 0) removeAutoMatchNotification(user.uid, cardsToRemoveNotif);
      } else {
          toast("Aucune carte ne correspond aux critères.");
      }
  };

  const bulkRemoveCards = async (cardIds: string[]) => {
      if (!isOwner || !user || cardIds.length === 0) return;
      const batch = writeBatch(db);
      cardIds.forEach(id => { const ref = getDocRef(id); if (ref) batch.delete(ref); });
      await batch.commit();
      toast.success(`${cardIds.length} cartes supprimées`);
      triggerStatsUpdate();
      if (target === 'collection') removeAutoMatchNotification(user.uid, cardIds);
  };

  const bulkUpdateAttribute = async (cardIds: string[], field: 'quantityForTrade' | 'isFoil' | 'isSpecificVersion', value: boolean | number) => {
      if (!isOwner || !user || cardIds.length === 0) return;
      const batch = writeBatch(db);
      const cardsToScan: { id: string, name: string, isFoil: boolean }[] = [];
      const cardsToRemoveNotif: string[] = [];

      cardIds.forEach(id => {
          const ref = getDocRef(id);
          if (ref) {
             const updateData: Record<string, unknown> = { [field]: value };
             if (field === 'quantityForTrade') {
                 const numValue = value as number;
                 updateData.isForTrade = numValue > 0;
                 const card = cards.find(c => c.id === id);
                 if (card) {
                     if (numValue > 0) cardsToScan.push({ id: card.id, name: card.name, isFoil: !!card.isFoil });
                     else cardsToRemoveNotif.push(card.id);
                 }
             }
             batch.update(ref, updateData);
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
        const effectivePrice = card.price || 0; 
        return acc + effectivePrice * card.quantity;
    }, 0);
  }, [cards]);

  return { 
      cards, loading, isOwner, totalPrice,
      updateQuantity, removeCard, setCustomPrice, setPurchasePrice, toggleAttribute,
      setTradeQuantity, 
      refreshCollectionPrices, bulkSetTradeStatus,
      bulkRemoveCards, bulkUpdateAttribute 
  };
}