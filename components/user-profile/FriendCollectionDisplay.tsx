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
    
    // --- ÉTATS ---
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
                case 'name': return a.name.localeCompare(b.name);
                case 'price_desc': return priceB - priceA;
                case 'price_asc': return priceA - priceB;
                case 'quantity': return b.quantity - a.quantity;
                default: return 0;
            }
        });

        return result;
    }, [cards, searchQuery, sortBy, filterSet, filterTrade, filterFoil, filterMatch, myWishlistMap, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);
    
    if (loading) return <p className="text-center p-10 text-muted">Chargement...</p>;
    
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
            />

            {filteredAndSortedCards.length === 0 ? (
                <div className="text-center py-16 bg-secondary/30 rounded-xl border-dashed border-2 border-border"><p className="text-muted italic">Aucun résultat.</p></div>
            ) : (
                <div className="grid gap-4 animate-in fade-in" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                    {filteredAndSortedCards.map((card) => (
                        <MagicCard key={card.id} {...card} readOnly={true} returnTo={`/user/${targetUid}`} matchStatus={card.isMatch ? 'my_wishlist' : undefined} />
                    ))}
                </div>
            )}
        </div>
    );
}