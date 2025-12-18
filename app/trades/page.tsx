// app/trades/page.tsx
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTradeMatcher, TradeProposal } from '@/hooks/useTradeMatcher';
import { useTradeSystem, TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import Image from 'next/image';
import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';
import { useSearchParams } from 'next/navigation';
import MagicCard from '@/components/MagicCard'; 

// --- COMPOSANT LISTE (TEXTE) ---
const TradeListText = ({ 
    cards, 
    allowPriceEdit = false, 
    onPriceChange,
    onPreview 
}: { 
    cards: CardType[], 
    allowPriceEdit?: boolean, 
    onPriceChange?: (id: string, val: number) => void,
    onPreview: (c: CardType) => void
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
                            <tr 
                                key={`${c.id}-${i}`} 
                                className="hover:bg-secondary/50 transition-colors text-foreground select-none cursor-pointer"
                                onClick={() => onPreview(c)}
                            >
                                <td className="px-2 py-1.5 text-center font-bold text-muted">
                                    {c.quantity}
                                </td>
                                <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={c.name}>
                                    {c.name}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">
                                        {c.setCode?.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-2 py-1.5 text-center text-muted font-mono text-[10px]">
                                    {collectorNum}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    {c.isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Foil</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                                    {allowPriceEdit ? (
                                        <input 
                                            type="number" 
                                            min="0" 
                                            step="0.01" 
                                            value={price}
                                            onChange={(e) => onPriceChange?.(c.id, parseFloat(e.target.value) || 0)}
                                            className="w-14 p-1 text-right bg-background border border-border rounded text-xs outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    ) : (
                                        <span className="font-medium">{price.toFixed(2)} €</span>
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

// --- COMPOSANT PROPOSITION (MOI -> AMI) ---
const TradeRowProposal = ({ 
    proposal, 
    onProposalSent,
    onPreview
}: { 
    proposal: TradeProposal, 
    onProposalSent: () => void,
    onPreview: (c: CardType) => void
}) => {
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
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm relative">
                        {proposal.friend.photoURL ? (
                            <Image 
                                src={proposal.friend.photoURL} 
                                alt={proposal.friend.displayName} 
                                fill
                                className="object-cover"
                                sizes="40px"
                            />
                        ) : (
                            proposal.friend.username[0].toUpperCase()
                        )}
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
                        onPreview={onPreview}
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
                        onPreview={onPreview}
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

// --- COMPOSANT DEMANDE ENTRANTE (AMI -> MOI) ---
const IncomingRequestCard = ({ 
    trade, 
    onPreview 
}: { 
    trade: TradeRequest,
    onPreview: (c: CardType) => void
}) => {
    const { acceptTrade, rejectTrade } = useTradeSystem();
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const valGive = trade.itemsReceived.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
    const valReceive = trade.itemsGiven.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);

    return (
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                    <h3 className="font-bold text-foreground">Proposition de {trade.senderName}</h3>
                    <p className="text-sm text-muted">
                        Tu reçois <span className="text-success font-bold">{trade.itemsGiven.length} cartes</span> (~{valReceive.toFixed(0)}€) 
                        contre <span className="text-danger font-bold">{trade.itemsReceived.length} cartes</span> (~{valGive.toFixed(0)}€)
                    </p>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                    <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-muted hover:text-foreground underline mr-2">
                        {isOpen ? 'Masquer' : 'Détails'}
                    </button>
                    <button 
                        onClick={() => rejectTrade(trade.id)} 
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-secondary hover:bg-danger/20 text-danger rounded-lg text-sm font-medium transition"
                    >
                        Refuser
                    </button>
                    <button 
                        onClick={() => { setIsProcessing(true); acceptTrade(trade).finally(() => setIsProcessing(false)); }} 
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition shadow-sm"
                    >
                        {isProcessing ? '...' : 'Accepter'}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="mt-4 pt-4 border-t border-border grid md:grid-cols-2 gap-4">
                    <div className="bg-success/5 p-3 rounded">
                        <p className="text-xs font-bold text-success mb-2">Tu vas recevoir :</p>
                        <div className="flex flex-wrap gap-2">
                            {trade.itemsGiven.map((c: CardType) => (
                                <div 
                                    key={c.id} 
                                    className="relative group w-12 h-16 bg-black/10 rounded overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() => onPreview(c)}
                                >
                                    <Image 
                                        src={c.imageUrl} 
                                        alt={c.name} 
                                        fill
                                        className="object-cover"
                                        sizes="48px"
                                    />
                                    <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1 font-bold">{c.quantity}x</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-danger/5 p-3 rounded">
                        <p className="text-xs font-bold text-danger mb-2">Tu vas donner :</p>
                        <div className="flex flex-wrap gap-2">
                            {trade.itemsReceived.map((c: CardType) => (
                                <div 
                                    key={c.id} 
                                    className="relative group w-12 h-16 bg-black/10 rounded overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() => onPreview(c)}
                                >
                                    <Image 
                                        src={c.imageUrl} 
                                        alt={c.name} 
                                        fill
                                        className="object-cover"
                                        sizes="48px"
                                    />
                                    <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1 font-bold">{c.quantity}x</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- COMPOSANT PAGE PRINCIPALE ---
export default function TradesPageContent() {
    const { user } = useAuth();
    const { proposals, loading, status, runScan } = useTradeMatcher();
    const { incomingTrades, outgoingTrades } = useTradeSystem();
    const searchParams = useSearchParams();
    
    const initialTab = searchParams.get('tab') === 'requests' ? 'requests' : 'scan';
    const [activeTab, setActiveTab] = useState<'scan' | 'requests'>(initialTab);
    const [previewCard, setPreviewCard] = useState<CardType | null>(null);

    if (!user) return <div className="p-10 text-center text-muted">Connectez-vous pour voir vos échanges.</div>;

    return (
        <div className="container mx-auto p-4 max-w-5xl h-[calc(100vh-64px)] flex flex-col">
            
            <div className="flex-none mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-4">Centre d&apos;Échanges</h1>
                <div className="flex gap-4 border-b border-border">
                    <button 
                        onClick={() => setActiveTab('scan')}
                        className={`pb-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'scan' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}
                    >
                        Scanner Intelligent ({proposals.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('requests')}
                        className={`pb-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'requests' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}
                    >
                        Demandes ({incomingTrades.length + outgoingTrades.length})
                    </button>
                    
                    <Link 
                        href="/trades/history"
                        className="pb-3 text-sm font-bold transition-colors border-b-2 border-transparent text-muted hover:text-foreground ml-auto flex items-center gap-1"
                    >
                        Historique
                    </Link>
                </div>
            </div>

            <div className="grow overflow-y-auto custom-scrollbar pb-10">
                
                {activeTab === 'scan' && (
                    <div className="animate-in fade-in">
                        <div className="flex flex-col sm:flex-row justify-end mb-6 gap-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 border-b border-border/50">
                            <Link href="/trades/manual" className="bg-secondary hover:bg-border text-foreground px-4 py-2 rounded-lg font-bold transition text-sm flex items-center justify-center">
                                Mode Manuel
                            </Link>
                            <button 
                                onClick={runScan} 
                                disabled={loading}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-bold shadow transition text-sm disabled:opacity-50 w-full sm:w-auto"
                            >
                                {loading ? status : "Lancer le Scanner"}
                            </button>
                        </div>

                        {proposals.length === 0 && !loading && (
                            <div className="text-center py-20 text-muted border-2 border-dashed border-border rounded-xl">
                                Lancez le scanner pour trouver des &quot;matchs&quot; avec vos amis.
                            </div>
                        )}

                        <div className="space-y-8">
                            {proposals.map(proposal => (
                                <TradeRowProposal 
                                    key={proposal.friend.uid} 
                                    proposal={proposal} 
                                    onProposalSent={runScan}
                                    onPreview={setPreviewCard}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="animate-in fade-in space-y-8">
                        <div>
                            <h2 className="font-bold text-muted uppercase text-xs mb-4 sticky top-0 bg-background py-2 z-10">
                                À traiter ({incomingTrades.length})
                            </h2>
                            {incomingTrades.length === 0 && <p className="text-muted italic text-sm">Aucune demande en attente.</p>}
                            <div className="space-y-4">
                                {incomingTrades.map((trade: TradeRequest) => (
                                    <IncomingRequestCard 
                                        key={trade.id} 
                                        trade={trade} 
                                        onPreview={setPreviewCard}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <h2 className="font-bold text-muted uppercase text-xs mb-4 pt-4 border-t border-border">
                                En attente de réponse ({outgoingTrades.length})
                            </h2>
                            {outgoingTrades.length === 0 && <p className="text-muted italic text-sm">Aucune proposition en cours.</p>}
                            <div className="space-y-3">
                                {outgoingTrades.map((trade: TradeRequest) => (
                                    <div key={trade.id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg border border-border">
                                        <div>
                                            <span className="font-bold text-foreground">Pour {trade.receiverName}</span>
                                            <p className="text-xs text-muted">Envoyé le {new Date(trade.createdAt.seconds * 1000).toLocaleDateString()}</p>
                                        </div>
                                        <span className="text-xs bg-secondary px-2 py-1 rounded text-muted font-medium">En attente</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {previewCard && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in cursor-pointer"
                    onClick={() => setPreviewCard(null)}
                >
                    <div className="relative transform transition-all scale-100 p-4" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setPreviewCard(null)} 
                            className="absolute -top-2 -right-2 bg-surface text-foreground rounded-full p-2 shadow-lg z-10 border border-border hover:bg-secondary transition-colors"
                        >
                            ✕
                        </button>
                        <div className="w-[300px] h-[420px] shadow-2xl rounded-xl overflow-hidden pointer-events-none">
                            <MagicCard {...previewCard} readOnly={true} quantity={previewCard.quantity} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}