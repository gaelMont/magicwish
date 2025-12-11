// hooks/useTradeSystem.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, addDoc, query, where, onSnapshot, 
  doc, updateDoc, serverTimestamp, orderBy, 
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { CardType } from './useCardCollection';
import { useTradeTransaction } from './useTradeTransaction';
import toast from 'react-hot-toast';

export type TradeStatus = 'pending' | 'completed' | 'rejected' | 'cancelled';

export type TradeRequest = {
  id: string;
  senderUid: string;
  senderName: string;
  receiverUid: string;
  receiverName: string;
  itemsGiven: CardType[];
  itemsReceived: CardType[];
  status: TradeStatus;
  createdAt: Timestamp;
};

// --- UTILITAIRE DE NETTOYAGE ---
// Firestore déteste les valeurs "undefined". On les convertit en JSON "propre".
const cleanCardsForFirestore = (cards: CardType[]) => {
    return cards.map(card => {
        // On crée une copie superficielle
        const clean = { ...card };
        // On parcourt toutes les clés
        Object.keys(clean).forEach(key => {
            const k = key as keyof CardType;
            // Si une valeur est undefined, on supprime la clé
            if (clean[k] === undefined) {
                delete clean[k];
            }
        });
        return clean;
    });
};

export function useTradeSystem() {
  const { user, username } = useAuth();
  const { executeTrade, isProcessing: isTransactionProcessing } = useTradeTransaction();
  
  const [incomingTrades, setIncomingTrades] = useState<TradeRequest[]>([]);
  const [outgoingTrades, setOutgoingTrades] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Écouter les échanges
  useEffect(() => {
    if (!user) return;

    const qIn = query(
      collection(db, 'trades'),
      where('receiverUid', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const qOut = query(
      collection(db, 'trades'),
      where('senderUid', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubIn = onSnapshot(qIn, (snap) => {
      setIncomingTrades(snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest)));
    });

    const unsubOut = onSnapshot(qOut, (snap) => {
      setOutgoingTrades(snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest)));
      setLoading(false);
    });

    return () => { unsubIn(); unsubOut(); };
  }, [user]);

  // 2. Proposer (CORRIGÉ)
  const proposeTrade = async (receiverUid: string, receiverName: string, toGive: CardType[], toReceive: CardType[]) => {
    if (!user) return;
    const toastId = toast.loading("Envoi de la proposition...");

    try {
      // NETTOYAGE DES DONNÉES AVANT ENVOI
      const cleanGiven = cleanCardsForFirestore(toGive);
      const cleanReceived = cleanCardsForFirestore(toReceive);

      await addDoc(collection(db, 'trades'), {
        senderUid: user.uid,
        senderName: username || user.displayName || 'Inconnu',
        receiverUid,
        receiverName,
        itemsGiven: cleanGiven,    // <--- Utilisation des versions nettoyées
        itemsReceived: cleanReceived, // <--- Utilisation des versions nettoyées
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success("Proposition envoyée !", { id: toastId });
      return true;
    } catch (e) {
      console.error("Erreur Firestore:", e); // Ajout d'un log plus clair
      toast.error("Erreur envoi (voir console)", { id: toastId });
      return false;
    }
  };

  // 3. Accepter
  const acceptTrade = async (trade: TradeRequest) => {
    if (!user) return;
    
    // Inversion Sender/Receiver pour l'exécution
    const success = await executeTrade(
        trade.itemsReceived, 
        trade.itemsGiven,    
        trade.senderUid      
    );

    if (success) {
      await updateDoc(doc(db, 'trades', trade.id), { status: 'completed' });
    }
  };

  // 4. Refuser / Annuler
  const rejectTrade = async (tradeId: string) => {
    if(!confirm("Refuser cet échange ?")) return;
    await updateDoc(doc(db, 'trades', tradeId), { status: 'rejected' });
    toast.success("Échange refusé");
  };

  const cancelTrade = async (tradeId: string) => {
    if(!confirm("Annuler cette proposition ?")) return;
    await updateDoc(doc(db, 'trades', tradeId), { status: 'cancelled' });
    toast.success("Proposition annulée");
  };

  return { 
    incomingTrades, outgoingTrades, loading, 
    proposeTrade, acceptTrade, rejectTrade, cancelTrade,
    isProcessing: isTransactionProcessing 
  };
}