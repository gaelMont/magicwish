// components/common/CardListFilterBar.tsx
'use client';

import { useMemo, useState } from 'react';
import { CardType } from '@/hooks/useCardCollection';
import { SortOption } from '@/hooks/useSortPreference';
import ColumnSlider from '@/components/ColumnSlider'; 

const MANA_COLORS = [
    { code: 'W', label: 'Blanc', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
    { code: 'U', label: 'Bleu', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
    { code: 'B', label: 'Noir', bg: 'bg-gray-300', border: 'border-gray-500', text: 'text-gray-800' },
    { code: 'R', label: 'Rouge', bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
    { code: 'G', label: 'Vert', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
    { code: 'C', label: 'Incolore', bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-500' },
];

interface CardMinimalInfo {
    setName?: string;
}

export type CardContext = 'collection' | 'wishlist' | 'friend-collection' | 'friend-wishlist' | 'wishlist-global' | 'search';

interface CardListFilterBarProps {
    cards: CardType[] | CardMinimalInfo[]; 
    context: CardContext;
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
    filterCMC?: string;
    setFilterCMC?: (val: string) => void;
    filterColors?: string[];
    setFilterColors?: (val: string[]) => void;
    filterMatch?: boolean;
    setFilterMatch?: (val: boolean) => void;
    filterFullCollection?: boolean;
    setFilterFullCollection?: (val: boolean) => void;
    columns: number; 
    setColumns: (val: number) => void;
    onSearch?: () => void;
    hideSliderOnMobile?: boolean;
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
    filterFullCollection,
    setFilterFullCollection,
    columns,
    setColumns,
    onSearch,
    hideSliderOnMobile = false
}: CardListFilterBarProps) {
    
    const [showAdvanced, setShowAdvanced] = useState(false);

    const isOwnerCollection = context === 'collection';
    const isFriendView = context.startsWith('friend');
    const isSearchPage = context === 'search';
    const isTradeFilterApplicable = context === 'collection' || context === 'friend-collection'; 
    const isMatchFilterApplicable = isFriendView && setFilterMatch !== undefined; 
    
    const availableSets: string[] = useMemo(() => {
        if (!cards) return [];
        const sets = new Set(
            cards
                .map((c: CardMinimalInfo) => c.setName)
                .filter((s): s is string => !!s)
        );
        return Array.from(sets).sort();
    }, [cards]);
    
    const sortOptions: { value: SortOption; label: string; }[] = useMemo(() => {
        const options: { value: SortOption; label: string; }[] = [
            { value: 'date_desc', label: "Récent → Ancien" },
            { value: 'date_asc', label: "Ancien → Récent" },
            { value: 'price_desc', label: "Prix (Décroissant)" },
            { value: 'price_asc', label: "Prix (Croissant)" },
            { value: 'name_asc', label: "Nom (A → Z)" },
            { value: 'name_desc', label: "Nom (Z → A)" },
            { value: 'cmc_desc', label: "Mana (Élevé → Faible)" },
            { value: 'cmc_asc', label: "Mana (Faible → Élevé)" },
        ];

        if (isOwnerCollection) {
            options.push(
                { value: 'quantity_desc', label: "Quantité (Plus → Moins)" },
                { value: 'quantity_asc', label: "Quantité (Moins → Plus)" }
            );
        }
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

    const hasActiveFilters = useMemo(() => {
        return filterSet !== 'all' || 
               minPriceFilter !== '' || 
               maxPriceFilter !== '' || 
               (filterCMC && filterCMC !== '') || 
               (filterColors && filterColors.length > 0) ||
               filterFoil ||
               filterTrade ||
               filterMatch ||
               filterFullCollection;
    }, [filterSet, minPriceFilter, maxPriceFilter, filterCMC, filterColors, filterFoil, filterTrade, filterMatch, filterFullCollection]);

    return (
        <div className="bg-surface p-3 md:p-4 rounded-xl border border-border shadow-sm flex flex-col gap-3 mb-6 w-full overflow-hidden">
            
            <div className="flex gap-2 items-center w-full">
                <div className="relative flex-1 min-w-0">
                    <input 
                        type="text" 
                        placeholder={isSearchPage ? "Rechercher sur Scryfall..." : "Filtrer..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSearch && onSearch()}
                        className="w-full p-2.5 pr-10 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                    {onSearch && (
                        <button onClick={onSearch} className="absolute right-1 top-1 bottom-1 px-3 text-muted hover:text-primary transition">
                            
                        </button>
                    )}
                </div>

                <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`md:hidden relative p-2.5 rounded-xl border transition-all shrink-0 ${
                        showAdvanced ? 'bg-primary text-white border-primary' : 'bg-surface text-foreground border-border'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 12h9.75M10.5 18h9.75M3 6h.008v.008H3V6Zm0 6h.008v.008H3V12Zm0 6h.008v.008H3V18Z" />
                    </svg>
                    {hasActiveFilters && !showAdvanced && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary border-2 border-surface rounded-full"></span>
                    )}
                </button>
            </div>

            <div className={`${showAdvanced ? 'flex' : 'hidden md:flex'} flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200`}>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                        <label className="block text-[10px] font-bold text-muted mb-1 uppercase tracking-wider">Trier</label>
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as SortOption)} 
                            className="w-full p-2 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer outline-none focus:ring-2 focus:ring-primary"
                        >
                            {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    
                    <div className="min-w-0">
                        <label className="block text-[10px] font-bold text-muted mb-1 uppercase tracking-wider">Édition</label>
                        <select 
                            value={filterSet} 
                            onChange={(e) => setFilterSet(e.target.value)} 
                            className="w-full p-2 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="all">Toutes</option>
                            {availableSets.map(set => <option key={set} value={set}>{set}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex gap-2">
                            <div className="shrink-0">
                                <label className="block text-[10px] font-bold text-muted mb-1 uppercase">Min €</label>
                                <input type="number" className="w-16 p-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="0" value={minPriceFilter} onChange={e => setMinPriceFilter(e.target.value)} />
                            </div>
                            <div className="shrink-0">
                                <label className="block text-[10px] font-bold text-muted mb-1 uppercase">Max €</label>
                                <input type="number" className="w-16 p-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Max" value={maxPriceFilter} onChange={e => setMaxPriceFilter(e.target.value)} />
                            </div>
                        </div>

                        {setFilterCMC && (
                            <div className="shrink-0">
                                <label className="block text-[10px] font-bold text-muted mb-1 uppercase">CMC</label>
                                <input type="number" className="w-14 p-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="=" value={filterCMC || ''} onChange={e => setFilterCMC(e.target.value)} />
                            </div>
                        )}
                    </div>

                    {setFilterColors && (
                        <div className="w-full">
                            <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-wider">Couleurs</label>
                            {/* Correction ici : flex-wrap pour mobile, centré, avec gap propre */}
                            <div className="flex flex-wrap items-center gap-2">
                                {MANA_COLORS.map(color => {
                                    const isSelected = filterColors?.includes(color.code);
                                    return (
                                        <button
                                            key={color.code}
                                            onClick={() => toggleColor(color.code)}
                                            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all shrink-0 shadow-sm ${color.bg} ${color.border} ${
                                                isSelected 
                                                    ? 'ring-2 ring-primary ring-offset-2 scale-110 opacity-100 z-10' 
                                                    : 'opacity-50 hover:opacity-100'
                                            }`}
                                            title={color.label}
                                        >
                                            <span className={`text-xs font-black ${color.text}`}>{color.code}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-y-3 gap-x-4 items-center justify-between pt-3 border-t border-border mt-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {setFilterFullCollection && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={filterFullCollection || false} onChange={(e) => setFilterFullCollection(e.target.checked)} className="w-4 h-4 text-primary rounded border-border focus:ring-primary accent-primary" />
                                <span className="text-[11px] font-bold text-primary">Ma collection</span>
                            </label>
                        )}
                        {isMatchFilterApplicable && setFilterMatch && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={filterMatch || false} onChange={(e) => setFilterMatch(e.target.checked)} className="w-4 h-4 text-success rounded border-border" />
                                <span className="text-[11px] font-medium text-foreground">Matchs</span>
                            </label>
                        )}
                        {isTradeFilterApplicable && setFilterTrade && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={filterTrade || false} onChange={(e) => setFilterTrade(e.target.checked)} className="w-4 h-4 text-primary rounded border-border" />
                                <span className="text-[11px] font-medium text-foreground">Échange</span>
                            </label>
                        )}
                        {!isSearchPage && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={filterFoil || false} onChange={(e) => setFilterFoil(e.target.checked)} className="w-4 h-4 text-primary rounded border-border" />
                                <span className="text-[11px] font-medium text-foreground">Foil</span>
                            </label>
                        )}
                    </div>

                    <div className={hideSliderOnMobile ? "hidden md:block" : "block"}>
                        <ColumnSlider columns={columns} setColumns={setColumns} min={2} max={7} />
                    </div>
                </div>
            </div>
        </div>
    );
}