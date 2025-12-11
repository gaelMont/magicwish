// app/trades/page.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useTradeMatcher, TradeProposal } from '@/hooks/useTradeMatcher';
import Link from 'next/link';
import { useCardCollection } from '@/hooks/useCardCollection'; 
import MagicCard from '@/components/MagicCard'; 

// Sous-composant pour afficher une ligne de proposition
const TradeRow = ({ proposal }: { proposal: TradeProposal }) => {
    // Calcul des totaux pour affichage
    const totalGive = proposal.toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const totalReceive = proposal.toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const delta = totalGive - totalReceive;

    // IMPORTANT : On récupère setCustomPrice pour pouvoir éditer NOS cartes
    const { setCustomPrice } = useCardCollection('collection');

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Header : L'ami */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                        {proposal.friend.photoURL ? <img src={proposal.friend.photoURL} alt="" className="w-full h-full object-cover"/> : proposal.friend.username[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Échange avec {proposal.friend.displayName}</h2>
                        <Link href={`/user/${proposal.friend.uid}`} className="text-sm text-blue-600 hover:underline">Voir son profil complet</Link>
                    </div>
                </div>
            </div>

            {/* Corps : Les 2 colonnes */}
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-gray-100 dark:border-gray-700">
                
                {/* 1. CE QUE JE DONNE (Mes cartes) */}
                <div className="p-4 bg-red-50/30 dark:bg-red-900/10">
                    <h3 className="font-bold text-red-600 dark:text-red-400 mb-4 flex items-center justify-between">
                        📤 Je donne ({proposal.toGive.length})
                        <span className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{totalGive.toFixed(2)} €</span>
                    </h3>
                    <div className="space-y-3">
                        {proposal.toGive.length === 0 ? <p className="text-sm italic text-gray-400">Rien à donner...</p> : 
                            proposal.toGive.map(card => (
                                <MagicCard 
                                    key={card.id} 
                                    {...card} 
                                    isTradeView={true} 
                                    allowPriceEdit={true} // J'ai le droit d'éditer MES prix
                                    // CONNEXION DU SETTER :
                                    onEditPrice={(newPrice) => setCustomPrice(card.id, newPrice)}
                                />
                            ))
                        }
                    </div>
                </div>

                {/* 2. CE QUE JE REÇOIS (Ses cartes) */}
                <div className="p-4 bg-green-50/30 dark:bg-green-900/10">
                    <h3 className="font-bold text-green-600 dark:text-green-400 mb-4 flex items-center justify-between">
                        📥 Je reçois ({proposal.toReceive.length})
                        <span className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{totalReceive.toFixed(2)} €</span>
                    </h3>
                    <div className="space-y-3">
                         {proposal.toReceive.length === 0 ? <p className="text-sm italic text-gray-400">Rien à recevoir...</p> : 
                            proposal.toReceive.map(card => (
                                <MagicCard 
                                    key={card.id} 
                                    {...card} 
                                    isTradeView={true} 
                                    allowPriceEdit={false} // Je ne touche pas à SES prix
                                />
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* Footer : La Balance */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                <span className="text-sm text-gray-500">Balance de l'échange :</span>
                <div className={`text-xl font-bold px-4 py-2 rounded-lg ${
                    Math.abs(delta) < 1 ? 'bg-gray-200 text-gray-700' : 
                    delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                    {Math.abs(delta) < 1 
                        ? "⚖️ Équitable" 
                        : delta > 0 
                            ? `Il te doit ${delta.toFixed(2)} €` 
                            : `Tu dois ${Math.abs(delta).toFixed(2)} €`
                    }
                </div>
            </div>
        </div>
    );
};

export default function TradesPage() {
  const { user } = useAuth();
  const { proposals, loading, status, runScan } = useTradeMatcher();

  if (!user) return <div className="p-10 text-center">Connectez-vous.</div>;

  return (
    <main className="container mx-auto p-4 max-w-5xl min-h-[80vh]">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400">🤝 Proposition d'Échanges</h1>
                <p className="text-gray-500 text-sm">Comparateur Réciproque : Wishlists vs Collections</p>
            </div>
            <button 
                onClick={runScan}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition disabled:opacity-50"
            >
                {loading ? <span className="animate-pulse">{status}</span> : "🚀 Lancer le comparateur"}
            </button>
        </div>

        {proposals.length === 0 && !loading && (
            <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                Cliquez sur &quot;Lancer&quot; pour trouver des opportunités d&apos;échange.
            </div>
        )}

        <div className="space-y-8">
            {proposals.map(proposal => (
                <TradeRow key={proposal.friend.uid} proposal={proposal} />
            ))}
        </div>
    </main>
  );
}