'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTradeMatcher, TradeProposal } from '@/hooks/useTradeMatcher';
import { useTradeSystem, TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { useCardCollection, CardType } from '@/hooks/useCardCollection'; 
import MagicCard from '@/components/MagicCard'; 

const IncomingRequestCard = ({ trade }: { trade: TradeRequest }) => {
    // ... (Code existant inchangé)
    const { acceptTrade, rejectTrade, isProcessing } = useTradeSystem();
    const [isOpen, setIsOpen] = useState(false);

    const valReceive = trade.itemsGiven.reduce((acc: number, c: CardType) => acc + (c.price || 0), 0); 
    const valGive = trade.itemsReceived.reduce((acc: number, c: CardType) => acc + (c.price || 0), 0);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-blue-500 shadow-sm p-4 mb-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Proposition de {trade.senderName}</h3>
                    <p className="text-sm text-gray-500">
                        Tu recois <span className="text-green-600 font-bold">{trade.itemsGiven.length} cartes</span> (~{valReceive.toFixed(0)}EUR) 
                        contre <span className="text-red-600 font-bold">{trade.itemsReceived.length} cartes</span> (~{valGive.toFixed(0)}EUR)
                    </p>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                    <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-gray-500 underline mr-2">
                        {isOpen ? 'Masquer' : 'Details'}
                    </button>
                    <button 
                        onClick={() => rejectTrade(trade.id)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition"
                    >
                        Refuser
                    </button>
                    <button 
                        onClick={() => acceptTrade(trade)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
                    >
                        {isProcessing ? '...' : 'Accepter'}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid md:grid-cols-2 gap-4">
                    <div className="bg-green-50/50 p-3 rounded">
                        <p className="text-xs font-bold text-green-700 mb-2">Tu vas recevoir :</p>
                        <div className="flex flex-wrap gap-2">
                            {trade.itemsGiven.map((c: CardType) => (
                                <div key={c.id} className="relative group w-12 h-16 bg-gray-200 rounded overflow-hidden">
                                     <img src={c.imageUrl} className="w-full h-full object-cover" alt="" title={c.name} />
                                     <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1">{c.quantity}x</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-red-50/50 p-3 rounded">
                        <p className="text-xs font-bold text-red-700 mb-2">Tu vas donner :</p>
                         <div className="flex flex-wrap gap-2">
                            {trade.itemsReceived.map((c: CardType) => (
                                <div key={c.id} className="relative group w-12 h-16 bg-gray-200 rounded overflow-hidden">
                                     <img src={c.imageUrl} className="w-full h-full object-cover" alt="" title={c.name} />
                                     <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1">{c.quantity}x</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TradeRowProposal = ({ proposal, onProposalSent }: { proposal: TradeProposal, onProposalSent: () => void }) => {
    // ... (Code existant inchangé)
    const { setCustomPrice } = useCardCollection('collection');
    const { proposeTrade } = useTradeSystem(); 

    const totalGive = proposal.toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const totalReceive = proposal.toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const delta = totalGive - totalReceive;

    const handlePropose = async () => {
        const success = await proposeTrade(
            proposal.friend.uid,
            proposal.friend.displayName,
            proposal.toGive,
            proposal.toReceive 
        );
        if (success) onProposalSent();
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-8 shrink-0">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                        {proposal.friend.photoURL ? <img src={proposal.friend.photoURL} alt="" className="w-full h-full object-cover"/> : proposal.friend.username[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Potentiel avec {proposal.friend.displayName}</h2>
                        <Link href={`/user/${proposal.friend.uid}`} className="text-sm text-blue-600 hover:underline">Voir profil</Link>
                    </div>
                </div>
                <button
                    onClick={handlePropose}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition text-sm flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    Proposer l&apos;echange
                </button>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-gray-100 dark:border-gray-700">
                <div className="p-4 bg-red-50/30 dark:bg-red-900/10">
                    <h3 className="font-bold text-red-600 dark:text-red-400 mb-4 flex justify-between">
                        Tu donnerais ({proposal.toGive.length})
                        <span className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{totalGive.toFixed(2)} EUR</span>
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
                        Tu recevrais ({proposal.toReceive.length})
                        <span className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{totalReceive.toFixed(2)} EUR</span>
                    </h3>
                    <div className="space-y-3">
                         {proposal.toReceive.map(card => (
                            <MagicCard key={card.id} {...card} isTradeView={true} allowPriceEdit={false} />
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="p-2 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
                Balance : {delta.toFixed(2)} EUR
            </div>
        </div>
    );
};

export default function TradesPage() {
  const { user } = useAuth();
  const { proposals, loading, status, runScan } = useTradeMatcher();
  const { incomingTrades, outgoingTrades, cancelTrade } = useTradeSystem(); 
  const [activeTab, setActiveTab] = useState<'scan' | 'requests'>('scan');

  if (!user) return <div className="p-10 text-center">Connectez-vous.</div>;

  return (
    <main className="container mx-auto p-4 max-w-5xl h-[calc(100vh-64px)] flex flex-col">
        
        <div className="flex-none flex flex-col md:flex-row justify-between items-end mb-4 gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
            <div>
                <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400">Centre d&apos;Echanges</h1>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={() => setActiveTab('scan')}
                    className={`pb-2 px-2 font-bold transition ${activeTab === 'scan' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Scanner ({proposals.length})
                </button>
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`pb-2 px-2 font-bold transition relative ${activeTab === 'requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Demandes 
                    {incomingTrades.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full align-top">{incomingTrades.length}</span>}
                </button>
            </div>
        </div>

        <div className="grow overflow-y-auto custom-scrollbar pb-10">
            
            {activeTab === 'scan' && (
                <div className="animate-in fade-in">
                    {/* EN-TÊTE SCANNER MOBILE FRIENDLY */}
                    <div className="flex flex-col sm:flex-row justify-end mb-6 gap-3 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 py-2">
                         <Link href="/trades/manual" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold transition text-sm flex items-center justify-center">
                            Mode Manuel
                        </Link>
                        <button onClick={runScan} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold shadow transition text-sm disabled:opacity-50 w-full sm:w-auto">
                            {loading ? status : "Lancer le Scanner"}
                        </button>
                    </div>

                    {proposals.length === 0 && !loading && (
                        <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                            Lancez le scanner pour trouver des &quot;matchs&quot; avec vos amis.
                        </div>
                    )}

                    <div className="space-y-8">
                        {proposals.map(proposal => (
                            <TradeRowProposal key={proposal.friend.uid} proposal={proposal} onProposalSent={runScan} />
                        ))}
                    </div>
                </div>
            )}

            {/* ... (Reste inchangé) ... */}
            {activeTab === 'requests' && (
                <div className="animate-in fade-in space-y-8">
                    <div>
                        <h2 className="font-bold text-gray-500 uppercase text-xs mb-4 sticky top-0 bg-white dark:bg-gray-900 py-2 z-10">A traiter ({incomingTrades.length})</h2>
                        {incomingTrades.length === 0 && <p className="text-gray-400 italic text-sm">Aucune demande en attente.</p>}
                        {incomingTrades.map((trade: TradeRequest) => (
                            <IncomingRequestCard key={trade.id} trade={trade} />
                        ))}
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-500 uppercase text-xs mb-4 pt-4 border-t dark:border-gray-700">En attente de reponse ({outgoingTrades.length})</h2>
                        {outgoingTrades.length === 0 && <p className="text-gray-400 italic text-sm">Aucune proposition en cours.</p>}
                        {outgoingTrades.map((trade: TradeRequest) => (
                             <div key={trade.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 mb-2">
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                    Envoyee a <span className="font-bold">{trade.receiverName}</span>
                                </span>
                                <button onClick={() => cancelTrade(trade.id)} className="text-xs text-red-500 hover:underline">Annuler</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

    </main>
  );
}