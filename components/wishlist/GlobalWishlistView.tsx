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
import CardListFilterBar from '@/components/common/CardListFilterBar';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import { useColumnPreference } from '@/hooks/useColumnPreference';

const ITEMS_PER_PAGE = 50;

type Props = {
    lists: WishlistMeta[];
};

type CardSource = CardType & { sourceListName: string };

export default function GlobalWishlistView({ lists }: Props) {
    const { user } = useAuth();
    const [allCards, setAllCards] = useState<CardSource[]>([]);
    const [loading, setLoading] = useState(true);
    
    // --- GESTION DES PREFERENCES (Colonnes & Tri) ---
    const { columns, setColumns } = useColumnPreference('mw_cols_wishlist_global', 5);
    const { sortBy, setSortBy } = useSortPreference('mw_sort_wishlist_global', 'name_asc' as SortOption);

    // --- ETATS DES FILTRES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSet, setFilterSet] = useState<string>('all');
    const [filterFoil, setFilterFoil] = useState(false);
    const [minPriceFilter, setMinPriceFilter] = useState<string>('');
    const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
    const [filterCMC, setFilterCMC] = useState<string>('');
    const [filterColors, setFilterColors] = useState<string[]>([]);

    // --- PAGINATION ---
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    useEffect(() => {
        if (!user || lists.length === 0) return;

        const fetchAll = async () => {
            setLoading(true);
            let combined: CardSource[] = [];

            try {
                // A. Liste par défaut
                const defaultRef = collection(db, 'users', user.uid, 'wishlist');
                const defaultSnap = await getDocs(defaultRef);
                const defaultCards = defaultSnap.docs.map(d => ({ 
                    ...d.data(), 
                    id: d.id, 
                    sourceListName: 'Liste principale' 
                })) as CardSource[];
                combined = [...defaultCards];

                // B. Listes customs
                const customLists = lists.filter(l => l.id !== 'default');
                const promises = customLists.map(async (list) => {
                    const colRef = collection(db, 'users', user.uid, 'wishlists_data', list.id, 'cards');
                    const snap = await getDocs(colRef);
                    return snap.docs.map(d => ({
                        ...d.data(),
                        id: d.id,
                        sourceListName: list.name
                    })) as CardSource[];
                });

                const results = await Promise.all(promises);
                results.forEach(res => { combined = [...combined, ...res]; });

                setAllCards(combined);
            } catch (error) {
                console.error("Erreur chargement global", error);
                toast.error("Erreur lors du chargement global");
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [user, lists]);

    // Reset pagination quand on filtre
    useEffect(() => {
        if (visibleCount !== ITEMS_PER_PAGE) {
            setVisibleCount(ITEMS_PER_PAGE);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filterSet, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors, sortBy]);

    // --- LOGIQUE DE FILTRAGE ET TRI ---
    const filteredAndSortedCards = useMemo(() => {
        let result = [...allCards];
        
        const minPrice = parseFloat(minPriceFilter);
        const maxPrice = parseFloat(maxPriceFilter);

        // 1. Filtres
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(c => c.name.toLowerCase().includes(lowerQ));
        }
        if (filterSet !== 'all') {
            result = result.filter(c => c.setName === filterSet);
        }
        if (filterFoil) {
            result = result.filter(c => c.isFoil);
        }
        
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            result = result.filter(c => {
                const cardPrice = c.price ?? 0;
                const isAboveMin = isNaN(minPrice) || cardPrice >= minPrice;
                const isBelowMax = isNaN(maxPrice) || cardPrice <= maxPrice;
                return isAboveMin && isBelowMax;
            });
        }

        if (filterCMC) { 
            const t = parseFloat(filterCMC); 
            if (!isNaN(t)) result = result.filter(c => c.cmc === t); 
        }

        if (filterColors.length > 0) {
            result = result.filter(c => {
                if (!c.colors || c.colors.length === 0) return filterColors.includes('C');
                return c.colors.every(col => filterColors.includes(col));
            });
        }

        // 2. Tri Bidirectionnel
        result.sort((a, b) => {
            const priceA = a.price ?? 0;
            const priceB = b.price ?? 0;
            const dateA = a.lastPriceUpdate ? new Date(a.lastPriceUpdate).getTime() : 0;
            const dateB = b.lastPriceUpdate ? new Date(b.lastPriceUpdate).getTime() : 0;
            const cmcA = a.cmc ?? 0;
            const cmcB = b.cmc ?? 0;

            switch (sortBy) {
                // NOM
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'name': return a.name.localeCompare(b.name);

                // PRIX
                case 'price_asc': return priceA - priceB;
                case 'price_desc': return priceB - priceA;

                // DATE
                case 'date_asc': return dateA - dateB;
                case 'date_desc': return dateB - dateA;
                case 'date': return dateB - dateA;

                // CMC
                case 'cmc_asc': return cmcA - cmcB;
                case 'cmc_desc': return cmcB - cmcA;

                // SET
                case 'set_asc': return (a.setName || '').localeCompare(b.setName || '');
                case 'set_desc': return (b.setName || '').localeCompare(a.setName || '');

                default: return 0;
            }
        });

        return result;
    }, [allCards, searchQuery, sortBy, filterSet, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);

    const visibleCards = useMemo(() => {
        return filteredAndSortedCards.slice(0, visibleCount);
    }, [filteredAndSortedCards, visibleCount]);

    // Calcul du total basé sur les cartes FILTRÉES (plus logique pour l'utilisateur)
    const currentTotal = useMemo(() => {
        return filteredAndSortedCards.reduce((acc, card) => acc + (card.price || 0) * card.quantity, 0);
    }, [filteredAndSortedCards]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + ITEMS_PER_PAGE);
    };

    if (loading) {
        return <div className="p-10 text-center animate-pulse">Fusion des listes en cours...</div>;
    }

    return (
        <div className="animate-in fade-in duration-300 pb-10">
             
             {/* EN-TÊTE */}
             <div className="flex justify-between items-end mb-6 border-b pb-4 dark:border-gray-700 bg-linear-to-r from-blue-50 to-transparent dark:from-blue-900/20 p-4 rounded-t-xl">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        Vue Globale
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {filteredAndSortedCards.length} cartes affichées (sur {allCards.length})
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-xs text-gray-500 uppercase font-semibold">Valeur Filtrée</span>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{currentTotal.toFixed(2)} €</p>
                </div>
            </div>

            {/* BARRE DE FILTRES */}
            <CardListFilterBar
                context="wishlist-global"
                cards={allCards} // On passe toutes les cartes pour générer les options de Sets
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                filterSet={filterSet}
                setFilterSet={setFilterSet}
                filterTrade={false}
                setFilterTrade={() => {}}
                filterFoil={filterFoil}
                setFilterFoil={setFilterFoil}
                minPriceFilter={minPriceFilter}
                setMinPriceFilter={setMinPriceFilter}
                maxPriceFilter={maxPriceFilter}
                setMaxPriceFilter={setMaxPriceFilter}
                filterCMC={filterCMC}
                setFilterCMC={setFilterCMC}
                filterColors={filterColors}
                setFilterColors={setFilterColors}
                columns={columns}
                setColumns={setColumns}
                // Pas de total ici car affiché dans le header au-dessus
            />

            {/* LISTE VIDE */}
            {filteredAndSortedCards.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 italic">Aucune carte ne correspond à vos filtres.</p>
                    <button 
                        onClick={() => { setSearchQuery(''); setFilterSet('all'); setFilterFoil(false); setMinPriceFilter(''); setMaxPriceFilter(''); setFilterCMC(''); setFilterColors([]); }} 
                        className="text-primary hover:underline mt-2"
                    >
                        Réinitialiser les filtres
                    </button>
                </div>
            ) : (
                <>
                    {/* GRILLE */}
                    <div 
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                    >
                        {visibleCards.map((card, idx) => (
                            <div key={`${card.id}-${idx}`} className="relative group">
                                {/* Badge indiquant la liste d'origine */}
                                <div className="absolute top-0 right-0 z-30 bg-black/70 text-white text-[10px] px-2 py-1 rounded-bl-lg backdrop-blur-sm pointer-events-none">
                                    {card.sourceListName}
                                </div>
                                
                                <MagicCard 
                                    {...card} 
                                    isWishlist={false} 
                                    readOnly={true} 
                                />
                            </div>
                        ))}
                    </div>

                    {/* BOUTON CHARGER PLUS */}
                    {visibleCount < filteredAndSortedCards.length && (
                        <div className="flex justify-center mt-8">
                            <button 
                                onClick={handleLoadMore}
                                className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-primary transition transform hover:scale-105"
                            >
                                Afficher plus ({filteredAndSortedCards.length - visibleCount} restantes)
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}