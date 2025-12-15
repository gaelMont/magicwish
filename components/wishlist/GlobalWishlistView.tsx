// components/wishlist/GlobalWishlistView.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { WishlistMeta } from '@/hooks/useWishlists';
import { CardType } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { SortOption } from '@/hooks/useSortPreference'; 
import CardListFilterBar from '@/components/common/CardListFilterBar';

type Props = {
    lists: WishlistMeta[];
};

export default function GlobalWishlistView({ lists }: Props) {
    const { user } = useAuth();
    const [allCards, setAllCards] = useState<(CardType & { sourceListName: string })[]>([]);
    const [loading, setLoading] = useState(true);
    
    // --- FILTRES ---
    const { columns, setColumns } = useColumnPreference('mw_cols_wishlist_global', 5);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name');
    const [filterSet, setFilterSet] = useState<string>('all');
    const [filterFoil, setFilterFoil] = useState(false);
    const [minPriceFilter, setMinPriceFilter] = useState<string>('');
    const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
    const [filterCMC, setFilterCMC] = useState<string>('');
    const [filterColors, setFilterColors] = useState<string[]>([]);

    useEffect(() => {
        if (!user || lists.length === 0) return;
        const fetchAll = async () => {
            setLoading(true);
            let combined: (CardType & { sourceListName: string })[] = [];
            try {
                const defaultRef = collection(db, 'users', user.uid, 'wishlist');
                const defaultSnap = await getDocs(defaultRef);
                const defaultCards = defaultSnap.docs.map(d => ({ ...d.data(), id: d.id, sourceListName: 'Liste principale' })) as (CardType & { sourceListName: string })[];
                combined = [...defaultCards];

                const customLists = lists.filter(l => l.id !== 'default');
                const promises = customLists.map(async (list) => {
                    const colRef = collection(db, 'users', user.uid, 'wishlists_data', list.id, 'cards');
                    const snap = await getDocs(colRef);
                    return snap.docs.map(d => ({ ...d.data(), id: d.id, sourceListName: list.name })) as (CardType & { sourceListName: string })[];
                });
                const results = await Promise.all(promises);
                results.forEach(res => combined = [...combined, ...res]);
                setAllCards(combined);
            } catch (e) { console.error(e); toast.error("Erreur chargement global"); } 
            finally { setLoading(false); }
        };
        fetchAll();
    }, [user, lists]);

    const filteredAndSortedCards = useMemo(() => {
        let result = [...allCards];
        const min = parseFloat(minPriceFilter);
        const max = parseFloat(maxPriceFilter);
        
        if (searchQuery) result = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (filterSet !== 'all') result = result.filter(c => c.setName === filterSet);
        if (filterFoil) result = result.filter(c => c.isFoil);
        if (!isNaN(min) || !isNaN(max)) result = result.filter(c => { const p = c.price??0; return (isNaN(min)||p>=min) && (isNaN(max)||p<=max); });
        
        if (filterCMC) { const t = parseFloat(filterCMC); if (!isNaN(t)) result = result.filter(c => c.cmc === t); }
        
        if (filterColors.length > 0) {
            result = result.filter(c => {
                if (!c.colors || c.colors.length === 0) return filterColors.includes('C');
                return c.colors.every(col => filterColors.includes(col));
            });
        }

        result.sort((a, b) => {
            const priceA = a.price ?? 0; const priceB = b.price ?? 0;
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'price_desc': return priceB - priceA;
                case 'price_asc': return priceA - priceB;
                default: return 0;
            }
        });
        return result;
    }, [allCards, searchQuery, sortBy, filterSet, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);

    const globalTotal = useMemo(() => allCards.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0), [allCards]);

    if (loading) return <div className="p-10 text-center animate-pulse text-muted">Fusion en cours...</div>;

    return (
        <div className="animate-in fade-in duration-300">
             <div className="flex flex-col md:flex-row justify-between items-end mb-6 border-b pb-4 border-border bg-linear-to-r from-primary/10 to-transparent p-4 rounded-t-xl gap-4">
                <div><h2 className="text-2xl font-bold text-foreground">Vue Globale</h2><p className="text-sm text-muted mt-1">{allCards.length} cartes fusionnées</p></div>
                <div className="text-right"><span className="text-xs text-muted uppercase font-semibold">Total</span><p className="text-3xl font-bold text-primary">{globalTotal.toFixed(2)} €</p></div>
            </div>

            <CardListFilterBar
                context="wishlist-global" 
                cards={allCards}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                sortBy={sortBy} setSortBy={setSortBy}
                filterSet={filterSet} setFilterSet={setFilterSet}
                filterTrade={false} setFilterTrade={() => {}}
                filterFoil={filterFoil} setFilterFoil={setFilterFoil}
                minPriceFilter={minPriceFilter} setMinPriceFilter={setMinPriceFilter}
                maxPriceFilter={maxPriceFilter} setMaxPriceFilter={setMaxPriceFilter}
                filterCMC={filterCMC} setFilterCMC={setFilterCMC}
                filterColors={filterColors} setFilterColors={setFilterColors}
                columns={columns} setColumns={setColumns}
            />

            {filteredAndSortedCards.length === 0 ? <div className="text-center py-12"><p className="text-muted italic">Aucun résultat.</p></div> : (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                    {filteredAndSortedCards.map((card, idx) => (
                        <div key={`${card.id}-${idx}`} className="relative group">
                            <div className="absolute top-0 right-0 z-30 bg-black/70 text-white text-[10px] px-2 py-1 rounded-bl-lg backdrop-blur-sm pointer-events-none">{card.sourceListName}</div>
                            <MagicCard {...card} isWishlist={false} readOnly={true} returnTo="/wishlist" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}