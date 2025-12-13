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

// Fonction utilitaire pour convertir les CardType du client vers le format attendu par le serveur
const mapCardsForServer = (cards: CardType[]) => {
    return cards.map(c => {
        const clean = { ...c };
        
        // Suppression des objets Firestore Timestamp (non sérialisables par Server Actions)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        delete clean.addedAt;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        delete clean.importedAt;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        delete clean.lastUpdated;
        
        // Suppression des champs qui peuvent être ajoutés par l'import/DB mais qui ne sont pas dans le CardSchema Zod
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error 
        delete clean.condition;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error 
        delete clean.language;

        return {
            ...clean,
            imageBackUrl: c.imageBackUrl || null,
            scryfallData: (c.scryfallData as Record<string, unknown>) || null
        };
    });
};

export function useTradeSystem() {
  const { user, username } = useAuth();
  
  const [incomingTrades, setIncomingTrades] = useState<TradeRequest[]>([]);
  const [outgoingTrades, setOutgoingTrades] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // NOTE: isProposing est retiré ici car géré localement par useTransition dans les pages

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
    
    // L'état de chargement local (isPending) est géré par useTransition
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
      const result = await proposeTradeAction(payload) as { 
          success: boolean; 
          error?: string; 
          proposalConflict?: boolean; // <--- Réponse de conflit
          existingTradeId?: string; 
      }; 

      if (result.success) {
          toast.success("Proposition envoyée !", { id: toastId });
          return true;
      } 
      else if (result.proposalConflict) {
          // GESTION DU CONFLIT DE PROPOSITION
          const friendName = receiverName || "cet ami";
          
          toast.error(`Vous avez déjà une proposition en attente avec ${friendName} pour ces cartes.`, { 
              id: toastId, 
              duration: 5000 
          });
          // Option future : ajouter ici un lien ou une modale pour éditer la proposition existante (ID: result.existingTradeId)
          
          return false; // Échec de la création, mais l'UI est informée
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
    isProcessing,
  };
}