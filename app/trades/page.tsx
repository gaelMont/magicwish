// app/trades/page.tsx
'use client';

import { useState, useTransition } from 'react'; // <-- Ajout de useTransition
import { useAuth } from '@/lib/AuthContext';
import { useTradeMatcher, TradeProposal } from '@/hooks/useTradeMatcher';
import { useTradeSystem, TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { useCardCollection, CardType } from '@/hooks/useCardCollection'; 
import MagicCard from '@/components/MagicCard'; 
import AdContainer from '@/components/AdContainer';

// --- COMPOSANT : CARTE DE DEMANDE RECUE ---
const IncomingRequestCard = ({ trade }: { trade: TradeRequest }) => {
    const { acceptTrade, rejectTrade, isProcessing } = useTradeSystem();
    const [isOpen, setIsOpen] = useState(false);

    const valReceive = trade.itemsGiven.reduce((acc: number, c: CardType) => acc + (c.price || 0), 0); 
    const valGive = trade.itemsReceived.reduce((acc: number, c: CardType) => acc + (c.price || 0), 0);

    return (
        <div className="bg-surface rounded-xl border-l-4 border-primary shadow-sm p-4 mb-4 border-y border-r">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                    <h3 className="font-bold text-foreground">Proposition de {trade.senderName}</h3>
                    <p className="text-sm text-muted">
                        Tu reçois <span className="text-success font-bold">{trade.itemsGiven.length} cartes</span> (~{valReceive.toFixed(0)}€) 
                        contre <span className="text-danger font-bold">{trade.itemsReceived.length} cartes</span> (~{valGive.toFixed(0)}€)
                    </p>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                    <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-muted underline mr-2">Détails</button>
                    <button onClick={() => rejectTrade(trade.id)} disabled={isProcessing} className="px-3 py-1.5 bg-secondary hover:bg-danger/20 text-danger rounded-lg text-sm font-medium transition">Refuser</button>
                    <button onClick={() => acceptTrade(trade)} disabled={isProcessing} className="px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-sm font-medium transition shadow-sm">Accepter</button>
                </div>
            </div>
            {isOpen && (
                <div className="mt-4 pt-4 border-t border-border grid md:grid-cols-2 gap-4">
                    <div className="bg-success/10 p-3 rounded"><p className="text-xs font-bold text-success mb-2">Tu vas recevoir :</p><div className="flex flex-wrap gap-2">{trade.itemsGiven.map((c: CardType) => (<div key={c.id} className="relative group w-12 h-16 bg-secondary rounded overflow-hidden"><img src={c.imageUrl} className="w-full h-full object-cover"/><div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1">{c.quantity}x</div></div>))}</div></div>
                    <div className="bg-danger/10 p-3 rounded"><p className="text-xs font-bold text-danger mb-2">Tu vas donner :</p><div className="flex flex-wrap gap-2">{trade.itemsReceived.map((c: CardType) => (<div key={c.id} className="relative group w-12 h-16 bg-secondary rounded overflow-hidden"><img src={c.imageUrl} className="w-full h-full object-cover"/><div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1">{c.quantity}x</div></div>))}</div></div>
                </div>
            )}
        </div>
    );
};

// --- COMPOSANT : PROPOSITION D'ÉCHANGE ---
const TradeRowProposal = ({ proposal, onProposalSent }: { proposal: TradeProposal, onProposalSent: () => void }) => {
    const { setCustomPrice } = useCardCollection('collection');
    // CORRECTION : on ne destructure PLUS isProposing ici
    const { proposeTrade } = useTradeSystem(); 
    const [isPending, startTransition] = useTransition(); // <-- Utilisation de useTransition pour le blocage immédiat

    const totalGive = proposal.toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const totalReceive = proposal.toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0), 0);
    const delta = totalGive - totalReceive;
    
    const handlePropose = () => { 
        startTransition(async () => {
            const success = await proposeTrade(
                proposal.friend.uid,
                proposal.friend.displayName,
                proposal.toGive,
                proposal.toReceive 
            );
            if (success) onProposalSent(); 
        });
    };

    return (
        <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden mb-8 shrink-0">
            <div className="bg-secondary/30 p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                        {proposal.friend.photoURL ? <img src={proposal.friend.photoURL} alt="" className="w-full h-full object-cover"/> : proposal.friend.username[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Échange avec {proposal.friend.displayName}</h2>
                        <Link href={`/user/${proposal.friend.uid}`} className="text-sm text-primary hover:underline">Voir profil</Link>
                    </div>
                </div>
                <button 
                    onClick={handlePropose} 
                    disabled={isPending} // <--- UTILISATION DE isPending
                    className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded-lg font-bold shadow-sm transition text-sm w-full sm:w-auto disabled:opacity-50"
                >
                    {isPending ? 'Envoi...' : 'Proposer'}
                </button>
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-border">
                <div className="p-4 bg-danger/5">
                    <h3 className="font-bold text-danger mb-4 flex justify-between">Tu donnerais ({proposal.toGive.length}) <span className="text-sm bg-surface px-2 py-1 rounded shadow-sm border border-border">{totalGive.toFixed(2)} €</span></h3>
                    <div className="space-y-3">{proposal.toGive.map(card => (<MagicCard key={card.id} {...card} isTradeView={true} allowPriceEdit={true} onEditPrice={(newPrice) => setCustomPrice(card.id, newPrice)} />))}</div>
                </div>
                <div className="p-4 bg-success/5">
                    <h3 className="font-bold text-success mb-4 flex justify-between">Tu recevrais ({proposal.toReceive.length}) <span className="text-sm bg-surface px-2 py-1 rounded shadow-sm border border-border">{totalReceive.toFixed(2)} €</span></h3>
                    <div className="space-y-3">{proposal.toReceive.map(card => (<MagicCard key={card.id} {...card} isTradeView={true} allowPriceEdit={false} />))}</div>
                </div>
            </div>
            <div className="p-2 text-center text-xs text-muted border-t border-border">Balance : {delta.toFixed(2)} €</div>
        </div>
    );
};

export default function TradesPage() {
  const { user } = useAuth();
  const { proposals, loading, status, runScan } = useTradeMatcher();
  // CORRECTION : on ne destructure PLUS isProposing
  const { incomingTrades, outgoingTrades, cancelTrade } = useTradeSystem(); 
  const [activeTab, setActiveTab] = useState<'scan' | 'requests'>('scan');

  if (!user) return <div className="p-10 text-center text-muted">Connectez-vous.</div>;

  return (
    <main className="container mx-auto p-4 max-w-5xl h-[calc(100vh-64px)] flex flex-col">
        
        <div className="flex-none flex flex-col md:flex-row justify-between items-end mb-4 gap-4 border-b border-border pb-4">
            <div>
                <h1 className="text-3xl font-bold text-primary">Centre d&apos;Echanges</h1>
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={() => setActiveTab('scan')}
                    className={`pb-2 px-2 font-bold transition ${activeTab === 'scan' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}
                >
                    Scanner ({proposals.length})
                </button>
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`pb-2 px-2 font-bold transition relative ${activeTab === 'requests' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}
                >
                    Demandes 
                    {incomingTrades.length > 0 && <span className="ml-2 bg-orange-500 text-primary-foreground text-[10px] px-1.5 rounded-full align-top">{incomingTrades.length}</span>}
                </button>
            </div>
        </div>

        <div className="grow overflow-y-auto custom-scrollbar pb-10">
            {activeTab === 'scan' && (
                <div className="animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-end mb-6 gap-3 sticky top-0 bg-surface/80 backdrop-blur-sm z-10 py-2">
                         <Link href="/trades/manual" className="bg-secondary hover:bg-border text-foreground px-4 py-2 rounded-lg font-bold transition text-sm flex items-center justify-center">Mode Manuel</Link>
                        <button onClick={runScan} disabled={loading} className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded-lg font-bold shadow transition text-sm disabled:opacity-50 w-full sm:w-auto">
                            {loading ? status : "Lancer le Scanner"}
                        </button>
                    </div>

                    {/* --- BLOC DE CHARGEMENT --- */}
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-muted mb-6">{status}</p>
                            
                            {/* Pub PENDANT l'attente */}
                            <AdContainer message="Analyse en cours..." adSlotId="9999999999" />
                        </div>
                    ) : (
                        <>
                            {proposals.length === 0 ? (
                                <div className="space-y-6">
                                    <div className="text-center py-20 text-muted border-2 border-dashed border-border rounded-xl">
                                        Lancez le scanner pour trouver des &quot;matchs&quot; avec vos amis.
                                    </div>
                                    {/* Pub quand c'est vide */}
                                    <AdContainer adSlotId="2468135790" />
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {proposals.map(proposal => (
                                        <TradeRowProposal key={proposal.friend.uid} proposal={proposal} onProposalSent={runScan} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {/* FIN BLOC DE CHARGEMENT */}
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="animate-in fade-in space-y-8">
                    <div>
                        <h2 className="font-bold text-muted uppercase text-xs mb-4 sticky top-0 bg-background py-2 z-10">À traiter ({incomingTrades.length})</h2>
                        {incomingTrades.length === 0 && <p className="text-muted italic text-sm">Aucune demande en attente.</p>}
                        {incomingTrades.map((trade: TradeRequest) => (<IncomingRequestCard key={trade.id} trade={trade} />))}
                    </div>
                    <div>
                        <h2 className="font-bold text-muted uppercase text-xs mb-4 pt-4 border-t border-border">En attente ({outgoingTrades.length})</h2>
                        {outgoingTrades.length === 0 && <p className="text-muted italic text-sm">Aucune proposition en cours.</p>}
                        {outgoingTrades.map((trade: TradeRequest) => (
                             <div key={trade.id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg border border-border mb-2">
                                <span className="text-sm text-muted">Envoyée à <span className="font-bold text-foreground">{trade.receiverName}</span></span>
                                <button onClick={() => cancelTrade(trade.id)} className="text-xs text-danger hover:underline">Annuler</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </main>
  );
}