'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ScryfallRawData, normalizeCardData } from '@/lib/cardUtils'; // Ajout normalizeCardData
import { CardType } from '@/hooks/useCardCollection';
import { useWishlists } from '@/hooks/useWishlists';
import CardVersionPickerModal from '@/components/CardVersionPickerModal';
import MagicCard from '@/components/MagicCard'; 
import toast from 'react-hot-toast';
import CardListFilterBar from '@/components/common/CardListFilterBar';
import SearchToolbar from '@/components/search/SearchToolbar';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import { checkWishlistMatch } from '@/app/actions/matching';

export default function SearchPage() {
  const { user } = useAuth();
  const { lists } = useWishlists();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallRawData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBaseCard, setSelectedBaseCard] = useState<ScryfallRawData | null>(null);
  const [targetDestination, setTargetDestination] = useState<'collection' | 'wishlist'>('collection');

  // Sélection
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtres
  const { columns, setColumns } = useColumnPreference('mw_cols_search', 4);
  const { sortBy, setSortBy } = useSortPreference('mw_sort_search', 'name_asc' as SortOption);
  const [filterSet, setFilterSet] = useState<string>('all');
  const [filterFoil, setFilterFoil] = useState(false);
  const [minPriceFilter, setMinPriceFilter] = useState<string>('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
  const [filterCMC, setFilterCMC] = useState<string>('');
  const [filterColors, setFilterColors] = useState<string[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setResults([]);
    setSelectedIds([]);
    setIsSelectMode(false);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.data) {
        setResults(data.data);
      } else {
        toast.error("Aucune carte trouvée.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur de recherche.");
    } finally {
      setIsSearching(false);
    }
  };

  const filteredCards = useMemo(() => {
    // 1. Transformation en CardType light VIA normalizeCardData
    // Corrige le problème des cartes double face qui s'affichaient mal
    let processed: CardType[] = results.map(raw => {
        const normalized = normalizeCardData(raw);
        return {
            ...normalized,
            quantity: 0,
            isFoil: false,
            isSpecificVersion: false,
            quantityForTrade: 0,
            scryfallData: raw
        };
    });

    // 2. Filtrage Local
    if (filterSet !== 'all') processed = processed.filter(c => c.setName === filterSet);
    
    if (minPriceFilter || maxPriceFilter) {
        const min = parseFloat(minPriceFilter);
        const max = parseFloat(maxPriceFilter);
        processed = processed.filter(c => {
            const p = c.price || 0;
            return (isNaN(min) || p >= min) && (isNaN(max) || p <= max);
        });
    }

    if (filterCMC) { 
        const targetCMC = parseFloat(filterCMC);
        if (!isNaN(targetCMC)) processed = processed.filter(c => c.cmc === targetCMC); 
    }

    if (filterColors.length > 0) {
        processed = processed.filter(c => {
            if (!c.colors || c.colors.length === 0) return filterColors.includes('C');
            return c.colors.every(color => filterColors.includes(color));
        });
    }

    // 3. Tri
    processed.sort((a, b) => {
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        const cmcA = a.cmc || 0;
        const cmcB = b.cmc || 0;

        switch (sortBy) {
            case 'name_asc': return a.name.localeCompare(b.name);
            case 'name_desc': return b.name.localeCompare(a.name);
            
            case 'price_asc': return priceA - priceB;
            case 'price_desc': return priceB - priceA;
            
            case 'cmc_asc': return cmcA - cmcB;
            case 'cmc_desc': return cmcB - cmcA;

            case 'set_asc': return (a.setName || '').localeCompare(b.setName || '');
            case 'set_desc': return (b.setName || '').localeCompare(a.setName || '');

            default: return 0;
        }
    });

    return processed;
  }, [results, filterSet, minPriceFilter, maxPriceFilter, sortBy, filterCMC, filterColors]);

  const openPicker = (card: ScryfallRawData, destination: 'collection' | 'wishlist') => {
    setSelectedBaseCard(card);
    setTargetDestination(destination);
    setModalOpen(true);
  };

  const toggleSelection = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const handleSelectAll = () => setSelectedIds(selectedIds.length === filteredCards.length ? [] : filteredCards.map(c => c.id));

  const handleConfirmAdd = async (card: CardType, targetListId: string = 'default') => {
    if (!user) return;
    const toastId = toast.loading("Ajout...");
    try {
        let path = targetDestination === 'collection' ? 'collection' : 'wishlist';
        if (targetDestination === 'wishlist' && targetListId !== 'default') path = `wishlists_data/${targetListId}/cards`;
        else if (targetDestination === 'collection' && targetListId !== 'default') path = `collections_data/${targetListId}/cards`;

        await setDoc(doc(db, 'users', user.uid, path, card.id), {
            ...card,
            uid: user.uid,
            wishlistId: targetDestination === 'wishlist' ? targetListId : null,
            addedAt: serverTimestamp(),
            imageBackUrl: card.imageBackUrl || null,
            quantity: increment(card.quantity)
        }, { merge: true });

        toast.success("Ajouté !", { id: toastId });

        if (targetDestination === 'wishlist') {
            checkWishlistMatch(user.uid, [{ id: card.id, name: card.name, isFoil: !!card.isFoil }])
            .then(res => { if ((res?.matches ?? 0) > 0) toast(`Match trouvé avec ${res?.matches ?? 0} ami(s)!`, { icon: '🔔' }); });
        }
    } catch (e) {
        console.error(e);
        toast.error("Erreur", { id: toastId });
    }
  };

  const handleBulkAdd = async (dest: 'collection' | 'wishlist') => {
    if (!user || selectedIds.length === 0) return;
    const batch = writeBatch(db);
    const cards = filteredCards.filter(c => selectedIds.includes(c.id));
    const path = dest === 'collection' ? 'collection' : 'wishlist';

    cards.forEach(c => batch.set(doc(db, 'users', user.uid, path, c.id), { 
        ...c, 
        uid: user.uid, 
        quantity: increment(1),
        addedAt: serverTimestamp(),
        wishlistId: dest === 'wishlist' ? 'default' : null
    }, { merge: true }));

    await batch.commit();
    toast.success("Import terminé !");
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  return (
    <main className="container mx-auto p-4 min-h-[85vh] relative pb-24">
      <div className="text-center mb-8 pt-4">
        <h1 className="text-3xl font-bold text-primary mb-2">Recherche</h1>
      </div>

      {results.length > 0 && (
        <SearchToolbar 
            isSelectMode={isSelectMode} 
            setIsSelectMode={setIsSelectMode} 
            totalResults={filteredCards.length} 
        />
      )}

      <CardListFilterBar
        context="search"
        cards={filteredCards}
        searchQuery={query}
        setSearchQuery={setQuery}
        onSearch={handleSearch}
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
      />

      {isSelectMode && (
        <div className="mb-4 flex items-center justify-between bg-primary/10 p-3 rounded-lg border border-primary/30">
            <span className="font-bold text-primary pl-2">{selectedIds.length} carte(s)</span>
            <button 
                onClick={handleSelectAll}
                className="text-sm text-primary font-bold px-3 py-1 rounded hover:bg-primary/10 transition"
            >
                {selectedIds.length === filteredCards.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
        </div>
      )}

      {isSearching ? (
        <div className="text-center py-20"><div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-muted">Recherche...</p></div>
      ) : results.length > 0 ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* GRID FIXE */}
            <div 
                className="grid gap-4 grid-cols-2 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
                style={{ '--cols': columns } as React.CSSProperties}
            >
                {filteredCards.map((card) => (
                    <div key={card.id} className="relative group">
                        <MagicCard 
                            {...card} 
                            readOnly={true} 
                            isSelectMode={isSelectMode}
                            isSelected={selectedIds.includes(card.id)}
                            onSelect={() => toggleSelection(card.id)}
                        />
                        {!isSelectMode && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4 rounded-xl z-20">
                                <button onClick={() => openPicker(card.scryfallData as ScryfallRawData, 'collection')} className="w-full bg-primary text-primary-foreground font-bold py-2 rounded-lg text-xs shadow-lg transform translate-y-4 group-hover:translate-y-0 transition">+ Collection</button>
                                <button onClick={() => openPicker(card.scryfallData as ScryfallRawData, 'wishlist')} className="w-full bg-surface text-foreground font-bold py-2 rounded-lg text-xs shadow-lg transform translate-y-4 group-hover:translate-y-0 transition delay-75">+ Wishlist</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      ) : hasSearched && <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border"><p className="text-xl text-muted">Aucun résultat.</p></div>}

      {isSelectMode && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-surface shadow-2xl border border-border p-2 rounded-2xl flex items-center justify-around gap-2 z-50 animate-in slide-in-from-bottom-6">
            <button onClick={() => handleBulkAdd('collection')} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md">+ Collection</button>
            <div className="w-px h-8 bg-border mx-1"></div>
            <button onClick={() => handleBulkAdd('wishlist')} className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold shadow-md">+ Wishlist</button>
        </div>
      )}

      <CardVersionPickerModal isOpen={modalOpen} onClose={() => setModalOpen(false)} baseCard={selectedBaseCard} onConfirm={handleConfirmAdd} destination={targetDestination} availableLists={lists} />
    </main>
  );
}