// components/wishlist/SingleWishlistView.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import toast from 'react-hot-toast';
import { moveCardFromWishlistToCollection } from '@/lib/services/collectionService'; 
import { useColumnPreference } from '@/hooks/useColumnPreference'; 
import { SortOption } from '@/hooks/useSortPreference'; 
import CardListFilterBar from '@/components/common/CardListFilterBar'; 

type Props = {
    listId: string;
    listName: string;
    onRename?: (newName: string) => Promise<void>;
};

export default function SingleWishlistView({ listId, listName, onRename }: Props) {
    const { cards, loading, updateQuantity, removeCard, toggleAttribute, totalPrice } = useCardCollection('wishlist', listId);
    const { user } = useAuth();
    
    // --- ÉTATS RENOMMAGE ---
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(listName);

    // Initialiser la valeur quand listName change (changement de liste)
    useEffect(() => {
        setRenameValue(listName);
    }, [listName]);

    // --- ÉTATS DE PRÉFÉRENCE & FILTRE ---
    const { columns, setColumns } = useColumnPreference('mw_cols_wishlist_single', 5);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name');
    const [filterSet, setFilterSet] = useState<string>('all'); 
    const [filterFoil, setFilterFoil] = useState(false);
    const [minPriceFilter, setMinPriceFilter] = useState<string>('');
    const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
    // ------------------------------------

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (onRename && renameValue.trim() && listId !== 'default') {
            await onRename(renameValue.trim());
            setIsRenaming(false);
        }
    };

    const filteredAndSortedCards = useMemo(() => {
        
        if (!cards) return [];
        
        let result = [...cards];
        
        const minPrice = parseFloat(minPriceFilter);
        const maxPrice = parseFloat(maxPriceFilter);

        // 1. Filtrage par recherche
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter((c: CardType) => c.name.toLowerCase().includes(lowerQ));
        }
        
        // 2. Filtre par édition
        if (filterSet !== 'all') { 
            result = result.filter((c: CardType) => c.setName === filterSet);
        }

        // 3. Filtrage Foil
        if (filterFoil) {
            result = result.filter((c: CardType) => c.isFoil);
        }
        
        // 4. Filtrage Prix
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            result = result.filter((c: CardType) => {
                const cardPrice = c.price ?? 0;
                const isAboveMin = isNaN(minPrice) || cardPrice >= minPrice;
                const isBelowMax = isNaN(maxPrice) || cardPrice <= maxPrice;
                return isAboveMin && isBelowMax;
            });
        }


        // 5. Tri
        result.sort((a: CardType, b: CardType) => {
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
    }, [cards, searchQuery, sortBy, filterSet, filterFoil, minPriceFilter, maxPriceFilter]);


    const moveToCollection = async (card: CardType) => {
        if (!user) return;
        const toastId = toast.loading("Déplacement...");
        
        const result = await moveCardFromWishlistToCollection(user.uid, card, listId);

        if (result.success) {
            toast.success("Ajoutée à la collection !", { id: toastId });
        } else {
            toast.error(result.error || "Erreur technique", { id: toastId });
        }
    };

    if (loading) return <div className="p-10 text-center text-muted">Chargement des cartes...</div>;

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 border-b border-border pb-4 gap-4">
                
                {/* TITRE ÉDITABLE */}
                <div className="grow">
                    {isRenaming ? (
                        <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                            <input 
                                type="text" 
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="text-2xl font-bold text-foreground bg-background border border-border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary w-full max-w-md"
                                autoFocus
                            />
                            <button type="submit" className="bg-success-vif text-white px-3 py-1 rounded font-bold text-sm">OK</button>
                            <button type="button" onClick={() => setIsRenaming(false)} className="bg-secondary text-foreground px-3 py-1 rounded font-bold text-sm">Annuler</button>
                        </form>
                    ) : (
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-foreground">{listName}</h2>
                            {onRename && listId !== 'default' && (
                                <button 
                                    onClick={() => setIsRenaming(true)}
                                    className="text-muted hover:text-primary transition p-1"
                                    title="Renommer la liste"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="text-right shrink-0">
                    <span className="text-xs text-muted uppercase font-semibold">Total estimé</span>
                    <p className="text-2xl font-bold text-success">{totalPrice.toFixed(2)} €</p>
                </div>
            </div>
            
            {/* UTILISATION DU COMPOSANT PARTAGÉ */}
            <CardListFilterBar
                context="wishlist"
                cards={cards}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                filterSet={filterSet}
                setFilterSet={setFilterSet}
                filterTrade={false} // Non applicable à la wishlist
                setFilterTrade={() => {}}
                filterFoil={filterFoil}
                setFilterFoil={setFilterFoil}
                minPriceFilter={minPriceFilter}
                setMinPriceFilter={setMinPriceFilter}
                maxPriceFilter={maxPriceFilter}
                setMaxPriceFilter={setMaxPriceFilter}
                columns={columns}
                setColumns={setColumns}
            />

            {filteredAndSortedCards.length === 0 ? (
                <div className="text-center py-12 bg-secondary/30 rounded-xl border border-dashed border-border">
                    <p className="text-muted italic">Cette liste est vide ou ne correspond pas aux filtres.</p>
                </div>
            ) : (
                <div 
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                    {filteredAndSortedCards.map((card: CardType) => (
                        <MagicCard 
                            key={card.id} 
                            {...card} 
                            isWishlist={true}
                            onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
                            onDecrement={() => {
                                if(card.quantity === 1) { if(confirm("Supprimer ?")) removeCard(card.id); } 
                                else { updateQuantity(card.id, -1, card.quantity); }
                            }}
                            onMove={() => moveToCollection(card)}
                            onToggleAttribute={(field, val) => toggleAttribute(card.id, field, val)}
                            returnTo="/wishlist" 
                        />
                    ))}
                </div>
            )}
        </div>
    );
}