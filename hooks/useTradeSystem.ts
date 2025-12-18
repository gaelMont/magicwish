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
import { proposeTradeAction } from '@/app/actions/trade-proposal'; 
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

// Interface stricte des données de carte sérialisables pour le serveur
interface ServerCardPayload {
    id: string;
    name: string;
    imageUrl: string;
    imageBackUrl: string | null;
    quantity: number;
    quantityForTrade: number; // AJOUT : requis pour être assignable à CardType
    price: number;
    customPrice?: number;
    setName: string;
    setCode: string;
    isFoil: boolean;
    isSpecificVersion: boolean;
    scryfallData: Record<string, unknown> | null;
    wishlistId: string | null;
}

// Fonction utilitaire pour convertir les CardType du client vers le format attendu par le serveur
const mapCardsForServer = (cards: CardType[]): ServerCardPayload[] => {
    return cards.map(c => {
        const payload: ServerCardPayload = {
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl,
            imageBackUrl: c.imageBackUrl ?? null,
            quantity: c.quantity,
            quantityForTrade: c.quantityForTrade ?? 0, // AJOUT : mapping de la valeur
            price: c.price ?? 0,
            customPrice: c.customPrice,
            setName: c.setName ?? '',
            setCode: c.setCode ?? '',
            isFoil: c.isFoil ?? false,
            isSpecificVersion: c.isSpecificVersion ?? false,
            scryfallData: (c.scryfallData as Record<string, unknown>) || null,
            wishlistId: c.wishlistId ?? null,
        };
        
        if (payload.customPrice === undefined) delete payload.customPrice;

        return payload;
    });
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
      // Cast en unknown puis CardType[] pour satisfaire TypeScript après avoir nettoyé l'objet
      const itemsGiven = mapCardsForServer(toGive) as unknown as CardType[];
      const itemsReceived = mapCardsForServer(toReceive) as unknown as CardType[];

      const payload = {
          senderUid: user.uid,
          senderName: username || user.displayName || 'Inconnu',
          receiverUid,
          receiverName,
          itemsGiven,
          itemsReceived
      };

      const result = await proposeTradeAction(payload) as { 
          success: boolean; 
          error?: string; 
          proposalConflict?: boolean;
          existingTradeId?: string; 
      }; 

      if (result.success) {
          toast.success("Proposition envoyée !", { id: toastId });
          return true;
      } 
      else if (result.proposalConflict) {
          const friendName = receiverName || "cet ami";
          
          toast.error(`Vous avez déjà une proposition en attente avec ${friendName} pour ces cartes.`, { 
              id: toastId, 
              duration: 5000 
          });
          
          return false;
      }
      else {
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
        const cleanGiven = mapCardsForServer(trade.itemsGiven) as unknown as CardType[];
        const cleanReceived = mapCardsForServer(trade.itemsReceived) as unknown as CardType[];
        
        const result = await executeServerTrade(
            trade.id, 
            trade.senderUid,
            user.uid, 
            cleanGiven, 
            cleanReceived 
        ) as { success: boolean; error?: string; };

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
    isProcessing,
  };
}