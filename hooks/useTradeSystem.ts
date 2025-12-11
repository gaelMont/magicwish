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
// ON IMPORTE L'ACTION SERVEUR
import { executeServerTrade } from '@/app/actions/trade'; 
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

// Utilitaire de nettoyage pour Firestore
const cleanCardsForFirestore = (cards: CardType[]) => {
    return cards.map(card => {
        const clean = { ...card };
        Object.keys(clean).forEach(key => {
            const k = key as keyof CardType;
            if (clean[k] === undefined) delete clean[k];
        });
        return clean;
    });
};

export function useTradeSystem() {
  const { user, username } = useAuth();
  
  const [incomingTrades, setIncomingTrades] = useState<TradeRequest[]>([]);
  const [outgoingTrades, setOutgoingTrades] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // État local

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
      const cleanGiven = cleanCardsForFirestore(toGive);
      const cleanReceived = cleanCardsForFirestore(toReceive);

      await addDoc(collection(db, 'trades'), {
        senderUid: user.uid,
        senderName: username || user.displayName || 'Inconnu',
        receiverUid,
        receiverName,
        itemsGiven: cleanGiven,    
        itemsReceived: cleanReceived, 
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success("Proposition envoyée !", { id: toastId });
      return true;
    } catch (e) {
      console.error("Erreur Firestore:", e);
      toast.error("Erreur envoi", { id: toastId });
      return false;
    }
  };

  // 3. Accepter (C'EST ICI QUE C'ÉTAIT FAUX DANS TON FICHIER ACTUEL)
  const acceptTrade = async (trade: TradeRequest) => {
    if (!user) return;
    
    setIsProcessing(true);
    const toastId = toast.loading("Validation sécurisée en cours...");

    try {
        // APPEL DE L'ACTION SERVEUR (Admin Mode)
        // Note: trade.itemsGiven = Ce que l'expéditeur donne
        // Note: trade.itemsReceived = Ce que l'expéditeur reçoit
        const result = await executeServerTrade(
            trade.senderUid,
            user.uid, // Je suis le receveur
            trade.itemsGiven,
            trade.itemsReceived
        );

        if (result.success) {
            // Si le serveur dit OK, on marque l'échange comme fini
            await updateDoc(doc(db, 'trades', trade.id), { status: 'completed' });
            toast.success("Échange terminé avec succès !", { id: toastId });
        } else {
            throw new Error(result.error || "Erreur serveur inconnue");
        }

    } catch (error: any) { 
        console.error("Erreur Accept Trade:", error);
        toast.error(error.message || "Échec de l'échange", { id: toastId });
    } finally {
        setIsProcessing(false);
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
    isProcessing 
  };
}