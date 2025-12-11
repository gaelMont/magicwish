// app/trades/page.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import { useTradeMatcher, TradeProposal } from '@/hooks/useTradeMatcher';
import { useTradeTransaction } from '@/hooks/useTradeTransaction'; // <--- IMPORT
import Link from 'next/link';
import { useCardCollection } from '@/hooks/useCardCollection'; 
import MagicCard from '@/components/MagicCard'; 

const TradeRow = ({ proposal, onTradeSuccess }: { proposal: TradeProposal, onTradeSuccess: () => void }) => {
    const { setCustomPrice } = useCardCollection('collection');
    
    // <--- NOUVEAU : Hook de transaction
    const { executeTrade, isProcessing } = useTradeTransaction(); 

    const totalGive = proposal.toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const totalReceive = proposal.toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const delta = totalGive - totalReceive;

    // Fonction de validation
    const handleConfirmTrade = async () => {
        const confirmMsg = `Valider cet échange avec ${proposal.friend.displayName} ?\n\n` +
                           `⚠ VOS CARTES SERONT RETIRÉES DE VOTRE COLLECTION.\n` +
                           `⚠ SES CARTES SERONT AJOUTÉES À LA VÔTRE.`;
        
        if (!confirm(confirmMsg)) return;

        const success = await executeTrade(proposal.toGive, proposal.toReceive, proposal.friend.uid);
        if (success) {
            onTradeSuccess(); // On demande au parent de rafraîchir ou retirer la ligne
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                        {proposal.friend.photoURL ? <img src={proposal.friend.photoURL} alt="" className="w-full h-full object-cover"/> : proposal.friend.username[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Échange avec {proposal.friend.displayName}</h2>
                        <Link href={`/user/${proposal.friend.uid}`} className="text-sm text-blue-600 hover:underline">Voir profil</Link>
                    </div>
                </div>

                {/* --- BOUTON DE VALIDATION AUTOMATIQUE --- */}
                <button
                    onClick={handleConfirmTrade}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition disabled:opacity-50 text-sm flex items-center gap-2"
                >
                    {isProcessing ? 'Traitement...' : '✅ Valider l\'échange'}
                </button>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-gray-100 dark:border-gray-700">
                <div className="p-4 bg-red-50/30 dark:bg-red-900/10">
                    <h3 className="font-bold text-red-600 dark:text-red-400 mb-4 flex justify-between">
                        📤 Je donne ({proposal.toGive.length})
                        <span className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{totalGive.toFixed(2)} €</span>
                    </h3>
                    <div className="space-y-3">
                        {proposal.toGive.map(card => (
                            <MagicCard 
                                key={card.id} {...card} isTradeView={true} allowPriceEdit={true}
                                onEditPrice={(newPrice) => setCustomPrice(card.id, newPrice)}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-green-50/30 dark:bg-green-900/10">
                    <h3 className="font-bold text-green-600 dark:text-green-400 mb-4 flex justify-between">
                        📥 Je reçois ({proposal.toReceive.length})
                        <span className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{totalReceive.toFixed(2)} €</span>
                    </h3>
                    <div className="space-y-3">
                         {proposal.toReceive.map(card => (
                            <MagicCard key={card.id} {...card} isTradeView={true} allowPriceEdit={false} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                <span className="text-sm text-gray-500">Balance :</span>
                <div className={`font-bold ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(delta) < 1 ? "Équitable" : delta > 0 ? `+${delta.toFixed(2)}€ pour toi` : `${delta.toFixed(2)}€`}
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
                <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400">🤝 Échanges</h1>
                <p className="text-gray-500 text-sm">Automatique ou Manuel</p>
            </div>
            
            <div className="flex gap-2">
                {/* --- LIEN VERS LE MODE MANUEL --- */}
                <Link href="/trades/manual" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-3 rounded-xl font-bold transition border border-gray-300">
                    🖐️ Mode Manuel
                </Link>

                <button 
                    onClick={runScan}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition disabled:opacity-50"
                >
                    {loading ? <span className="animate-pulse">{status}</span> : "🚀 Scanner Amis"}
                </button>
            </div>
        </div>

        {proposals.length === 0 && !loading && (
            <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                Cliquez sur &quot;Scanner&quot; pour les amis, ou utilisez le <Link href="/trades/manual" className="text-blue-500 underline">Mode Manuel</Link>.
            </div>
        )}

        <div className="space-y-8">
            {proposals.map(proposal => (
                <TradeRow 
                    key={proposal.friend.uid} 
                    proposal={proposal} 
                    onTradeSuccess={runScan} // On relance le scan après succès pour mettre à jour la liste
                />
            ))}
        </div>
    </main>
  );
}