// app/wishlist/page.tsx
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useWishlists } from '@/hooks/useWishlists';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useSearchParams } from 'next/navigation';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import { moveCardFromWishlistToCollection } from '@/lib/services/collectionService';

// Composants
import MagicCard from '@/components/MagicCard';
import GlobalWishlistView from '@/components/wishlist/GlobalWishlistView';
import DataTransferHubModal from '@/components/DataTransferHubModal'; 
import ImportModal from '@/components/ImportModal';
import ExportModal from '@/components/ExportModal';
import WishlistToolbar from '@/components/wishlist/WishlistToolbar';
import CardListFilterBar from '@/components/common/CardListFilterBar';
import ConfirmModal from '@/components/ConfirmModal';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 50;

function WishlistContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  const selectedListId = searchParams.get('listId') || 'default';
  const { lists, renameList, deleteList, loading: metaLoading } = useWishlists();

  const { 
      cards, loading, updateQuantity, removeCard, toggleAttribute, 
      bulkRemoveCards, bulkUpdateAttribute, totalPrice 
  } = useCardCollection('wishlist', selectedListId);

  const [isHubOpen, setIsHubOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const { columns, setColumns } = useColumnPreference('mw_cols_wishlist', 5);

  const [searchQuery, setSearchQuery] = useState('');
  const { sortBy, setSortBy } = useSortPreference('mw_sort_wishlist', 'date_desc' as SortOption); 
  const [filterSet, setFilterSet] = useState<string>('all');
  const [filterFoil, setFilterFoil] = useState(false);
  const [minPriceFilter, setMinPriceFilter] = useState<string>('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
  
  // Nouveaux filtres
  const [filterCMC, setFilterCMC] = useState<string>('');
  const [filterColors, setFilterColors] = useState<string[]>([]);

  const currentListName = useMemo(() => {
    return lists.find(l => l.id === selectedListId)?.name || 'Liste principale';
  }, [lists, selectedListId]);

  useEffect(() => {
      setRenameValue(currentListName);
  }, [currentListName]);

  const closeAllModals = () => {
    setIsHubOpen(false);
    setIsImportOpen(false);
    setIsExportOpen(false);
  };
  const openHub = () => {
    setIsImportOpen(false);
    setIsExportOpen(false);
    setIsHubOpen(true);
  };

  const handleSelectImport = () => {
    setIsHubOpen(false);
    setIsImportOpen(true);
  };
  
  const handleSelectExport = () => {
    setIsHubOpen(false);
    setIsExportOpen(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (renameValue.trim() && selectedListId !== 'default' && selectedListId !== 'GLOBAL_VIEW') {
          await renameList(selectedListId, renameValue.trim());
          setIsRenaming(false);
      }
  };

  const handleDeleteCurrentList = async () => {
      if (listToDelete) {
          await deleteList(listToDelete);
          setListToDelete(null);
          window.location.href = '/wishlist';
      }
  };

  const moveToCollection = async (card: CardType) => {
    if (!user) return;
    const toastId = toast.loading("Déplacement...");
    const result = await moveCardFromWishlistToCollection(user.uid, card, selectedListId);
    if (result.success) {
        toast.success("Ajoutée à la collection !", { id: toastId });
    } else {
        toast.error(result.error || "Erreur technique", { id: toastId });
    }
  };

  useEffect(() => {
    if (visibleCount !== ITEMS_PER_PAGE) {
      setVisibleCount(ITEMS_PER_PAGE);
    }
  }, [searchQuery, sortBy, filterSet, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors, selectedListId]);

  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];
    
    const minPrice = parseFloat(minPriceFilter);
    const maxPrice = parseFloat(maxPriceFilter);

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

    result.sort((a, b) => {
        const priceA = a.price ?? 0;
        const priceB = b.price ?? 0;
        const dateA = a.lastPriceUpdate?.getTime() || 0;
        const dateB = b.lastPriceUpdate?.getTime() || 0;
        
        switch (sortBy) {
            case 'name_asc': return a.name.localeCompare(b.name);
            case 'name_desc': return b.name.localeCompare(a.name);
            case 'price_desc': return priceB - priceA;
            case 'price_asc': return priceA - priceB;
            case 'quantity': return b.quantity - a.quantity;
            case 'date_asc': return dateA - dateB;
            case 'date_desc': default: return dateB - dateA;
        }
    });

    return result;
  }, [cards, searchQuery, sortBy, filterSet, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);

  const visibleCards = useMemo(() => {
      return filteredAndSortedCards.slice(0, visibleCount);
  }, [filteredAndSortedCards, visibleCount]);

  const handleDecrement = async (cardId: string, currentQty: number) => {
    if (currentQty === 1) {
        setCardToDelete(cardId);
    } else {
        await updateQuantity(cardId, -1, currentQty);
    }
  };

  const toggleSelection = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
      if (selectedIds.length === filteredAndSortedCards.length) setSelectedIds([]); 
      else setSelectedIds(filteredAndSortedCards.map(c => c.id)); 
  };

  const handleBulkDelete = async () => {
      if (!confirm(`Supprimer ces ${selectedIds.length} cartes de la wishlist ?`)) return;
      await bulkRemoveCards(selectedIds);
      setSelectedIds([]);
      setIsSelectMode(false);
  };

  if (!user) return <p className="p-10 text-center text-muted">Veuillez vous connecter.</p>;
  
  if (selectedListId === 'GLOBAL_VIEW') {
      return (
        <main className="container mx-auto p-4 min-h-[85vh]">
            <div className="flex justify-end mb-4">
                 <button onClick={openHub} className="btn-primary text-sm">Importer/Exporter</button>
            </div>
            <GlobalWishlistView lists={lists} />
            
            <DataTransferHubModal 
                isOpen={isHubOpen} onClose={closeAllModals} onSelectImport={handleSelectImport} onSelectExport={handleSelectExport} targetLabel="Wishlist"
            />
            <ImportModal isOpen={isImportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} targetCollection="wishlist" listId="default" />
            <ExportModal isOpen={isExportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} cards={cards} listName="Globale" targetType="wishlist" />
        </main>
      );
  }

  if (loading && metaLoading) return <div className="flex h-screen items-center justify-center text-muted animate-pulse">Chargement...</div>;

  return (
    <main className="container mx-auto p-4 pb-24 relative">
      
      <div className="flex justify-between items-center mb-6">
          <div className="overflow-hidden grow pr-4">
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
                  <div>
                      <div className="flex items-center gap-3">
                          <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate flex items-center gap-2">
                              {currentListName} 
                              <span className="text-base font-normal text-muted">
                                  ({filteredAndSortedCards.length})
                              </span>
                          </h1>
                          {selectedListId !== 'default' && (
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
                      
                      {selectedListId !== 'default' && (
                          <button 
                              onClick={() => setListToDelete(selectedListId)}
                              className="text-xs text-danger hover:underline mt-1 block"
                          >
                              Supprimer cette liste
                          </button>
                      )}
                  </div>
              )}
          </div>
          
          <div className="shrink-0 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-sm text-right">
              <span className="text-[10px] uppercase tracking-wide opacity-80 block">Valeur Totale</span>
              <span className="font-bold whitespace-nowrap">{totalPrice.toFixed(2)} EUR</span>
          </div>
      </div>

      <WishlistToolbar
          isSelectMode={isSelectMode}
          setIsSelectMode={setIsSelectMode}
          onOpenHub={() => setIsHubOpen(true)}
          targetListId={selectedListId}
      />

      <CardListFilterBar
        context="wishlist"
        cards={cards}
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
      />

      {isSelectMode && (
          <div className="mb-4 flex items-center justify-between bg-primary/10 p-3 rounded-lg border border-primary/30 animate-in fade-in slide-in-from-top-2">
              <span className="font-bold text-primary pl-2">
                  {selectedIds.length} carte(s)
              </span>
              <button onClick={handleSelectAll} className="text-sm text-primary font-bold px-3 py-1 rounded hover:bg-primary/10 transition">
                  {selectedIds.length === filteredAndSortedCards.length ? 'Désélectionner' : 'Tout sélectionner'}
              </button>
          </div>
      )}

      {filteredAndSortedCards.length === 0 ? (
        <div className="text-center py-20 bg-secondary/50 rounded-xl border-2 border-dashed border-border">
          <p className="text-xl text-muted mb-4">La liste est vide ou ne correspond pas aux filtres.</p>
          <button 
              onClick={() => { setSearchQuery(''); setFilterSet('all'); setFilterFoil(false); setMinPriceFilter(''); setMaxPriceFilter(''); setFilterCMC(''); setFilterColors([]); }} 
              className="text-primary hover:underline"
          >
              Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <>
            <div 
                className="grid gap-4"
                style={{ 
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
                }}
            >
                {visibleCards.map((card) => (
                    <MagicCard 
                        key={card.id}
                        {...card}
                        isWishlist={true}
                        onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
                        onDecrement={() => handleDecrement(card.id, card.quantity)}
                        onMove={() => moveToCollection(card)}
                        onToggleAttribute={(field, val) => toggleAttribute(card.id, field, val)}
                        
                        isSelectMode={isSelectMode}
                        isSelected={selectedIds.includes(card.id)}
                        onSelect={() => toggleSelection(card.id)}
                    />
                ))}
            </div>

            {visibleCount < filteredAndSortedCards.length && (
                <div className="mt-8 flex justify-center pb-10">
                    <button 
                        onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                        className="bg-surface hover:bg-secondary text-foreground border border-border px-8 py-3 rounded-full font-bold shadow-sm transition flex items-center gap-2"
                    >
                        Afficher plus ({filteredAndSortedCards.length - visibleCount})
                    </button>
                </div>
            )}
        </>
      )}

      {isSelectMode && selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-surface shadow-2xl border border-border p-2 rounded-2xl flex items-center justify-around gap-2 z-50 animate-in slide-in-from-bottom-6 duration-300">
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-danger hover:bg-red-600 text-white rounded-xl text-sm font-bold transition flex flex-col items-center leading-none gap-1 shadow-md w-full">
                  <span>Supprimer {selectedIds.length} cartes</span>
              </button>
          </div>
      )}

      <DataTransferHubModal 
        isOpen={isHubOpen}
        onClose={closeAllModals}
        onSelectImport={handleSelectImport}
        onSelectExport={handleSelectExport}
        targetLabel="Wishlist"
      />
      
      <ImportModal 
          isOpen={isImportOpen} 
          onClose={closeAllModals} 
          onGoBack={openHub}       
          onCloseAll={closeAllModals}
          targetCollection="wishlist" 
          listId={selectedListId}
      />
      
      <ExportModal
        isOpen={isExportOpen}
        onClose={closeAllModals}
        onGoBack={openHub}
        onCloseAll={closeAllModals}
        cards={cards}
        listName={currentListName}
        targetType="wishlist"
      />

      <ConfirmModal 
        isOpen={!!cardToDelete} 
        onClose={() => setCardToDelete(null)} 
        onConfirm={() => { if(cardToDelete) removeCard(cardToDelete); }} 
        title="Retirer ?" 
        message="Cette carte sera retirée de votre wishlist." 
      />
      
      <ConfirmModal 
        isOpen={!!listToDelete} 
        onClose={() => setListToDelete(null)} 
        onConfirm={handleDeleteCurrentList} 
        title="Supprimer la liste ?" 
        message="Toutes les cartes de cette wishlist seront supprimées définitivement." 
      />

    </main>
  );
}

export default function WishlistPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted animate-pulse">Chargement de la wishlist...</div>}>
            <WishlistContent />
        </Suspense>
    );
}