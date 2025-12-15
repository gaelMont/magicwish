// app/wishlist/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useWishlists } from '@/hooks/useWishlists';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useSearchParams } from 'next/navigation';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import { moveCardFromWishlistToCollection } from '@/lib/services/collectionService';
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

export default function WishlistPage() {
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
  const [filterCMC, setFilterCMC] = useState<string>('');
  const [filterColors, setFilterColors] = useState<string[]>([]);

  const currentListName = useMemo(() => lists.find(l => l.id === selectedListId)?.name || 'Liste principale', [lists, selectedListId]);
  useEffect(() => { setRenameValue(currentListName); }, [currentListName]);

  const closeAllModals = () => { setIsHubOpen(false); setIsImportOpen(false); setIsExportOpen(false); };
  const openHub = () => { setIsImportOpen(false); setIsExportOpen(false); setIsHubOpen(true); };
  const handleRenameSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (renameValue.trim() && selectedListId !== 'default' && selectedListId !== 'GLOBAL_VIEW') { await renameList(selectedListId, renameValue.trim()); setIsRenaming(false); } };
  const handleDeleteCurrentList = async () => { if (listToDelete) { await deleteList(listToDelete); setListToDelete(null); window.location.href = '/wishlist'; } };
  const moveToCollection = async (card: CardType) => { if (!user) return; const t = toast.loading("Déplacement..."); const r = await moveCardFromWishlistToCollection(user.uid, card, selectedListId); if(r.success) toast.success("Fait!",{id:t}); else toast.error(r.error||"Erreur",{id:t}); };

  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];
    const minPrice = parseFloat(minPriceFilter);
    const maxPrice = parseFloat(maxPriceFilter);

    if (searchQuery) result = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filterSet !== 'all') result = result.filter(c => c.setName === filterSet);
    if (filterFoil) result = result.filter(c => c.isFoil);
    
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
        result = result.filter(c => {
            const p = c.price ?? 0;
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
        const priceA = a.price ?? 0; const priceB = b.price ?? 0;
        const dateA = a.lastPriceUpdate?.getTime() || 0; const dateB = b.lastPriceUpdate?.getTime() || 0;
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

  const visibleCards = useMemo(() => filteredAndSortedCards.slice(0, visibleCount), [filteredAndSortedCards, visibleCount]);
  
  const handleDecrement = async (cardId: string, currentQty: number) => {
    if (currentQty === 1) setCardToDelete(cardId);
    else await updateQuantity(cardId, -1, currentQty);
  };

  const handleBulkDelete = async () => {
      if (!confirm(`Supprimer ces ${selectedIds.length} cartes ?`)) return;
      await bulkRemoveCards(selectedIds);
      setSelectedIds([]); setIsSelectMode(false);
  };

  if (!user) return <p className="p-10 text-center text-muted">Veuillez vous connecter.</p>;
  
  if (selectedListId === 'GLOBAL_VIEW') {
      return (
        <main className="container mx-auto p-4 min-h-[85vh]">
            <div className="flex justify-end mb-4"><button onClick={() => setIsHubOpen(true)} className="btn-primary text-sm">Importer/Exporter</button></div>
            <GlobalWishlistView lists={lists} />
            <DataTransferHubModal isOpen={isHubOpen} onClose={closeAllModals} onSelectImport={() => setIsImportOpen(true)} onSelectExport={() => setIsExportOpen(true)} targetLabel="Wishlist" />
            <ImportModal isOpen={isImportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} targetCollection="wishlist" listId="default" />
            <ExportModal isOpen={isExportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} cards={cards} listName="Globale" targetType="wishlist" />
        </main>
      );
  }

  if (loading && metaLoading) return <div className="flex h-screen items-center justify-center animate-pulse text-muted">Chargement...</div>;

  return (
    <main className="container mx-auto p-4 pb-24 relative">
      <div className="flex justify-between items-center mb-6">
          <div className="overflow-hidden grow pr-4">
              {isRenaming ? (
                  <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                      <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="text-2xl font-bold bg-background border border-border rounded px-2 py-1 w-full max-w-md" autoFocus />
                      <button type="submit" className="bg-success-vif text-white px-3 py-1 rounded font-bold text-sm">OK</button>
                      <button type="button" onClick={() => setIsRenaming(false)} className="bg-secondary text-foreground px-3 py-1 rounded font-bold text-sm">Annuler</button>
                  </form>
              ) : (
                  <div className="flex items-center gap-3">
                      <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">{currentListName} <span className="text-base font-normal text-muted">({filteredAndSortedCards.length})</span></h1>
                      {selectedListId !== 'default' && <button onClick={() => setIsRenaming(true)} className="text-muted hover:text-primary transition p-1">✎</button>}
                  </div>
              )}
              {selectedListId !== 'default' && <button onClick={() => setListToDelete(selectedListId)} className="text-xs text-danger hover:underline mt-1 block">Supprimer cette liste</button>}
          </div>
          <div className="shrink-0 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-sm text-right">
              <span className="text-[10px] uppercase opacity-80 block">Total</span>
              <span className="font-bold whitespace-nowrap">{totalPrice.toFixed(2)} EUR</span>
          </div>
      </div>

      <WishlistToolbar isSelectMode={isSelectMode} setIsSelectMode={setIsSelectMode} onOpenHub={() => setIsHubOpen(true)} targetListId={selectedListId} />

      <CardListFilterBar
        context="wishlist"
        cards={cards}
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

      {isSelectMode && <div className="mb-4 bg-primary/10 p-3 rounded-lg border border-primary/30 flex justify-between"><span className="font-bold text-primary">{selectedIds.length} cartes</span><button onClick={() => setSelectedIds(selectedIds.length === filteredAndSortedCards.length ? [] : filteredAndSortedCards.map(c => c.id))} className="text-sm text-primary font-bold">Tout sélectionner</button></div>}

      {filteredAndSortedCards.length === 0 ? <div className="text-center py-20 bg-secondary/50 rounded-xl border-dashed border-2 border-border"><p className="text-xl text-muted">Aucun résultat.</p></div> : (
        <>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {visibleCards.map((card) => (
                    <MagicCard 
                        key={card.id} {...card} isWishlist={true}
                        onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
                        onDecrement={() => handleDecrement(card.id, card.quantity)}
                        onMove={() => moveToCollection(card)}
                        onToggleAttribute={(f, v) => toggleAttribute(card.id, f, v)}
                        isSelectMode={isSelectMode} isSelected={selectedIds.includes(card.id)} onSelect={() => setSelectedIds(p => p.includes(card.id) ? p.filter(x => x !== card.id) : [...p, card.id])}
                    />
                ))}
            </div>
            {visibleCount < filteredAndSortedCards.length && <div className="mt-8 flex justify-center pb-10"><button onClick={() => setVisibleCount(p => p + ITEMS_PER_PAGE)} className="bg-surface border border-border px-8 py-3 rounded-full font-bold shadow-sm">Afficher plus</button></div>}
        </>
      )}

      {isSelectMode && selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-surface shadow-2xl border border-border p-2 rounded-2xl flex items-center justify-around gap-2 z-50 animate-in slide-in-from-bottom-6">
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-danger text-white rounded-xl text-sm font-bold w-full shadow-md">Supprimer {selectedIds.length} cartes</button>
          </div>
      )}

      <DataTransferHubModal isOpen={isHubOpen} onClose={closeAllModals} onSelectImport={() => setIsImportOpen(true)} onSelectExport={() => setIsExportOpen(true)} targetLabel="Wishlist" />
      <ImportModal isOpen={isImportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} targetCollection="wishlist" listId={selectedListId} />
      <ExportModal isOpen={isExportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} cards={cards} listName={currentListName} targetType="wishlist" />
      <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={() => cardToDelete && removeCard(cardToDelete)} title="Retirer ?" message="Cette carte sera retirée de votre wishlist." />
      <ConfirmModal isOpen={!!listToDelete} onClose={() => setListToDelete(null)} onConfirm={handleDeleteCurrentList} title="Supprimer la liste ?" message="Toutes les cartes seront supprimées." />
    </main>
  );
}