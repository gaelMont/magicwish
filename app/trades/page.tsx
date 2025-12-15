// app/trades/page.tsx
'use client';

import { useState, useTransition, Suspense, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTradeMatcher, TradeProposal } from '@/hooks/useTradeMatcher';
import { useTradeSystem, TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import Image from 'next/image';
import { CardType } from '@/hooks/useCardCollection'; 
import AdContainer from '@/components/AdContainer';
import { ScryfallRawData } from '@/lib/cardUtils';
import { useSearchParams } from 'next/navigation';

const TradeListText = ({ 
    cards, 
    allowPriceEdit = false, 
    onPriceChange 
}: { 
    cards: CardType[], 
    allowPriceEdit?: boolean, 
    onPriceChange?: (id: string, val: number) => void 
}) => {
    return (
        <div className="max-h-60 overflow-y-auto custom-scrollbar bg-surface rounded-lg border border-border">
            <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-secondary text-muted sticky top-0 z-10 font-semibold uppercase tracking-wider">
                    <tr>
                        <th className="px-2 py-2 text-center w-8">Qté</th>
                        <th className="px-2 py-2">Nom</th>
                        <th className="px-2 py-2 w-12 text-center">Set</th>
                        <th className="px-2 py-2 w-10 text-center">N°</th>
                        <th className="px-2 py-2 w-10 text-center">Foil</th>
                        <th className="px-2 py-2 text-right w-16">Prix</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {cards.map((c, i) => {
                        const price = c.customPrice !== undefined ? c.customPrice : (c.price || 0);
                        const scryData = c.scryfallData as ScryfallRawData | undefined;
                        const collectorNum = scryData?.collector_number || '?';

                        return (
                            <tr key={`${c.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground select-none">
                                <td className="px-2 py-1.5 text-center font-bold text-muted">
                                    {c.quantity}
                                </td>
                                <td className="px-2 py-1.5 font-medium truncate max-w-[140px]" title={c.name}>
                                    {c.name}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">
                                        {c.setCode?.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-2 py-1.5 text-center text-[10px] text-muted font-mono">
                                    {collectorNum}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    {c.isFoil ? (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1 rounded">
                                            Foil
                                        </span>
                                    ) : <span className="text-muted">-</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                    {allowPriceEdit ? (
                                        <div className="flex items-center justify-end gap-1">
                                            <input 
                                                type="number" min="0" step="0.01" 
                                                className="w-14 p-1 text-right border border-border rounded bg-background focus:ring-1 focus:ring-primary outline-none text-xs" 
                                                value={price} 
                                                onChange={(e) => onPriceChange && onPriceChange(c.id, parseFloat(e.target.value) || 0)} 
                                            />
                                            <span className="text-muted">€</span>
                                        </div>
                                    ) : (
                                        <span className={`tabular-nums ${c.customPrice !== undefined ? 'text-orange-600 font-bold' : 'text-muted'}`}>
                                            {price.toFixed(2)} €
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const IncomingRequestCard = ({ trade }: { trade: TradeRequest }) => {
    const { acceptTrade, rejectTrade, isProcessing } = useTradeSystem();
    const [isOpen, setIsOpen] = useState(false);

    const valReceive = trade.itemsGiven.reduce((acc: number, c: CardType) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0); 
    const valGive = trade.itemsReceived.reduce((acc: number, c: CardType) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);

    return (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden mb-4 transition-all hover:shadow-md">
            <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-secondary/30 select-none">
                <div>
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                        De {trade.senderName}
                    </h3>
                    <p className="text-sm text-muted mt-1">
                        Vous recevez <strong className="text-success">{trade.itemsGiven.length} cartes</strong> (~{valReceive.toFixed(2)} €) 
                        contre <strong className="text-danger">{trade.itemsReceived.length} cartes</strong> (~{valGive.toFixed(2)} €)
                    </p>
                </div>
                <div className="flex gap-2 self-end sm:self-auto items-center">
                    <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-muted underline mr-4 hover:text-foreground transition">
                        {isOpen ? 'Masquer' : 'Voir le contenu'}
                    </button>
                    <button onClick={() => rejectTrade(trade.id)} disabled={isProcessing} className="px-3 py-1.5 bg-secondary hover:bg-danger/10 text-danger rounded-lg text-sm font-bold transition">Refuser</button>
                    <button onClick={() => acceptTrade(trade)} disabled={isProcessing} className="btn-primary text-sm shadow-sm">Accepter</button>
                </div>
            </div>
            
            {isOpen && (
                <div className="p-4 border-t border-border grid md:grid-cols-2 gap-6 animate-in fade-in bg-background/50">
                    <div>
                        <p className="text-xs font-bold text-success uppercase mb-2 flex items-center gap-2">Vous recevez</p>
                        <TradeListText cards={trade.itemsGiven} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-danger uppercase mb-2 flex items-center gap-2">Vous donnez</p>
                        <TradeListText cards={trade.itemsReceived} />
                    </div>
                </div>
            )}
        </div>
    );
};

const OutgoingRequestCard = ({ trade }: { trade: TradeRequest }) => {
    const { cancelTrade } = useTradeSystem();
    const [isOpen, setIsOpen] = useState(false);

    const valGiven = trade.itemsGiven.reduce((acc: number, c: CardType) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0); 
    const valReceived = trade.itemsReceived.reduce((acc: number, c: CardType) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);

    return (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden mb-4">
            <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-secondary/20 select-none">
                <div>
                    <h3 className="font-bold text-muted flex items-center gap-2">
                        Envoyée à <span className="text-foreground">{trade.receiverName}</span>
                    </h3>
                    <p className="text-sm text-muted mt-1">
                        Vous donnez <strong className="text-danger">{trade.itemsGiven.length} cartes</strong> (~{valGiven.toFixed(2)} €) 
                        contre <strong className="text-success">{trade.itemsReceived.length} cartes</strong> (~{valReceived.toFixed(2)} €)
                    </p>
                </div>
                <div className="flex gap-2 self-end sm:self-auto items-center">
                    <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-muted underline mr-4 hover:text-foreground transition">
                        {isOpen ? 'Masquer' : 'Vérifier contenu'}
                    </button>
                    <button 
                        onClick={() => cancelTrade(trade.id)} 
                        className="px-3 py-1.5 bg-secondary hover:bg-border text-muted hover:text-danger rounded-lg text-sm font-medium transition"
                    >
                        Annuler
                    </button>
                </div>
            </div>
            
            {isOpen && (
                <div className="p-4 border-t border-border grid md:grid-cols-2 gap-6 animate-in fade-in bg-background/50">
                    <div>
                        <p className="text-xs font-bold text-danger uppercase mb-2 flex items-center gap-2">Vous donnez</p>
                        <TradeListText cards={trade.itemsGiven} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-success uppercase mb-2 flex items-center gap-2">Vous recevez</p>
                        <TradeListText cards={trade.itemsReceived} />
                    </div>
                </div>
            )}
        </div>
    );
};

const TradeRowProposal = ({ proposal, onProposalSent }: { proposal: TradeProposal, onProposalSent: () => void }) => {
    const { proposeTrade } = useTradeSystem(); 
    const [isPending, startTransition] = useTransition(); 

    const [localGiven, setLocalGiven] = useState<CardType[]>(proposal.toGive);
    const [localReceived, setLocalReceived] = useState<CardType[]>(proposal.toReceive);

    useEffect(() => {
        setLocalGiven(proposal.toGive);
        setLocalReceived(proposal.toReceive);
    }, [proposal]);

    const totalGive = localGiven.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
    const totalReceive = localReceived.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
    const delta = totalGive - totalReceive;
    
    const handleLocalPriceChange = (id: string, newVal: number, side: 'give' | 'receive') => {
        const updater = side === 'give' ? setLocalGiven : setLocalReceived;
        updater(prev => prev.map(c => c.id === id ? { ...c, customPrice: newVal } : c));
    };

    const handlePropose = () => { 
        startTransition(async () => {
            const success = await proposeTrade(
                proposal.friend.uid,
                proposal.friend.displayName,
                localGiven, 
                localReceived 
            );
            if (success) onProposalSent(); 
        });
    };

    return (
        <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden mb-8 shrink-0">
            <div className="bg-secondary/30 p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4 select-none">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                        {proposal.friend.photoURL ? <Image src={proposal.friend.photoURL} alt="" width={40} height={40} className="w-full h-full object-cover"/> : proposal.friend.username[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Match avec {proposal.friend.displayName}</h2>
                        <Link href={`/user/${proposal.friend.uid}`} className="text-sm text-primary hover:underline">Voir son profil</Link>
                    </div>
                </div>
                <button 
                    onClick={handlePropose} 
                    disabled={isPending} 
                    className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isPending ? 'Envoi en cours...' : 'Envoyer la proposition'}
                </button>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-border">
                <div className="p-4 bg-danger/5">
                    <h3 className="font-bold text-danger mb-3 flex justify-between items-center text-sm uppercase tracking-wide">
                        Vous donnez ({localGiven.length})
                        <span className="bg-surface px-2 py-1 rounded shadow-sm border border-border text-foreground normal-case">
                            {totalGive.toFixed(2)} €
                        </span>
                    </h3>
                    <TradeListText 
                        cards={localGiven} 
                        allowPriceEdit={true} 
                        onPriceChange={(id, val) => handleLocalPriceChange(id, val, 'give')} 
                    />
                </div>

                <div className="p-4 bg-success/5">
                    <h3 className="font-bold text-success mb-3 flex justify-between items-center text-sm uppercase tracking-wide">
                        Vous recevez ({localReceived.length})
                        <span className="bg-surface px-2 py-1 rounded shadow-sm border border-border text-foreground normal-case">
                            {totalReceive.toFixed(2)} €
                        </span>
                    </h3>
                    <TradeListText 
                        cards={localReceived} 
                        allowPriceEdit={true}
                        onPriceChange={(id, val) => handleLocalPriceChange(id, val, 'receive')}
                    />
                </div>
            </div>
            
            <div className="p-3 text-center bg-secondary/20 border-t border-border">
                <span className="text-xs text-muted uppercase font-bold mr-2">Balance estimée :</span>
                <span className={`font-bold ${delta > 0 ? 'text-success' : 'text-danger'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(2)} EUR
                </span>
                <span className="text-xs text-muted ml-2">(Positif = Vous donnez plus de valeur)</span>
            </div>
        </div>
    );
};

function TradesPageContent() {
  const { user } = useAuth();
  const { proposals, loading, status, runScan } = useTradeMatcher();
  const { incomingTrades, outgoingTrades } = useTradeSystem(); 
  
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'requests' ? 'requests' : 'scan';
  const [activeTab, setActiveTab] = useState<'scan' | 'requests'>(initialTab);

  if (!user) return <div className="p-10 text-center text-muted">Connectez-vous.</div>;

  return (
    <div className="container mx-auto p-4 max-w-5xl h-[calc(100vh-64px)] flex flex-col">
        <div className="flex-none flex flex-col md:flex-row justify-between items-end mb-4 gap-4 border-b border-border pb-4">
            <div><h1 className="text-3xl font-black text-primary tracking-tight">Centre d&apos;Echanges</h1></div>
            <div className="flex gap-4">
                <button onClick={() => setActiveTab('scan')} className={`pb-2 px-2 font-bold transition ${activeTab === 'scan' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>
                    Scanner ({proposals.length})
                </button>
                <button onClick={() => setActiveTab('requests')} className={`pb-2 px-2 font-bold transition relative ${activeTab === 'requests' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>
                    Demandes {incomingTrades.length > 0 && <span className="ml-2 bg-danger text-white text-[10px] px-1.5 rounded-full align-top animate-pulse">{incomingTrades.length}</span>}
                </button>
                <Link href="/trades/history" className="pb-2 px-3 font-bold text-muted hover:text-foreground hover:bg-secondary rounded-t-lg transition flex items-center gap-1">
                    <span className="hidden sm:inline">Historique</span>
                </Link>
            </div>
        </div>

        <div className="grow overflow-y-auto custom-scrollbar pb-10">
            {activeTab === 'scan' && (
                <div className="animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-end mb-6 gap-3 sticky top-0 bg-background/80 backdrop-blur-md z-20 py-2">
                         <Link href="/trades/manual" className="bg-secondary hover:bg-border text-foreground px-4 py-2 rounded-lg font-bold transition text-sm flex items-center justify-center border border-border">Mode Manuel</Link>
                        <button onClick={runScan} disabled={loading} className="btn-primary w-full sm:w-auto disabled:opacity-50">{loading ? status : "Lancer le Scanner"}</button>
                    </div>
                    {loading ? (
                        <div className="text-center py-20"><div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-muted mb-6">{status}</p><AdContainer message="Sponsorisé" adSlotId="1234567890" /></div>
                    ) : (
                        <>
                            {proposals.length === 0 ? (
                                <div className="space-y-6">
                                    <div className="text-center py-20 text-muted border-2 border-dashed border-border rounded-xl">
                                        <p className="text-lg font-medium">Aucun échange trouvé.</p>
                                        <p className="text-sm">Vérifiez que vous avez des amis et que vos Wishlists sont à jour.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {proposals.map((proposal: TradeProposal) => (
                                        <TradeRowProposal key={proposal.friend.uid} proposal={proposal} onProposalSent={runScan} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="animate-in fade-in space-y-8">
                    <div>
                        <h2 className="font-bold text-muted uppercase text-xs mb-4 sticky top-0 bg-background py-2 z-10 border-b border-border">A traiter ({incomingTrades.length})</h2>
                        {incomingTrades.length === 0 && <p className="text-muted italic text-sm p-4 text-center">Aucune demande en attente.</p>}
                        {incomingTrades.map((trade: TradeRequest) => (<IncomingRequestCard key={trade.id} trade={trade} />))}
                    </div>
                    <div>
                        <h2 className="font-bold text-muted uppercase text-xs mb-4 pt-4 border-t border-border">Envoyées - En attente ({outgoingTrades.length})</h2>
                        {outgoingTrades.length === 0 && <p className="text-muted italic text-sm p-4 text-center">Aucune proposition en cours.</p>}
                        {outgoingTrades.map((trade: TradeRequest) => (<OutgoingRequestCard key={trade.id} trade={trade} />))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}

export default function TradesPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
            <TradesPageContent />
        </Suspense>
    );
}