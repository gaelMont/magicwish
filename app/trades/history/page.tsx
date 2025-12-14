'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { CardType } from '@/hooks/useCardCollection';

// --- UTILITAIRES ---

const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
};

// Fusionne les cartes identiques pour l'affichage du bilan
const aggregateCards = (cards: CardType[]) => {
    const map = new Map<string, CardType>();
    
    cards.forEach(card => {
        // On distingue les versions Foil des versions Normales
        const key = `${card.name}-${card.setCode}-${card.isFoil ? 'foil' : 'normal'}`;
        
        if (map.has(key)) {
            const existing = map.get(key)!;
            existing.quantity += card.quantity;
        } else {
            map.set(key, { ...card });
        }
    });

    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
};

// --- COMPOSANTS UI ---

const CompactCardList = ({ cards, title, colorClass, emptyLabel }: { cards: CardType[], title: string, colorClass: string, emptyLabel: string }) => (
    <div className="flex flex-col h-full bg-surface border border-border rounded-lg overflow-hidden">
        <div className={`p-3 border-b border-border ${colorClass} bg-opacity-10 bg-current`}>
            <h4 className="text-xs font-bold uppercase flex items-center justify-between">
                {title} 
                <span className="bg-surface px-2 py-0.5 rounded-full text-foreground shadow-sm border border-border">{cards.reduce((acc, c) => acc + c.quantity, 0)}</span>
            </h4>
        </div>
        
        <div className="grow relative bg-background/50">
            {cards.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted text-xs italic p-4 text-center">
                    {emptyLabel}
                </div>
            ) : (
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-secondary text-muted sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-3 py-2 font-medium w-10">Qté</th>
                                <th className="px-3 py-2 font-medium">Nom</th>
                                <th className="px-3 py-2 font-medium text-right">Valeur</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {cards.map((c, i) => (
                                <tr key={i} className="hover:bg-secondary/50 transition-colors">
                                    <td className="px-3 py-2 font-bold text-foreground">{c.quantity}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-foreground truncate max-w-[120px]" title={c.name}>{c.name}</span>
                                            <span className="text-[9px] text-muted bg-secondary px-1 rounded border border-border">
                                                {c.setCode?.toUpperCase()}
                                            </span>
                                            {c.isFoil && (
                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-1 rounded">
                                                    Foil
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-muted tabular-nums">
                                        {(c.price || 0).toFixed(2)}€
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
);

// --- MODALE BILAN ---
const PeriodSummaryModal = ({ 
    isOpen, 
    onClose, 
    trades, 
    currentUid 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    trades: TradeRequest[], 
    currentUid: string 
}) => {
    // Dates par défaut : Les 30 derniers jours
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const summary = useMemo(() => {
        if (!isOpen) return { given: [], received: [], valGiven: 0, valReceived: 0, count: 0 };

        const start = new Date(startDate).getTime();
        // On ajoute 1 jour à la date de fin pour inclure toute la journée sélectionnée
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
            valGiven: aggGiven.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0),
            valReceived: aggReceived.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0),
            count: filteredTrades.length
        };
    }, [isOpen, trades, currentUid, startDate, endDate]);

    if (!isOpen) return null;

    const balance = summary.valReceived - summary.valGiven;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-surface rounded-xl p-6 max-w-4xl w-full shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Header avec Sélecteur de Dates */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-border pb-4 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Bilan des Mouvements
                        </h2>
                        <p className="text-sm text-muted mt-1">
                            Analysez vos entrées et sorties d&apos;échange.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-lg border border-border">
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-surface text-foreground text-sm border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-muted text-sm font-medium px-1">au</span>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-surface text-foreground text-sm border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    
                    <button onClick={onClose} className="text-muted hover:text-foreground text-2xl leading-none px-2">&times;</button>
                </div>

                {/* Résumé Chiffré */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div className="bg-secondary/30 p-2 rounded-lg border border-border">
                        <p className="text-xs text-muted uppercase font-bold">Échanges</p>
                        <p className="text-xl font-bold text-foreground">{summary.count}</p>
                    </div>
                    <div className="bg-danger/10 p-2 rounded-lg border border-danger/20">
                        <p className="text-xs text-danger uppercase font-bold">Sortie Totale</p>
                        <p className="text-xl font-bold text-danger">-{summary.valGiven.toFixed(2)} €</p>
                    </div>
                    <div className="bg-success/10 p-2 rounded-lg border border-success/20">
                        <p className="text-xs text-success uppercase font-bold">Entrée Totale</p>
                        <p className="text-xl font-bold text-success">+{summary.valReceived.toFixed(2)} €</p>
                    </div>
                </div>

                {/* Listes Entrées / Sorties */}
                <div className="grid md:grid-cols-2 gap-6 grow overflow-hidden min-h-0">
                    <CompactCardList 
                        cards={summary.given} 
                        title="Cartes Sorties" 
                        colorClass="text-danger" 
                        emptyLabel="Aucune carte donnée sur cette période."
                    />
                    <CompactCardList 
                        cards={summary.received} 
                        title="Cartes Entrées" 
                        colorClass="text-success" 
                        emptyLabel="Aucune carte reçue sur cette période."
                    />
                </div>

                {/* Footer Balance */}
                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                    <span className="text-sm text-muted font-medium">Balance sur la période :</span>
                    <div className={`text-xl font-black ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                        {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                    </div>
                </div>

            </div>
        </div>
    );
};

const HistoryCard = ({ trade, currentUid }: { trade: TradeRequest, currentUid: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const isSender = trade.senderUid === currentUid;
    const partnerName = isSender ? trade.receiverName : trade.senderName;
    
    const givenCards = isSender ? trade.itemsGiven : trade.itemsReceived;
    const receivedCards = isSender ? trade.itemsReceived : trade.itemsGiven;
    
    const valGiven = givenCards.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);
    const valReceived = receivedCards.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);

    const statusConfig: Record<string, { label: string, color: string, bg: string }> = {
        completed: { label: 'Terminé', color: 'text-success', bg: 'bg-success/10' },
        rejected: { label: 'Refusé', color: 'text-danger', bg: 'bg-danger/10' },
        cancelled: { label: 'Annulé', color: 'text-muted', bg: 'bg-secondary' },
    };

    const config = statusConfig[trade.status] || statusConfig['cancelled'];

    return (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden mb-3">
            <div 
                className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-secondary/30 transition"
                onClick={() => setIsOpen(!isOpen)}
            >
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
                        <p className="font-medium text-danger">{givenCards.length} cartes (~{valGiven.toFixed(0)}€)</p>
                    </div>
                    <div className="text-right">
                        <p className="text-muted text-[10px] uppercase font-bold">Reçu</p>
                        <p className="font-medium text-success">{receivedCards.length} cartes (~{valReceived.toFixed(0)}€)</p>
                    </div>
                    <div className={`text-muted transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</div>
                </div>
            </div>

            {isOpen && (
                <div className="border-t border-border p-4 bg-background/50 grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-1">
                    <CompactCardList cards={givenCards} title="Cartes Données" colorClass="text-danger" emptyLabel="-" />
                    <CompactCardList cards={receivedCards} title="Cartes Reçues" colorClass="text-success" emptyLabel="-" />
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
            const merged = [...sentData, ...receivedData].sort((a, b) => {
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

    if (!user) return <div className="p-10 text-center text-muted">Veuillez vous connecter.</div>;

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
                        <HistoryCard key={trade.id} trade={trade} currentUid={user.uid} />
                    ))}
                </div>
            )}

            <PeriodSummaryModal 
                isOpen={showSummary} 
                onClose={() => setShowSummary(false)} 
                trades={history} 
                currentUid={user.uid} 
            />
        </main>
    );
}