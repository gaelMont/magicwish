'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { TradeRequest } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { CardType } from '@/hooks/useCardCollection';

const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

// Sous-composant liste compacte
const CompactCardList = ({ cards, title, colorClass }: { cards: CardType[], title: string, colorClass: string }) => (
    <div className="flex flex-col h-full">
        <h4 className={`text-xs font-bold uppercase mb-2 flex items-center gap-2 ${colorClass}`}>
            {title} ({cards.length})
        </h4>
        <div className="bg-surface border border-border rounded-lg overflow-hidden grow">
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs text-left">
                    <thead className="bg-secondary text-muted sticky top-0">
                        <tr>
                            <th className="px-3 py-2 font-medium">Qté</th>
                            <th className="px-3 py-2 font-medium">Nom</th>
                            <th className="px-3 py-2 font-medium text-right">Prix</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {cards.map((c, i) => (
                            <tr key={i} className="hover:bg-secondary/50 transition-colors">
                                <td className="px-3 py-2 font-bold w-12 text-foreground">{c.quantity}x</td>
                                <td className="px-3 py-2">
                                    <span className="font-medium text-foreground">{c.name}</span>
                                    <span className="ml-2 text-[10px] text-muted bg-secondary px-1.5 rounded border border-border">
                                        {c.setCode?.toUpperCase()}
                                    </span>
                                    {c.isFoil && <span className="ml-1 text-[9px] text-amber-500 font-bold">Foil</span>}
                                </td>
                                <td className="px-3 py-2 text-right text-muted w-20">
                                    {(c.price || 0).toFixed(2)}€
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

const HistoryCard = ({ trade, currentUid }: { trade: TradeRequest, currentUid: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const isSender = trade.senderUid === currentUid;
    const partnerName = isSender ? trade.receiverName : trade.senderName;
    
    const givenCards = isSender ? trade.itemsGiven : trade.itemsReceived;
    const receivedCards = isSender ? trade.itemsReceived : trade.itemsGiven;
    
    const valGiven = givenCards.reduce((acc, c) => acc + (c.price || 0), 0);
    const valReceived = receivedCards.reduce((acc, c) => acc + (c.price || 0), 0);

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
                    <CompactCardList cards={givenCards} title="📤 Vous avez donné" colorClass="text-danger" />
                    <CompactCardList cards={receivedCards} title="📥 Vous avez reçu" colorClass="text-success" />
                </div>
            )}
        </div>
    );
};

export default function TradeHistoryPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState<TradeRequest[]>([]);
    const [loading, setLoading] = useState(true);

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
            <div className="flex items-center gap-4 mb-8 border-b border-border pb-4">
                <Link href="/trades" className="text-sm bg-secondary hover:bg-border text-foreground px-3 py-1.5 rounded-lg transition">
                    ← Retour
                </Link>
                <h1 className="text-2xl font-bold text-foreground">Historique</h1>
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
        </main>
    );
}