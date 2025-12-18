// components/trades/TradeSourceTable.tsx
'use client';

import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';

// Helper pour s'assurer que nous travaillons avec le type attendu

interface TradeSourceTableProps {
    cards: CardType[];
    onAdd: (c: CardType) => void;
    buttonColorClass: 'text-danger' | 'text-success' | 'text-blue-600';
    loading?: boolean;
}

export default function TradeSourceTable({ 
    cards, 
    onAdd, 
    buttonColorClass, 
    loading 
}: TradeSourceTableProps) {
    if (loading) return <p className="text-xs text-muted text-center py-4">Chargement...</p>;
    if (cards.length === 0) return <p className="text-xs text-muted text-center py-4">Aucune carte trouvée.</p>;
    
    return (
        <div className="overflow-y-auto custom-scrollbar flex-1 bg-surface">
            <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-background text-muted sticky top-0 z-10 font-semibold uppercase">
                    <tr>
                        <th className="px-2 py-2 text-center w-8">Dispo</th>
                        <th className="px-2 py-2">Nom</th>
                        <th className="px-2 py-2 w-12 text-center">Set</th>
                        <th className="px-2 py-2 w-10 text-center">N°</th>
                        <th className="px-2 py-2 w-10 text-center">Foil</th>
                        <th className="px-2 py-2 w-8"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {cards.map((card, i) => {
                        const scryData = card.scryfallData as ScryfallRawData | undefined;
                        const collectorNum = scryData?.collector_number || '?';
                        const tradeQty = card.quantityForTrade ?? 0;
                        
                        return (
                            <tr 
                                key={`${card.id}-${i}`} 
                                className="hover:bg-secondary/50 transition-colors text-foreground cursor-pointer group select-none" 
                                onClick={() => onAdd(card)}
                            >
                                <td className="px-2 py-1.5 text-center text-muted font-mono">{tradeQty}</td>
                                <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={card.name}>{card.name}</td>
                                <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{card.setCode?.toUpperCase()}</span></td>
                                <td className="px-2 py-1.5 text-center text-muted font-mono text-[10px]">{collectorNum}</td>
                                <td className="px-2 py-1.5 text-center">{card.isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">Foil</span>}</td>
                                <td className="px-2 py-1.5 text-center">
                                    <button className={`${buttonColorClass} font-bold hover:scale-125 transition-transform`}>+</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}