// hooks/useTradeMatcher.ts
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { runServerScan, ScannedProposal } from '@/app/actions/scanner';
import { FriendProfile } from './useFriends';
import { CardType } from '@/hooks/useCardCollection';

// Export du type nécessaire pour app/trades/page.tsx
export type TradeProposal = {
  friend: FriendProfile;
  toReceive: CardType[]; 
  toGive: CardType[];    
  balance: number;       
};

export function useTradeMatcher() {
  const { user } = useAuth();
  
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const runScan = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("Analyse cloud en cours...");

    try {
        // Appel de la Server Action définie dans app/actions/scanner.ts
        const result = await runServerScan(user.uid);

        if (!result.success || !result.proposals) {
            setStatus("Erreur lors de l'analyse.");
            setLoading(false);
            return;
        }

        // Mapping des résultats du serveur (ScannedProposal) vers le format client (TradeProposal)
        const mappedProposals: TradeProposal[] = result.proposals.map((p: ScannedProposal) => ({
            friend: {
                uid: p.partnerInfo.uid,
                username: 'Utilisateur', // Valeur par défaut car non critique pour l'affichage ici
                displayName: p.partnerInfo.displayName,
                photoURL: p.partnerInfo.photoURL || undefined // Conversion null -> undefined pour le type FriendProfile
            },
            toReceive: p.toReceive,
            toGive: p.toGive,
            balance: p.balance
        }));

        setProposals(mappedProposals);
        
        if (mappedProposals.length > 0) {
            setStatus("Scan termine avec succes.");
        } else {
            setStatus("Aucun echange trouve.");
        }

    } catch (error: unknown) {
        console.error("Erreur hook scanner:", error);
        setStatus("Erreur technique lors du scan.");
    } finally {
        setLoading(false);
    }
  };

  return { proposals, loading, status, runScan }; 
}