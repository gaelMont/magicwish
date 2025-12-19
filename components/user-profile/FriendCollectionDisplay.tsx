// components/user-profile/FriendCollectionDisplay.tsx
'use client';

import { useState, useMemo } from 'react';
import MagicCard from '@/components/MagicCard';
import { CardType } from '@/hooks/useCardCollection';
import { SortOption } from '@/hooks/useSortPreference';
import CardListFilterBar from '@/components/common/CardListFilterBar'; 

interface CardWithMatchStatus extends CardType {
    isMatch?: boolean;
}

interface FriendCollectionDisplayProps {
    cards: CardType[];
    loading: boolean;
    totalPrice: number; 
    targetUid: string;
    myWishlistMap: Map<string, CardType>; 
    myTradeBinderMap: Map<string, CardType>;
    columns: number;
    setColumns: (val: number) => void;
    sortBy: SortOption;
    setSortBy: (val: SortOption) => void;
}

const getMatchStatus = (card: CardType, myWishlistMap: Map<string, CardType>): boolean => {
    if (myWishlistMap.has(card.id)) return true; 
    if (!card.isSpecificVersion && myWishlistMap.has(card.name.toLowerCase())) return true;
    return false;
};

export default function FriendCollectionDisplay({
    cards, loading, targetUid, myWishlistMap, columns, setColumns, sortBy, setSortBy,
}: FriendCollectionDisplayProps) {
    
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSet, setFilterSet] = useState<string>('all');
    const [filterTrade, setFilterTrade] = useState(false);
    const [filterFoil, setFilterFoil] = useState(false);
    const [filterMatch, setFilterMatch] = useState(false);
    const [minPriceFilter, setMinPriceFilter] = useState<string>('');
    const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
    const [filterCMC, setFilterCMC] = useState<string>('');
    const [filterColors, setFilterColors] = useState<string[]>([]);

    const filteredAndSortedCards = useMemo(() => {
        if (!cards) return [];
        let result: CardWithMatchStatus[] = cards.map((card) => ({
            ...card,
            isMatch: getMatchStatus(card, myWishlistMap) 
        }));
        
        const minPrice = parseFloat(minPriceFilter);
        const maxPrice = parseFloat(maxPriceFilter);

        if (searchQuery) result = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (filterSet !== 'all') result = result.filter(c => c.setName === filterSet);
        if (filterTrade) result = result.filter(c => (c.quantityForTrade ?? 0) > 0);
        if (filterFoil) result = result.filter(c => c.isFoil);
        if (filterMatch) result = result.filter(c => c.isMatch);
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            result = result.filter(c => {
                const p = c.customPrice ?? c.price ?? 0;
                return (isNaN(minPrice) || p >= minPrice) && (isNaN(maxPrice) || p <= maxPrice);
            });
        }
        if (filterCMC) { const t = parseFloat(filterCMC); if (!isNaN(t)) result = result.filter(c => c.cmc === t); }
        if (filterColors.length > 0) {
            result = result.filter(c => {
                if (!c.colors || c.colors.length === 0) return filterColors.includes('C');
                return c.colors.every(col => filterColors.includes(col));
            });
        }

        result.sort((a, b) => {
            const priceA = a.customPrice ?? a.price ?? 0;
            const priceB = b.customPrice ?? b.price ?? 0;
            switch (sortBy) {
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'price_asc': return priceA - priceB;
                case 'price_desc': return priceB - priceA;
                case 'quantity_asc': return a.quantity - b.quantity;
                case 'quantity_desc': return b.quantity - a.quantity;
                case 'cmc_asc': return (a.cmc ?? 0) - (b.cmc ?? 0);
                case 'cmc_desc': return (b.cmc ?? 0) - (a.cmc ?? 0);
                case 'set_asc': return (a.setName || '').localeCompare(b.setName || '');
                case 'set_desc': return (b.setName || '').localeCompare(a.setName || '');
                default: return 0;
            }
        });
        return result;
    }, [cards, searchQuery, sortBy, filterSet, filterTrade, filterFoil, filterMatch, myWishlistMap, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);
    
    if (loading) return <p className="text-center p-10 text-muted font-bold uppercase text-xs animate-pulse">Chargement...</p>;
    
    return (
        <div className="space-y-6">
            <CardListFilterBar
                context="friend-collection"
                cards={cards}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                sortBy={sortBy} setSortBy={setSortBy}
                filterSet={filterSet} setFilterSet={setFilterSet}
                filterTrade={filterTrade} setFilterTrade={setFilterTrade}
                filterFoil={filterFoil} setFilterFoil={setFilterFoil}
                filterMatch={filterMatch} setFilterMatch={setFilterMatch}
                minPriceFilter={minPriceFilter} setMinPriceFilter={setMinPriceFilter}
                maxPriceFilter={maxPriceFilter} setMaxPriceFilter={setMaxPriceFilter}
                filterCMC={filterCMC} setFilterCMC={setFilterCMC}
                filterColors={filterColors} setFilterColors={setFilterColors}
                columns={columns} setColumns={setColumns}
                hideSliderOnMobile={true}
            />

            {filteredAndSortedCards.length === 0 ? (
                <div className="text-center py-16 bg-surface rounded-3xl border-dashed border-2 border-border shadow-inner"><p className="text-muted italic font-medium uppercase text-xs">Aucun résultat.</p></div>
            ) : (
                <div 
                    className="grid gap-4 md:gap-6 animate-in fade-in grid-cols-2 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" 
                    style={{ '--cols': columns } as React.CSSProperties}
                >
                    {filteredAndSortedCards.map((card) => (
                        <MagicCard key={card.id} {...card} readOnly={true} returnTo={`/user/${targetUid}`} matchStatus={card.isMatch ? 'my_wishlist' : undefined} />
                    ))}
                </div>
            )}
        </div>
    );
}