'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { doc, setDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ScryfallRawData, normalizeCardData } from '@/lib/cardUtils';
import { CardType } from '@/hooks/useCardCollection';
import { useWishlists } from '@/hooks/useWishlists';
import CardVersionPickerModal from '@/components/CardVersionPickerModal';
import MagicCard from '@/components/MagicCard'; 
import toast from 'react-hot-toast';
import CardListFilterBar, { CardContext } from '@/components/common/CardListFilterBar';
import SearchToolbar from '@/components/search/SearchToolbar';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import { checkWishlistMatch } from '@/app/actions/matching';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function SearchPage() {
  const { user } = useAuth();
  const { lists } = useWishlists();
  const searchParams = useSearchParams();
  
  // Initialisation de la requête depuis l'URL
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<ScryfallRawData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBaseCard, setSelectedBaseCard] = useState<ScryfallRawData | null>(null);
  const [targetDestination, setTargetDestination] = useState<'collection' | 'wishlist'>('collection');

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);

  const { columns, setColumns } = useColumnPreference('mw_cols_search', 4);
  const { sortBy, setSortBy } = useSortPreference('mw_sort_search', 'name_asc' as SortOption);
  const [filterSet, setFilterSet] = useState<string>('all');
  const [filterFoil, setFilterFoil] = useState(false);
  const [minPriceFilter, setMinPriceFilter] = useState<string>('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
  const [filterCMC, setFilterCMC] = useState<string>('');
  const [filterColors, setFilterColors] = useState<string[]>([]);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSearch = async (forcedQuery?: string) => {
    const searchTerm = forcedQuery !== undefined ? forcedQuery : query;
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setActiveOverlayId(null);

    // Mettre à jour l'URL sans recharger la page pour garder la recherche en mémoire
    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(searchTerm)}`;
    window.history.replaceState(null, '', newUrl);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      if (data.data) {
        setResults(data.data);
      } else {
        setResults([]);
        toast.error("Aucune carte trouvée.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur de recherche.");
    } finally {
      setIsSearching(false);
    }
  };

  // Relancer la recherche automatiquement si on arrive sur la page avec un paramètre 'q'
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !hasSearched) {
      handleSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredCards = useMemo(() => {
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


  const handleCardClick = (id: string) => {
    if (!isMobile || isSelectMode) return;
    setActiveOverlayId(activeOverlayId === id ? null : id);
  };

  return (
    <main className="container mx-auto p-4 min-h-[85vh] relative pb-24">
      <div className="text-center mb-8 pt-4">
        <h1 className="text-3xl font-bold text-primary mb-2">Centre de Recherche</h1>
        <p className="text-muted">Trouvez n&apos;importe quelle carte et gérez votre collection.</p>
      </div>

      <CardListFilterBar
        context={'search' as CardContext}
        cards={filteredCards}
        searchQuery={query}
        setSearchQuery={setQuery}
        onSearch={() => handleSearch()}
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
        hideSliderOnMobile={true} 
      />

      {results.length > 0 && (
        <SearchToolbar 
            isSelectMode={isSelectMode} 
            setIsSelectMode={setIsSelectMode} 
            totalResults={filteredCards.length} 
        />
      )}

      {isSearching ? (
        <div className="text-center py-20"><div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-muted">Recherche en cours...</p></div>
      ) : filteredCards.length > 0 ? (
        <div 
            className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
            style={{ '--cols': columns } as React.CSSProperties}
        >
            {filteredCards.map((card) => (
                <div key={card.id} className="relative flex flex-col group h-full">
                    <div 
                        className="relative aspect-[2.5/3.5] rounded-[4.5%/3.2%] overflow-hidden shadow-md border border-border bg-secondary"
                        onClick={() => handleCardClick(card.id)}
                    >
                        <MagicCard 
                            {...card} 
                            readOnly={true} 
                            isSelectMode={isSelectMode}
                            isSelected={selectedIds.includes(card.id)}
                            onSelect={() => toggleSelection(card.id)}
                            hideFooter={true}
                        />

                        {!isSelectMode && (
                            <div 
                                className={`absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-3 transition-opacity duration-200 z-30 ${
                                    isMobile 
                                        ? (activeOverlayId === card.id ? 'opacity-100' : 'opacity-0 pointer-events-none') 
                                        : 'opacity-0 group-hover:opacity-100'
                                }`}
                            >
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openPicker(card.scryfallData as ScryfallRawData, 'collection'); }}
                                    className="w-full max-w-[120px] bg-primary text-primary-foreground font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider"
                                >
                                    Collection
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openPicker(card.scryfallData as ScryfallRawData, 'wishlist'); }}
                                    className="w-full max-w-[120px] bg-white text-black font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider"
                                >
                                    Wishlist
                                </button>
                                <Link 
                                    href={`/card/${card.id}?returnTo=${encodeURIComponent(`/search?q=${query}`)}`}
                                    className="w-full max-w-[120px] bg-secondary text-foreground text-center font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Détails
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="mt-2 px-1 text-center">
                        <h3 className="font-bold text-foreground text-[11px] md:text-xs truncate">{card.name}</h3>
                        <p className="text-[9px] md:text-[10px] text-muted truncate">{card.setName}</p>
                    </div>
                </div>
            ))}
        </div>
      ) : hasSearched ? (
        <div className="text-center py-20 text-muted">Aucun résultat trouvé.</div>
      ) : null}

      <CardVersionPickerModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        baseCard={selectedBaseCard} 
        onConfirm={handleConfirmAdd} 
        destination={targetDestination} 
        availableLists={lists} 
      />
    </main>
  );
}