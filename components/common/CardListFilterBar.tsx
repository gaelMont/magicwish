// components/common/CardListFilterBar.tsx
'use client';

import { useMemo } from 'react';
import { CardType } from '@/hooks/useCardCollection';
import { SortOption } from '@/hooks/useSortPreference';
import ColumnSlider from '@/components/ColumnSlider'; 

// Couleurs Magic : W U B R G C
const MANA_COLORS = [
    { code: 'W', label: 'Blanc', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
    { code: 'U', label: 'Bleu', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
    { code: 'B', label: 'Noir', bg: 'bg-gray-300', border: 'border-gray-500', text: 'text-gray-800' },
    { code: 'R', label: 'Rouge', bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
    { code: 'G', label: 'Vert', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
    { code: 'C', label: 'Incolore', bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-500' },
];

interface CardListFilterBarProps {
    cards: CardType[];
    context: 'collection' | 'wishlist' | 'friend-collection' | 'friend-wishlist' | 'wishlist-global' | 'search';
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    sortBy: SortOption;
    setSortBy: (val: SortOption) => void;
    filterSet: string;
    setFilterSet: (val: string) => void;
    filterTrade: boolean;
    setFilterTrade: (val: boolean) => void;
    filterFoil: boolean;
    setFilterFoil: (val: boolean) => void;
    minPriceFilter: string;
    setMinPriceFilter: (val: string) => void;
    maxPriceFilter: string;
    setMaxPriceFilter: (val: string) => void;
    
    // Nouveaux Props
    filterCMC?: string;
    setFilterCMC?: (val: string) => void;
    filterColors?: string[];
    setFilterColors?: (val: string[]) => void;

    filterMatch?: boolean;
    setFilterMatch?: (val: boolean) => void;
    columns: number; 
    setColumns: (val: number) => void;

    // Action de recherche explicite (pour la page Search)
    onSearch?: () => void;
}

export default function CardListFilterBar({
    cards,
    context,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    filterSet,
    setFilterSet,
    filterTrade,
    setFilterTrade,
    filterFoil,
    setFilterFoil,
    minPriceFilter,
    setMinPriceFilter,
    maxPriceFilter,
    setMaxPriceFilter,
    filterCMC,
    setFilterCMC,
    filterColors,
    setFilterColors,
    filterMatch,
    setFilterMatch,
    columns,
    setColumns,
    onSearch
}: CardListFilterBarProps) {
    
    const isOwnerCollection = context === 'collection';
    const isCollection = context === 'collection' || context === 'friend-collection';
    const isFriendView = context.startsWith('friend');
    const isSearchPage = context === 'search';
    
    const isTradeFilterApplicable = isCollection; 
    const isMatchFilterApplicable = isFriendView && setFilterMatch !== undefined; 
    
    const availableSets: string[] = useMemo(() => {
        if (!cards) return [];
        const sets = new Set(cards.map((c: CardType) => c.setName).filter((s): s is string => !!s));
        return Array.from(sets).sort();
    }, [cards]);
    
    const sortOptions: { value: SortOption; label: string; }[] = useMemo(() => {
        const options: { value: SortOption; label: string; }[] = [
            { value: 'date_desc' as SortOption, label: "Date (Plus Récent)" },
            { value: 'price_desc' as SortOption, label: "Prix (Haut-Bas)" },
            { value: 'price_asc' as SortOption, label: "Prix (Bas-Haut)" },
            { value: 'name_asc' as SortOption, label: "Nom (A-Z)" },
        ];
        if (isOwnerCollection) options.push({ value: 'quantity' as SortOption, label: "Qté" });
        return options;
    }, [isOwnerCollection]);

    const toggleColor = (code: string) => {
        if (!filterColors || !setFilterColors) return;
        if (filterColors.includes(code)) {
            setFilterColors(filterColors.filter(c => c !== code));
        } else {
            setFilterColors([...filterColors, code]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onSearch) {
            onSearch();
        }
    };

    return (
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm flex flex-col gap-4 mb-6">
            
            {/* LIGNE 1 : TEXTE / TRI / SETS */}
            <div className="flex flex-wrap gap-4 items-end">
                <div className="grow min-w-[200px] relative">
                    <input 
                        type="text" 
                        placeholder={isSearchPage ? "Rechercher sur Scryfall (ex: Sol Ring)..." : "Filtrer dans la liste..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full p-2.5 pr-10 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                    {onSearch && (
                        <button 
                            onClick={onSearch}
                            className="absolute right-1 top-1 bottom-1 px-3 text-muted hover:text-primary transition"
                            title="Lancer la recherche"
                        >
                            🔍
                        </button>
                    )}
                </div>
                
                <div className="w-full sm:w-auto">
                    <label className="block text-xs font-bold text-muted mb-1 uppercase">Trier</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer min-w-[140px]">
                        {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                
                <div className="w-full sm:w-auto">
                    <label className="block text-xs font-bold text-muted mb-1 uppercase">Édition</label>
                    <select value={filterSet} onChange={(e) => setFilterSet(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer min-w-[140px]">
                        <option value="all">Toutes</option>
                        {availableSets.map(set => <option key={set} value={set}>{set}</option>)}
                    </select>
                </div>
            </div>

            {/* LIGNE 2 : PRIX / CMC / COULEURS */}
            <div className="flex flex-wrap gap-4 items-end">
                
                <div className="flex gap-2 items-end">
                    <div>
                        <label className="block text-xs font-bold text-muted mb-1 uppercase">Min €</label>
                        <input type="number" min="0" className="w-20 p-2.5 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="0" value={minPriceFilter} onChange={e => setMinPriceFilter(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted mb-1 uppercase">Max €</label>
                        <input type="number" min="0" className="w-20 p-2.5 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Max" value={maxPriceFilter} onChange={e => setMaxPriceFilter(e.target.value)} />
                    </div>
                </div>

                {setFilterCMC && (
                    <div>
                        <label className="block text-xs font-bold text-muted mb-1 uppercase">CMC</label>
                        <input 
                            type="number" min="0" 
                            className="w-16 p-2.5 rounded-lg border border-border bg-background text-foreground text-sm" 
                            placeholder="=" 
                            value={filterCMC || ''} 
                            onChange={e => setFilterCMC(e.target.value)} 
                        />
                    </div>
                )}

                {setFilterColors && (
                    <div className="flex gap-1 items-end pb-1">
                        {MANA_COLORS.map(color => {
                            const isSelected = filterColors?.includes(color.code);
                            return (
                                <button
                                    key={color.code}
                                    onClick={() => toggleColor(color.code)}
                                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${color.bg} ${color.border} ${isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110 opacity-100' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                                    title={color.label}
                                >
                                    <span className={`text-xs font-bold ${color.text}`}>{color.code}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* LIGNE 3 : TOGGLES / SLIDER COLONNES */}
            <div className="flex flex-wrap gap-4 items-center justify-between pt-2 border-t border-border mt-2">
                <div className="flex items-center gap-4">
                    {isMatchFilterApplicable && setFilterMatch && (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={filterMatch || false} onChange={(e) => setFilterMatch(e.target.checked)} className="w-4 h-4 text-success rounded border-border" />
                            <span className="text-sm font-medium text-foreground">Matchs</span>
                        </label>
                    )}
                    {isTradeFilterApplicable && setFilterTrade && (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={filterTrade || false} onChange={(e) => setFilterTrade(e.target.checked)} className="w-4 h-4 text-primary rounded border-border" />
                            <span className="text-sm font-medium text-foreground">Échange</span>
                        </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filterFoil || false} onChange={(e) => setFilterFoil(e.target.checked)} className="w-4 h-4 text-primary rounded border-border" />
                        <span className="text-sm font-medium text-foreground">Foil</span>
                    </label>
                </div>

                <div className="ml-auto">
                    <ColumnSlider columns={columns} setColumns={setColumns} min={2} max={7} />
                </div>
            </div>
        </div>
    );
}