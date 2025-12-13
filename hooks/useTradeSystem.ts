// hooks/useTradeSystem.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, query, where, onSnapshot, 
  doc, updateDoc, orderBy, 
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { CardType } from './useCardCollection';
import { executeServerTrade } from '@/app/actions/trade'; 
import { proposeTradeAction } from '@/app/actions/trade-proposal'; // <--- IMPORT
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

// Fonction utilitaire pour convertir les CardType du client vers le format attendu par le serveur
// (Gère les incompatibilités de types strictes si nécessaire)
const mapCardsForServer = (cards: CardType[]) => {
    return cards.map(c => ({
        ...c,
        imageBackUrl: c.imageBackUrl || null,
        scryfallData: (c.scryfallData as Record<string, unknown>) || null
    }));
};

export function useTradeSystem() {
  const { user, username } = useAuth();
  
  const [incomingTrades, setIncomingTrades] = useState<TradeRequest[]>([]);
  const [outgoingTrades, setOutgoingTrades] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const proposeTrade = async (receiverUid: string, receiverName: string, toGive: CardType[], toReceive: CardType[]) => {
    if (!user) return false;
    const toastId = toast.loading("Envoi de la proposition...");

    try {
      // Préparation des données pour la Server Action
      const payload = {
          senderUid: user.uid,
          senderName: username || user.displayName || 'Inconnu',
          receiverUid,
          receiverName,
          itemsGiven: mapCardsForServer(toGive),
          itemsReceived: mapCardsForServer(toReceive)
      };

      // Appel de la Server Action
      const result = await proposeTradeAction(payload);

      if (result.success) {
          toast.success("Proposition envoyée !", { id: toastId });
          return true;
      } else {
          throw new Error(result.error);
      }

    } catch (e: unknown) {
      console.error("Erreur proposeTrade:", e);
      let msg = "Erreur envoi";
      if (e instanceof Error) msg = e.message;
      toast.error(msg, { id: toastId });
      return false;
    }
  };

  const acceptTrade = async (trade: TradeRequest) => {
    if (!user) return;
    
    setIsProcessing(true);
    const toastId = toast.loading("Validation sécurisée en cours...");

    try {
        // executeServerTrade attend toujours CardType[], on passe directement
        const result = await executeServerTrade(
            trade.id, 
            trade.senderUid,
            user.uid, 
            trade.itemsGiven,
            trade.itemsReceived
        );

        if (result.success) {
            toast.success("Échange terminé avec succès !", { id: toastId });
        } else {
            throw new Error(result.error || "Erreur serveur inconnue");
        }

    } catch (error: unknown) { 
        console.error("Erreur Accept Trade:", error);
        let msg = "Échec de l'échange";
        if (error instanceof Error) msg = error.message;
        else if (typeof error === "string") msg = error;
        toast.error(msg, { id: toastId });
    } finally {
        setIsProcessing(false);
    }
  };

  const rejectTrade = async (tradeId: string) => {
    if(!confirm("Refuser cet échange ?")) return;
    try {
        await updateDoc(doc(db, 'trades', tradeId), { status: 'rejected' });
        toast.success("Échange refusé");
    } catch (error) {
        console.error(error);
        toast.error("Erreur");
    }
  };

  const cancelTrade = async (tradeId: string) => {
    if(!confirm("Annuler cette proposition ?")) return;
    try {
        await updateDoc(doc(db, 'trades', tradeId), { status: 'cancelled' });
        toast.success("Proposition annulée");
    } catch (error) {
        console.error(error);
        toast.error("Erreur");
    }
  };

  return { 
    incomingTrades, outgoingTrades, loading, 
    proposeTrade, acceptTrade, rejectTrade, cancelTrade,
    isProcessing 
  };
}