'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';
import MagicCard from '@/components/MagicCard';

// --- UTILITAIRES ---

const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
};

const aggregateCards = (cards: CardType[]) => {
    const map = new Map<string, CardType>();
    cards.forEach(card => {
        const key = `${card.name}-${card.setCode}-${card.isFoil ? 'foil' : 'normal'}-${card.customPrice}`;
        if (map.has(key)) {
            const existing = map.get(key)!;
            existing.quantity += card.quantity;
        } else {
            map.set(key, { ...card });
        }
    });
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
};

// --- COMPOSANT TABLEAU OPTIMISÉ AVEC LOGIQUE DE PRIX DYNAMIQUE ---
const CompactCardTable = ({ 
    cards, 
    title, 
    colorClass, 
    emptyLabel,
    onPreview 
}: { 
    cards: CardType[], 
    title: string, 
    colorClass: string, 
    emptyLabel: string,
    onPreview: (c: CardType) => void
}) => {
    const isGiven = colorClass.includes('danger');
    const accentBorder = isGiven ? 'border-danger/30' : 'border-success/30';
    const accentBg = isGiven ? 'bg-danger/5' : 'bg-success/5';

    return (
        <div className={`flex flex-col h-full bg-surface border rounded-xl overflow-hidden shadow-sm ${accentBorder}`}>
            <div className={`p-3 border-b border-border ${colorClass} bg-current/10 flex justify-between items-center`}>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground">{title}</h4>
                <span className="bg-surface text-foreground px-2 py-0.5 rounded text-[10px] font-black shadow-sm border border-border">
                    {cards.reduce((acc, c) => acc + c.quantity, 0)}
                </span>
            </div>
            
            <div className="grow relative bg-background/30 flex flex-col min-h-0 overflow-hidden">
                {cards.length === 0 ? (
                    <div className="flex items-center justify-center text-muted text-[10px] italic p-6 text-center grow">
                        {emptyLabel}
                    </div>
                ) : (
                    <div className="overflow-y-auto custom-scrollbar grow">
                        <table className="hidden sm:table w-full text-left border-collapse table-fixed">
                            <thead className="bg-secondary/80 text-muted sticky top-0 z-10 font-bold text-[9px] uppercase tracking-tighter">
                                <tr>
                                    <th className="px-2 py-2 text-center w-10">Qté</th>
                                    <th className="px-2 py-2">Nom</th>
                                    <th className="px-2 py-2 text-center w-16">Set</th>
                                    <th className="px-2 py-2 text-center w-12">N°</th>
                                    <th className="px-2 py-2 text-center w-12">Foil</th>
                                    <th className="px-2 py-2 text-right w-24">Prix</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {cards.map((c, i) => {
                                    const marketPrice = c.price ?? 0;
                                    const finalPrice = c.customPrice ?? marketPrice;
                                    const scryData = c.scryfallData as ScryfallRawData | undefined;

                                    // Logique de couleur dynamique
                                    let priceColor = 'text-foreground';
                                    if (c.customPrice !== undefined) {
                                        if (isGiven) {
                                            // SORTIE : Vert si on vend plus cher que le marché
                                            priceColor = c.customPrice > marketPrice ? 'text-success font-bold' : 'text-danger font-bold';
                                        } else {
                                            // ENTRÉE : Vert si on paye moins cher que le marché
                                            priceColor = c.customPrice < marketPrice ? 'text-success font-bold' : 'text-danger font-bold';
                                        }
                                    }

                                    return (
                                        <tr key={i} className="hover:bg-secondary/50 transition-colors text-foreground select-none cursor-pointer text-[11px]" onClick={() => onPreview(c)}>
                                            <td className="px-2 py-2 text-center font-bold text-muted border-r border-border/5">{c.quantity}</td>
                                            <td className="px-2 py-2 font-medium truncate" title={c.name}>{c.name}</td>
                                            <td className="px-2 py-2 text-center"><span className="text-[9px] font-mono bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border uppercase">{c.setCode}</span></td>
                                            <td className="px-2 py-2 text-center text-[9px] text-muted font-mono">{scryData?.collector_number || '?'}</td>
                                            <td className="px-2 py-2 text-center">{c.isFoil ? <span className="text-amber-500 font-bold text-[8px] uppercase">Foil</span> : <span className="text-muted/30">-</span>}</td>
                                            <td className={`px-2 py-2 text-right tabular-nums ${priceColor}`}>
                                                {finalPrice.toFixed(2)}€
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="sm:hidden flex flex-col divide-y divide-border/50">
                            {cards.map((c, i) => {
                                const marketPrice = c.price ?? 0;
                                const finalPrice = c.customPrice ?? marketPrice;
                                const scryData = c.scryfallData as ScryfallRawData | undefined;

                                let priceColor = 'text-foreground';
                                if (c.customPrice !== undefined) {
                                    if (isGiven) {
                                        priceColor = c.customPrice > marketPrice ? 'text-success' : 'text-danger';
                                    } else {
                                        priceColor = c.customPrice < marketPrice ? 'text-success' : 'text-danger';
                                    }
                                }

                                return (
                                    <div key={i} className={`p-3 active:bg-secondary transition-colors flex flex-col gap-1.5 cursor-pointer ${accentBg}`} onClick={() => onPreview(c)}>
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-bold text-foreground">{c.quantity}x {c.name}</span>
                                            <span className={`text-xs font-black ${priceColor}`}>{finalPrice.toFixed(2)}€</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase">
                                            <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border">{c.setCode}</span>
                                            <span className="text-muted">#{scryData?.collector_number || '?'}</span>
                                            {c.isFoil && <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Foil</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MODALE BILAN ---
const PeriodSummaryModal = ({ 
    isOpen, 
    onClose, 
    trades, 
    currentUid,
    onPreview 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    trades: TradeRequest[], 
    currentUid: string,
    onPreview: (c: CardType) => void
}) => {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const summary = useMemo(() => {
        if (!isOpen) return { given: [], received: [], valGiven: 0, valReceived: 0, count: 0 };
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000) - 1;
        const filteredTrades = trades.filter(t => t.status === 'completed' && t.createdAt && (t.createdAt.seconds * 1000 >= start && t.createdAt.seconds * 1000 <= end));
        const allReceived: CardType[] = [];
        const allGiven: CardType[] = [];

        filteredTrades.forEach(trade => {
            const isSender = trade.senderUid === currentUid;
            if (isSender) {
                allGiven.push(...trade.itemsGiven);
                allReceived.push(...trade.itemsReceived);
            } else {
                allGiven.push(...trade.itemsReceived);
                allReceived.push(...trade.itemsGiven);
            }
        });

        return {
            given: aggregateCards(allGiven),
            received: aggregateCards(allReceived),
            valGiven: allGiven.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0),
            valReceived: allReceived.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0),
            count: filteredTrades.length
        };
    }, [isOpen, trades, currentUid, startDate, endDate]);

    if (!isOpen) return null;
    const balance = summary.valReceived - summary.valGiven;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4 backdrop-blur-md" onClick={onClose}>
            <div className="bg-surface rounded-3xl max-w-5xl w-full shadow-2xl border border-border flex flex-col h-[95vh] md:h-auto md:max-h-[90vh] overflow-hidden animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-4 md:p-6 border-b border-border bg-background/50">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Bilan des Mouvements</h2>
                            <p className="text-[10px] text-muted font-bold uppercase mt-0.5">Statistiques de vos échanges</p>
                        </div>
                        <button onClick={onClose} className="bg-secondary text-foreground rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold hover:bg-border transition-colors">&times;</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-secondary/50 p-2 rounded-2xl border border-border">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase text-muted px-1">Début</span>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-surface text-foreground text-xs border-none rounded-xl px-2 py-1.5 outline-none font-bold shadow-sm" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase text-muted px-1">Fin</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-surface text-foreground text-xs border-none rounded-xl px-2 py-1.5 outline-none font-bold shadow-sm" />
                        </div>
                    </div>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto grow custom-scrollbar space-y-6 bg-background/20">
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                        <div className="bg-surface p-3 rounded-2xl border border-border text-center shadow-sm">
                            <p className="text-[8px] md:text-[10px] text-muted uppercase font-black mb-1">Échanges</p>
                            <p className="text-lg md:text-xl font-black text-foreground">{summary.count}</p>
                        </div>
                        <div className="bg-danger/10 p-3 rounded-2xl border border-danger/20 text-center shadow-sm">
                            <p className="text-[8px] md:text-[10px] text-danger uppercase font-black mb-1">Sorties</p>
                            <p className="text-lg md:text-xl font-black text-danger">-{summary.valGiven.toFixed(0)}€</p>
                        </div>
                        <div className="bg-success/10 p-3 rounded-2xl border border-success/20 text-center shadow-sm">
                            <p className="text-[8px] md:text-[10px] text-success uppercase font-black mb-1">Entrées</p>
                            <p className="text-lg md:text-xl font-black text-success">+{summary.valReceived.toFixed(0)}€</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <CompactCardTable cards={summary.given} title="Cartes Sorties" colorClass="text-danger" emptyLabel="Aucune sortie." onPreview={onPreview} />
                        <CompactCardTable cards={summary.received} title="Cartes Entrées" colorClass="text-success" emptyLabel="Aucune entrée." onPreview={onPreview} />
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-border bg-background/50 flex justify-between items-center">
                    <span className="text-xs text-muted font-black uppercase tracking-widest">Balance Finale</span>
                    <div className={`text-2xl font-black tabular-nums ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                        {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                    </div>
                </div>
            </div>
        </div>
    );
};

const HistoryCard = ({ trade, currentUid, onPreview }: { trade: TradeRequest, currentUid: string, onPreview: (c: CardType) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isSender = trade.senderUid === currentUid;
    const partnerName = isSender ? trade.receiverName : trade.senderName;
    const givenCards = isSender ? trade.itemsGiven : trade.itemsReceived;
    const receivedCards = isSender ? trade.itemsReceived : trade.itemsGiven;

    const valGiven = givenCards.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
    const valReceived = receivedCards.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);

    const statusConfig: Record<string, { label: string, color: string, bg: string }> = {
        completed: { label: 'Terminé', color: 'text-success', bg: 'bg-success/10' },
        rejected: { label: 'Refusé', color: 'text-danger', bg: 'bg-danger/10' },
        cancelled: { label: 'Annulé', color: 'text-muted', bg: 'bg-secondary' },
    };
    const config = statusConfig[trade.status] || statusConfig['cancelled'];

    return (
        <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-4">
            <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-secondary/30 transition select-none" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 ${config.bg} ${config.color} border border-current/20`}>
                        {config.label}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">
                            {isSender ? `Envoyé à ${partnerName}` : `Reçu de ${partnerName}`}
                        </p>
                        <p className="text-[10px] text-muted font-medium">{formatDate(trade.createdAt)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-8 text-sm w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                        <p className="text-muted text-[9px] uppercase font-black">Donné</p>
                        <p className="font-bold text-danger">-{valGiven.toFixed(2)}€</p>
                    </div>
                    <div className="text-right">
                        <p className="text-muted text-[9px] uppercase font-black">Reçu</p>
                        <p className="font-bold text-success">+{valReceived.toFixed(2)}€</p>
                    </div>
                    <div className={`text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>
            {isOpen && (
                <div className="border-t border-border p-4 bg-background/20 grid md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <CompactCardTable cards={aggregateCards(givenCards)} title="Sorties" colorClass="text-danger" emptyLabel="-" onPreview={onPreview} />
                    <CompactCardTable cards={aggregateCards(receivedCards)} title="Entrées" colorClass="text-success" emptyLabel="-" onPreview={onPreview} />
                </div>
            )}
        </div>
    );
};

export default function TradeHistoryPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState<TradeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    const [previewCard, setPreviewCard] = useState<CardType | null>(null);

    useEffect(() => {
        if (!user) return;
        const qSender = query(collection(db, 'trades'), where('senderUid', '==', user.uid), where('status', 'in', ['completed', 'rejected', 'cancelled']), orderBy('createdAt', 'desc'));
        const qReceiver = query(collection(db, 'trades'), where('receiverUid', '==', user.uid), where('status', 'in', ['completed', 'rejected', 'cancelled']), orderBy('createdAt', 'desc'));
        let sentData: TradeRequest[] = [];
        let receivedData: TradeRequest[] = [];
        const updateMerged = () => {
            const seenTradeIds = new Set<string>();
            const merged: TradeRequest[] = [];
            [...sentData, ...receivedData].forEach(trade => {
                if (!seenTradeIds.has(trade.id)) {
                    merged.push(trade);
                    seenTradeIds.add(trade.id);
                }
            });
            merged.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setHistory(merged);
            setLoading(false);
        };
        const u1 = onSnapshot(qSender, (snap) => { sentData = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest)); updateMerged(); });
        const u2 = onSnapshot(qReceiver, (snap) => { receivedData = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest)); updateMerged(); });
        return () => { u1(); u2(); };
    }, [user]);

    if (!user) return <div className="p-10 text-center text-muted font-bold">Connexion requise.</div>;

    return (
        <main className="container mx-auto p-4 max-w-5xl min-h-[85vh]">
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 mb-10 border-b border-border pb-6">
                <div className="flex items-center gap-6">
                    <Link href="/trades" className="text-xs bg-secondary text-secondary-foreground hover:bg-primary hover:text-white px-4 py-2 rounded-xl transition-all font-black uppercase tracking-tighter shadow-sm border border-border">← Retour</Link>
                    <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase">Historique</h1>
                </div>
                <button onClick={() => setShowSummary(true)} className="btn-primary uppercase text-xs tracking-widest px-6 py-3">Bilan Périodique</button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-muted animate-pulse font-bold tracking-widest text-xs uppercase">Initialisation...</div>
            ) : history.length === 0 ? (
                <div className="text-center py-24 bg-surface rounded-3xl border border-dashed border-border shadow-inner"><p className="text-muted italic font-medium">Aucun mouvement d&apos;échange enregistré.</p></div>
            ) : (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {history.map(trade => <HistoryCard key={trade.id} trade={trade} currentUid={user.uid} onPreview={setPreviewCard} />)}
                </div>
            )}

            <PeriodSummaryModal isOpen={showSummary} onClose={() => setShowSummary(false)} trades={history} currentUid={user.uid} onPreview={setPreviewCard} />

            {previewCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in cursor-pointer" onClick={() => setPreviewCard(null)}>
                    <div className="relative transform transition-all scale-100 p-4" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewCard(null)} className="absolute -top-2 -right-2 bg-surface text-foreground rounded-full p-2 shadow-xl z-10 border border-border active:scale-90 transition-transform">&times;</button>
                        <div className="w-[300px] h-[420px] shadow-2xl rounded-2xl overflow-hidden pointer-events-none ring-1 ring-white/10">
                            <MagicCard {...previewCard} readOnly={true} quantity={previewCard.quantity} hideFooter={true} />
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}