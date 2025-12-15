// components/trades/TradeSelectionTable.tsx
'use client';

import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';

interface TradeSelectionTableProps {
    cards: CardType[];
    onRemove: (id: string) => void;
    onUpdatePrice: (id: string, newPrice: number) => void;
    colorClass: 'text-danger' | 'text-success';
    emptyLabel: string;
}

export default function TradeSelectionTable({ 
    cards, 
    onRemove, 
    onUpdatePrice, 
    colorClass, 
    emptyLabel 
}: TradeSelectionTableProps) {
    if (cards.length === 0) return (
        <div className="flex-1 flex items-center justify-center border-b border-border bg-secondary/10 text-muted text-sm italic p-8">{emptyLabel}</div>
    );
    
    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-surface border-b border-border shadow-sm">
            <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-secondary text-muted sticky top-0 z-10 font-semibold uppercase">
                        <tr>
                            <th className="px-2 py-2 text-center w-8">Qté</th>
                            <th className="px-2 py-2">Nom</th>
                            <th className="px-2 py-2 w-10 text-center">Set</th>
                            <th className="px-2 py-2 w-10 text-center">N°</th>
                            <th className="px-2 py-2 w-10 text-center">Foil</th>
                            <th className="px-2 py-2 text-right w-16">Prix</th>
                            <th className="px-2 py-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {cards.map((card, i) => {
                            const key = `${card.id}-${i}`; 
                            const currentPrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);
                            const scryData = card.scryfallData as ScryfallRawData | undefined;
                            const collectorNum = scryData?.collector_number || '?';
                            
                            return (
                                <tr key={key} className="hover:bg-secondary/50 transition-colors text-foreground select-none">
                                    <td className={`px-2 py-1.5 text-center font-bold ${colorClass} bg-opacity-10`}>{card.quantity}</td>
                                    <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={card.name}>{card.name}</td>
                                    <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{card.setCode?.toUpperCase()}</span></td>
                                    <td className="px-2 py-1.5 text-center text-muted font-mono text-[10px]">{collectorNum}</td>
                                    <td className="px-2 py-1.5 text-center">{card.isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">Foil</span>}</td>
                                    
                                    {/* INPUT PRIX */}
                                    <td className="px-2 py-1.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <input 
                                                type="number" 
                                                min="0" 
                                                step="0.01"
                                                className="w-16 p-1 text-right bg-background border border-border rounded text-xs outline-none focus:border-primary"
                                                value={currentPrice}
                                                onChange={(e) => onUpdatePrice(card.id, parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="text-muted">€</span>
                                        </div>
                                    </td>
                                    
                                    <td className="px-2 py-1.5 text-center"><button onClick={() => onRemove(card.id)} className="text-muted hover:text-danger transition px-1 font-bold">✕</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}