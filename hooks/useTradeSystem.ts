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

export function useTradeSystem() {
  const { user, username } = useAuth();
  // Renommage pour éviter conflit de nom
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

  // 2. Proposer
  const proposeTrade = async (receiverUid: string, receiverName: string, toGive: CardType[], toReceive: CardType[]) => {
    if (!user) return;
    const toastId = toast.loading("Envoi de la proposition...");

    try {
      await addDoc(collection(db, 'trades'), {
        senderUid: user.uid,
        senderName: username || user.displayName || 'Inconnu',
        receiverUid,
        receiverName,
        itemsGiven: toGive,
        itemsReceived: toReceive,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success("Proposition envoyée !", { id: toastId });
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Erreur envoi", { id: toastId });
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