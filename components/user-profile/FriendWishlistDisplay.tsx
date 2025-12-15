// components/user-profile/FriendWishlistDisplay.tsx
'use client';

import { useState, useMemo } from 'react';
import { CardType } from '@/hooks/useCardCollection';
import { WishlistMeta } from '@/hooks/useWishlists';
import { SortOption } from '@/hooks/useSortPreference'; 
import MagicCard from '@/components/MagicCard';
import { useCardCollection } from '@/hooks/useCardCollection';
import CardListFilterBar from '@/components/common/CardListFilterBar'; // RÉUTILISABLE

// NOUVELLE INTERFACE POUR GÉRER LA PROPRIÉTÉ DYNAMIQUE 'isMatch'
interface CardWithMatchStatus extends CardType {
    isMatch?: boolean;
}

interface FriendWishlistDisplayProps {
    targetUid: string;
    wishlistsMeta: WishlistMeta[];
    myTradeBinderMap: Map<string, CardType>;
    myWishlistMap: Map<string, CardType>;
    columns: number;
    setColumns: (val: number) => void;
}

const getMatchStatus = (card: CardType, myTradeBinderMap: Map<string, CardType>): boolean => {
    if (myTradeBinderMap.has(card.id)) return true; 
    if (!card.isSpecificVersion && myTradeBinderMap.has(card.name.toLowerCase())) return true;
    return false;
};


export default function FriendWishlistDisplay({
    targetUid,
    wishlistsMeta,
    myTradeBinderMap,
    columns,
    setColumns,
}: FriendWishlistDisplayProps) {
    const [selectedListId, setSelectedListId] = useState('default');
    
    // --- ÉTATS DE FILTRE ET TRI ---
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name');
    const [filterSet, setFilterSet] = useState<string>('all');
    const [filterFoil, setFilterFoil] = useState(false);
    const [filterMatch, setFilterMatch] = useState(false);
    const [minPriceFilter, setMinPriceFilter] = useState<string>('');
    const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
    // ----------------------------

    const { cards, loading, totalPrice } = useCardCollection('wishlist', selectedListId, targetUid);
    
    const currentListName = wishlistsMeta.find(l => l.id === selectedListId)?.name || 'Liste Principale';
    
    const filteredAndSortedCards = useMemo(() => {
        
        if (!cards) return [];
        
        let result: CardWithMatchStatus[] = cards.map((card: CardType) => ({
            ...card,
            isMatch: getMatchStatus(card, myTradeBinderMap) 
        }));
        
        const minPrice = parseFloat(minPriceFilter);
        const maxPrice = parseFloat(maxPriceFilter);
        
        // 1. Filtrage par recherche
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter((c: CardWithMatchStatus) => c.name.toLowerCase().includes(lowerQ));
        }
        
        // ADD SET FILTER
        if (filterSet !== 'all') {
            result = result.filter((c: CardWithMatchStatus) => c.setName === filterSet);
        }

        // 2. Filtrage Foil
        if (filterFoil) {
            result = result.filter((c: CardWithMatchStatus) => c.isFoil);
        }

        // 3. Filtre Match
        if (filterMatch) {
            result = result.filter((c: CardWithMatchStatus) => c.isMatch);
        }
        
        // 4. Filtrage Prix
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            result = result.filter((c: CardWithMatchStatus) => {
                const cardPrice = c.price ?? 0;
                const isAboveMin = isNaN(minPrice) || cardPrice >= minPrice;
                const isBelowMax = isNaN(maxPrice) || cardPrice <= maxPrice;
                return isAboveMin && isBelowMax;
            });
        }


        // 5. Tri
        result.sort((a: CardWithMatchStatus, b: CardWithMatchStatus) => {
            const priceA = a.price ?? 0;
            const priceB = b.price ?? 0;
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'price_desc': return priceB - priceA;
                case 'price_asc': return priceA - priceB;
                default: return 0;
            }
        });

        return result;
    }, [cards, searchQuery, sortBy, filterSet, filterFoil, filterMatch, myTradeBinderMap, minPriceFilter, maxPriceFilter]);

    const availableSets: string[] = useMemo(() => {
        if (!cards) return [];
        const sets = new Set(cards.map((c: CardType) => c.setName).filter((s): s is string => !!s));
        return Array.from(sets).sort();
    }, [cards]);

    return (
        <div className="space-y-6">
            
            <div className="bg-surface p-4 rounded-xl border border-border shadow-sm flex flex-col gap-4">
                
                {/* LIGNE SELECTION + TOTAL (Déplacée du bas) */}
                <div className="flex flex-wrap gap-4 items-center border-b border-border/50 pb-3">
                     <div className="min-w-[200px] grow">
                        <label className="block text-xs font-bold text-muted mb-1 uppercase">Liste de Souhaits</label>
                        <select 
                            value={selectedListId} 
                            onChange={(e) => setSelectedListId(e.target.value)} 
                            className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer focus:ring-2 focus:ring-purple-600 outline-none"
                        >
                            {wishlistsMeta.map((list: WishlistMeta) => (
                                <option key={list.id} value={list.id}>{list.name}</option>
                            ))}
                        </select>
                    </div>
                    
                     <div className="text-right ml-auto">
                        <span className="text-xs text-muted uppercase font-semibold">Total estimé</span>
                        <p className="text-2xl font-bold text-success">{totalPrice.toFixed(2)} €</p>
                    </div>
                </div>
                
                {/* UTILISATION DU COMPOSANT RÉUTILISABLE */}
                <CardListFilterBar
                    context="friend-wishlist"
                    cards={cards}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    filterSet={filterSet}
                    setFilterSet={setFilterSet}
                    filterTrade={false} // Non pertinent pour la wishlist
                    setFilterTrade={() => {}}
                    filterFoil={filterFoil}
                    setFilterFoil={setFilterFoil}
                    filterMatch={filterMatch}
                    setFilterMatch={setFilterMatch}
                    minPriceFilter={minPriceFilter}
                    setMinPriceFilter={setMinPriceFilter}
                    maxPriceFilter={maxPriceFilter}
                    setMaxPriceFilter={setMaxPriceFilter}
                    columns={columns}
                    setColumns={setColumns}
                />
            </div>

            {/* Grille des cartes */}
            {loading ? (
                <p className="text-center p-10 text-muted">Chargement de la wishlist...</p>
            ) : filteredAndSortedCards.length === 0 ? (
                 <div className="text-center py-16 bg-secondary/30 rounded-xl border-dashed border-2 border-border">
                    <p className="text-muted italic">La liste &apos;{currentListName}&apos; est vide ou ne correspond pas aux filtres.</p>
                </div>
            ) : (
                <div 
                    className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{ 
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
                    }}
                >
                    {filteredAndSortedCards.map((card: CardWithMatchStatus) => (
                        <MagicCard 
                            key={card.id} 
                            {...card} 
                            readOnly={true}
                            returnTo={`/user/${targetUid}`}
                            isWishlist={true}
                            matchStatus={card.isMatch ? 'my_trade_binder' : undefined} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
}