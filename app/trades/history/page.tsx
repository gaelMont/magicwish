'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';
import MagicCard from '@/components/MagicCard'; // Pour preview

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

// --- COMPOSANT TABLEAU STRICT (STYLE 001922) ---
const CompactCardTable = ({ 
    cards, 
    title, 
    colorClass, 
    emptyLabel,
    onPreview // Callback pour preview
}: { 
    cards: CardType[], 
    title: string, 
    colorClass: string, 
    emptyLabel: string,
    onPreview: (c: CardType) => void
}) => (
    <div className="flex flex-col h-full bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
        <div className={`p-3 border-b border-border ${colorClass} bg-opacity-10 bg-current flex justify-between items-center`}>
            <h4 className={`text-xs font-bold uppercase text-white`}>{title}</h4>
            <span className="bg-white text-foreground px-2 py-0.5 rounded text-xs font-bold shadow-sm border border-border">
                {cards.reduce((acc, c) => acc + c.quantity, 0)}
            </span>
        </div>
        
        <div className="grow relative bg-background/50 overflow-hidden flex flex-col">
            {cards.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted text-xs italic p-4 text-center">
                    {emptyLabel}
                </div>
            ) : (
                <div className="overflow-y-auto custom-scrollbar grow">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-primary text-white sticky top-0 z-10 font-semibold uppercase tracking-wider">
                            <tr>
                                <th className="px-2 py-2 text-center w-8">Qté</th>
                                <th className="px-2 py-2">Nom</th>
                                <th className="px-2 py-2 text-center w-12">Set</th>
                                <th className="px-2 py-2 text-center w-10">N°</th>
                                <th className="px-2 py-2 text-center w-10">Foil</th>
                                <th className="px-2 py-2 text-right w-16">Prix</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {cards.map((c, i) => {
                                const price = c.customPrice ?? c.price ?? 0;
                                const isCustom = c.customPrice !== undefined;
                                const scryData = c.scryfallData as ScryfallRawData | undefined;
                                const collectorNum = scryData?.collector_number || '?';

                                return (
                                    <tr 
                                        key={i} 
                                        className="hover:bg-secondary/50 transition-colors text-foreground select-none cursor-pointer"
                                        onClick={() => onPreview(c)} // Déclencheur preview
                                    >
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
                                            {c.isFoil && (
                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1 rounded">
                                                    Foil
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-2 py-1.5 text-right tabular-nums ${isCustom ? 'text-orange-600 font-bold' : 'text-muted'}`}>
                                            {price.toFixed(2)}€
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
);

// --- MODALE BILAN ---
const PeriodSummaryModal = ({ isOpen, onClose, trades, currentUid }: { isOpen: boolean, onClose: () => void, trades: TradeRequest[], currentUid: string }) => {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Preview state local à la modale de bilan ? Non, utilisons pas de preview ici pour simplifier, ou alors passons un callback vide
    // Pour rester simple et efficace : pas de preview dans le bilan global agrégé pour l'instant (car agrégé).
    const dummyPreview = () => {}; 

    const summary = useMemo(() => {
        if (!isOpen) return { given: [], received: [], valGiven: 0, valReceived: 0, count: 0 };

        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000) - 1;

        const filteredTrades = trades.filter(t => {
            if (t.status !== 'completed' || !t.createdAt) return false;
            const time = t.createdAt.seconds * 1000;
            return time >= start && time <= end;
        });

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

        const aggGiven = aggregateCards(allGiven);
        const aggReceived = aggregateCards(allReceived);

        return {
            given: aggGiven,
            received: aggReceived,
            valGiven: allGiven.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0),
            valReceived: allReceived.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0),
            count: filteredTrades.length
        };
    }, [isOpen, trades, currentUid, startDate, endDate]);

    if (!isOpen) return null;
    const balance = summary.valReceived - summary.valGiven;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-surface rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-border pb-4 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Bilan des Mouvements</h2>
                        <p className="text-sm text-muted mt-1">Analysez vos entrées et sorties d&apos;échange.</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-lg border border-border">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-surface text-foreground text-sm border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary" />
                        <span className="text-muted text-sm font-medium px-1">au</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-surface text-foreground text-sm border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    
                    <button onClick={onClose} className="text-muted hover:text-foreground text-2xl leading-none px-2">&times;</button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div className="bg-secondary/30 p-2 rounded-lg border border-border">
                        <p className="text-xs text-muted uppercase font-bold">Échanges</p>
                        <p className="text-xl font-bold text-foreground">{summary.count}</p>
                    </div>
                    <div className="bg-danger/10 p-2 rounded-lg border border-danger/20">
                        <p className="text-xs text-danger uppercase font-bold">Sortie</p>
                        <p className="text-xl font-bold text-danger">-{summary.valGiven.toFixed(2)} €</p>
                    </div>
                    <div className="bg-success/10 p-2 rounded-lg border border-success/20">
                        <p className="text-xs text-success uppercase font-bold">Entrée</p>
                        <p className="text-xl font-bold text-success">+{summary.valReceived.toFixed(2)} €</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 grow overflow-hidden min-h-0">
                    <CompactCardTable cards={summary.given} title="Cartes Sorties" colorClass="text-danger" emptyLabel="Aucune sortie." onPreview={dummyPreview} />
                    <CompactCardTable cards={summary.received} title="Cartes Entrées" colorClass="text-success" emptyLabel="Aucune entrée." onPreview={dummyPreview} />
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                    <span className="text-sm text-muted font-medium">Balance :</span>
                    <div className={`text-xl font-black ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                        {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                    </div>
                </div>
            </div>
        </div>
    );
};

const HistoryCard = ({ 
    trade, 
    currentUid,
    onPreview // Recoit le callback
}: { 
    trade: TradeRequest, 
    currentUid: string,
    onPreview: (c: CardType) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const isSender = trade.senderUid === currentUid;
    const partnerName = isSender ? trade.receiverName : trade.senderName;
    
    const givenCards = isSender ? trade.itemsGiven : trade.itemsReceived;
    const receivedCards = isSender ? trade.itemsReceived : trade.itemsGiven;
    
    const aggregatedGiven = useMemo(() => aggregateCards(givenCards), [givenCards]);
    const aggregatedReceived = useMemo(() => aggregateCards(receivedCards), [receivedCards]);

    const valGiven = givenCards.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
    const valReceived = receivedCards.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);

    const statusConfig: Record<string, { label: string, color: string, bg: string }> = {
        completed: { label: 'Terminé', color: 'text-success', bg: 'bg-success/10' },
        rejected: { label: 'Refusé', color: 'text-danger', bg: 'bg-danger/10' },
        cancelled: { label: 'Annulé', color: 'text-muted', bg: 'bg-secondary' },
    };
    const config = statusConfig[trade.status] || statusConfig['cancelled'];

    return (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden mb-3">
            <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-secondary/30 transition select-none" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase shrink-0 ${config.bg} ${config.color}`}>
                        {config.label}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">
                            {isSender ? `Envoyé à ${partnerName}` : `Reçu de ${partnerName}`}
                        </p>
                        <p className="text-xs text-muted">{formatDate(trade.createdAt)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6 text-sm w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                        <p className="text-muted text-[10px] uppercase font-bold">Donné</p>
                        <p className="font-medium text-danger">{givenCards.reduce((acc, c) => acc + c.quantity, 0)} cartes (~{valGiven.toFixed(2)}€)</p>
                    </div>
                    <div className="text-right">
                        <p className="text-muted text-[10px] uppercase font-bold">Reçu</p>
                        <p className="font-medium text-success">{receivedCards.reduce((acc, c) => acc + c.quantity, 0)} cartes (~{valReceived.toFixed(2)}€)</p>
                    </div>
                    <div className={`text-muted transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</div>
                </div>
            </div>

            {isOpen && (
                <div className="border-t border-border p-4 bg-background/50 grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-1">
                    <CompactCardTable cards={aggregatedGiven} title="Cartes Sorties" colorClass="text-danger" emptyLabel="-" onPreview={onPreview} />
                    <CompactCardTable cards={aggregatedReceived} title="Cartes Entrées" colorClass="text-success" emptyLabel="-" onPreview={onPreview} />
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
    
    // Etat Preview
    const [previewCard, setPreviewCard] = useState<CardType | null>(null);

    useEffect(() => {
        if (!user) return;

        const qSender = query(
            collection(db, 'trades'),
            where('senderUid', '==', user.uid),
            where('status', 'in', ['completed', 'rejected', 'cancelled']),
            orderBy('createdAt', 'desc')
        );

        const qReceiver = query(
            collection(db, 'trades'),
            where('receiverUid', '==', user.uid),
            where('status', 'in', ['completed', 'rejected', 'cancelled']),
            orderBy('createdAt', 'desc')
        );

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
            
            merged.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });
            
            setHistory(merged);
            setLoading(false);
        };

        const u1 = onSnapshot(qSender, (snap) => {
            sentData = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest));
            updateMerged();
        });

        const u2 = onSnapshot(qReceiver, (snap) => {
            receivedData = snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRequest));
            updateMerged();
        });

        return () => { u1(); u2(); };
    }, [user]);

    if (!user) return <div className="p-10 text-center text-muted">Connexion requise.</div>;

    return (
        <main className="container mx-auto p-4 max-w-4xl min-h-[85vh]">
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 mb-8 border-b border-border pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/trades" className="text-sm bg-secondary hover:bg-border text-foreground px-3 py-1.5 rounded-lg transition">
                        ← Retour
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground">Historique</h1>
                </div>
                
                <button 
                    onClick={() => setShowSummary(true)}
                    className="btn-primary text-sm flex items-center gap-2"
                >
                    Bilan sur Période
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-muted animate-pulse">Chargement...</div>
            ) : history.length === 0 ? (
                <div className="text-center py-20 bg-surface/50 rounded-xl border border-dashed border-border">
                    <p className="text-muted italic">Aucun historique d&apos;échange.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {history.map(trade => (
                        <HistoryCard 
                            key={trade.id} 
                            trade={trade} 
                            currentUid={user.uid} 
                            onPreview={setPreviewCard} 
                        />
                    ))}
                </div>
            )}

            <PeriodSummaryModal 
                isOpen={showSummary} 
                onClose={() => setShowSummary(false)} 
                trades={history} 
                currentUid={user.uid} 
            />

            {/* MODALE DE PRÉVISUALISATION */}
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
        </main>
    );
}