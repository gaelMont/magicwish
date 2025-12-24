// app/wishlist/page.tsx
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useWishlists } from '@/hooks/useWishlists';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useSearchParams, useRouter } from 'next/navigation';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import { moveCardFromWishlistToCollection } from '@/lib/services/collectionService';

// Composants
import MagicCard from '@/components/MagicCard';
import GlobalWishlistView from '@/components/wishlist/GlobalWishlistView';
import DataTransferHubModal from '@/components/DataTransferHubModal'; 
import ImportModal from '@/components/ImportModal';
import ExportModal from '@/components/ExportModal';
import CollectionToolbar from '@/components/collection/CollectionToolbar';
import CardListFilterBar from '@/components/common/CardListFilterBar';
import ConfirmModal from '@/components/ConfirmModal';
import { LockedListModal } from '@/components/LockedListModal';
import { Lock } from 'lucide-react'; // AJOUT DE L'IMPORT
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 50;

function WishlistContent() {
  const { user, userProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const selectedListId = searchParams.get('listId') || 'default';
  const { lists, renameList, deleteList, loading: metaLoading } = useWishlists();

  const { 
      cards, loading, updateQuantity, removeCard, toggleAttribute, 
      bulkRemoveCards, totalPrice 
  } = useCardCollection('wishlist', selectedListId);

  const isLocked = useMemo(() => {
    if (selectedListId === 'default' || selectedListId === 'GLOBAL_VIEW') return false;
    if (userProfile?.isPremium) return false;

    const sortedLists = [...lists].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    const index = sortedLists.findIndex(l => l.id === selectedListId);
    
    return index >= 1;
  }, [selectedListId, lists, userProfile]);

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

  const currentListName = useMemo(() => {
    return lists.find(l => l.id === selectedListId)?.name || 'Liste principale';
  }, [lists, selectedListId]);

  useEffect(() => {
      setRenameValue(currentListName);
  }, [currentListName]);

  const closeAllModals = () => { setIsHubOpen(false); setIsImportOpen(false); setIsExportOpen(false); };
  const openHub = () => { setIsImportOpen(false); setIsExportOpen(false); setIsHubOpen(true); };
  const handleSelectImport = () => { setIsHubOpen(false); setIsImportOpen(true); };
  const handleSelectExport = () => { setIsHubOpen(false); setIsExportOpen(true); };

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
          router.push('/wishlist');
      }
  };

  const moveToCollection = async (card: CardType) => {
    if (!user || isLocked) return;
    const toastId = toast.loading("Déplacement...");
    const result = await moveCardFromWishlistToCollection(user.uid, card, selectedListId);
    if (result.success) {
        toast.success("Ajoutée à la collection !", { id: toastId });
    } else {
        toast.error(result.error || "Erreur technique", { id: toastId });
    }
  };

  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];
    const minPrice = parseFloat(minPriceFilter);
    const maxPrice = parseFloat(maxPriceFilter);

    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(lowerQ));
    }
    if (filterSet !== 'all') result = result.filter(c => c.setName === filterSet);
    if (filterFoil) result = result.filter(c => c.isFoil);
    
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
        const dateA = a.lastPriceUpdate ? new Date(a.lastPriceUpdate).getTime() : 0;
        const dateB = b.lastPriceUpdate ? new Date(b.lastPriceUpdate).getTime() : 0;
        
        switch (sortBy) {
            case 'name_asc': return a.name.localeCompare(b.name);
            case 'name_desc': return b.name.localeCompare(a.name);
            case 'price_asc': return priceA - priceB;
            case 'price_desc': return priceB - priceA;
            case 'date_asc': return dateA - dateB;
            case 'date_desc': return dateB - dateA;
            case 'quantity_asc': return a.quantity - b.quantity;
            case 'quantity_desc': return b.quantity - a.quantity;
            case 'cmc_asc': return (a.cmc ?? 0) - (b.cmc ?? 0);
            case 'cmc_desc': return (b.cmc ?? 0) - (a.cmc ?? 0);
            default: return 0;
        }
    });

    return result;
  }, [cards, searchQuery, sortBy, filterSet, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);

  const visibleCards = filteredAndSortedCards.slice(0, visibleCount);

  const toggleSelection = (id: string) => {
      if (isLocked) return;
      setSelectedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
      if (isLocked) return;
      if (selectedIds.length === filteredAndSortedCards.length) setSelectedIds([]); 
      else setSelectedIds(filteredAndSortedCards.map(c => c.id)); 
  };

  const handleBulkDelete = async () => {
      if (isLocked) return;
      if (!confirm(`Supprimer ces ${selectedIds.length} cartes ?`)) return;
      await bulkRemoveCards(selectedIds);
      setSelectedIds([]);
      setIsSelectMode(false);
  };

  if (!user) return <p className="p-10 text-center text-muted font-bold uppercase text-xs">Veuillez vous connecter.</p>;
  
  if (selectedListId === 'GLOBAL_VIEW') {
      return (
        <main className="container mx-auto p-4 min-h-[85vh]">
            <div className="flex justify-end mb-4">
                 <button onClick={openHub} className="btn-primary text-xs tracking-widest uppercase">Importer/Exporter</button>
            </div>
            <GlobalWishlistView lists={lists} />
            <DataTransferHubModal isOpen={isHubOpen} onClose={closeAllModals} onSelectImport={handleSelectImport} onSelectExport={handleSelectExport} targetLabel="Wishlist" />
        </main>
      );
  }

  if (loading && metaLoading) return <div className="flex h-screen items-center justify-center text-muted animate-pulse font-bold uppercase text-xs">Chargement...</div>;

  return (
    <main className="container mx-auto p-4 pb-24 relative">
      <LockedListModal isOpen={isLocked} listName={currentListName} />

      <div className="flex justify-between items-center mb-6">
          <div className="overflow-hidden grow pr-4">
              {isRenaming && !isLocked ? (
                  <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                      <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="text-2xl font-black text-foreground bg-background border border-border rounded-xl px-2 py-1 outline-none focus:ring-2 focus:ring-primary w-full max-w-md" autoFocus />
                      <button type="submit" className="bg-success-vif text-white px-3 py-1 rounded-lg font-bold text-sm uppercase">OK</button>
                  </form>
              ) : (
                  <div>
                      <h1 className="text-2xl md:text-3xl font-black text-foreground truncate uppercase tracking-tighter flex items-center gap-2">
                          {currentListName} 
                          <span className="text-base font-bold text-muted">({filteredAndSortedCards.length})</span>
                          {/* UTILISATION DE L'ICÔNE LOCK */}
                          {isLocked && <Lock className="w-5 h-5 text-muted-foreground" />}
                      </h1>
                      {selectedListId !== 'default' && !isLocked && (
                          <button onClick={() => setListToDelete(selectedListId)} className="text-[10px] font-black text-danger hover:underline mt-1 block uppercase tracking-widest">Supprimer la liste</button>
                      )}
                  </div>
              )}
          </div>
          <div className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-xl shadow-sm text-right">
              <span className="text-[8px] uppercase tracking-widest font-black opacity-80 block mb-0.5">Valeur Totale</span>
              <span className="font-black text-sm whitespace-nowrap">{totalPrice.toFixed(2)} EUR</span>
          </div>
      </div>

      {!isLocked && (
          <CollectionToolbar
              isSelectMode={isSelectMode}
              setIsSelectMode={setIsSelectMode}
              onOpenHub={openHub}
              onOpenTools={() => {}} 
          />
      )}

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
        hideSliderOnMobile={true}
      />

      {isSelectMode && !isLocked && (
          <div className="mb-4 flex items-center justify-between bg-primary/10 p-3 rounded-xl border border-primary/30 animate-in fade-in">
              <span className="font-bold text-primary pl-2 uppercase text-xs tracking-widest">{selectedIds.length} carte(s) sélectionnée(s)</span>
              <button onClick={handleSelectAll} className="text-xs text-primary font-black px-3 py-1 rounded-lg hover:bg-primary/10 transition uppercase">Tout sélectionner</button>
          </div>
      )}

      {filteredAndSortedCards.length === 0 ? (
        <div className="text-center py-20 bg-secondary/50 rounded-3xl border-2 border-dashed border-border shadow-inner">
          <p className="text-sm font-bold text-muted mb-4 uppercase italic">La liste est vide.</p>
        </div>
      ) : (
        <>
            <div 
                className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" 
                style={{ '--cols': columns } as React.CSSProperties}
            >
                {visibleCards.map((card) => (
                    <MagicCard 
                        key={card.id}
                        {...card}
                        isWishlist={true}
                        hideFooter={isLocked}
                        isSelectMode={isSelectMode && !isLocked}
                        isSelected={selectedIds.includes(card.id)}
                        onSelect={() => toggleSelection(card.id)}
                        onIncrement={!isLocked ? () => updateQuantity(card.id, 1, card.quantity) : undefined}
                        onDecrement={!isLocked ? () => card.quantity <= 1 ? setCardToDelete(card.id) : updateQuantity(card.id, -1, card.quantity) : undefined}
                        onMove={!isLocked ? () => moveToCollection(card) : undefined}
                        onToggleAttribute={!isLocked ? (field, val) => toggleAttribute(card.id, field, val) : undefined}
                    />
                ))}
            </div>
            {filteredAndSortedCards.length > visibleCount && (
                <div className="mt-8 flex justify-center pb-10">
                    <button onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)} className="bg-surface hover:bg-secondary text-foreground border border-border px-8 py-3 rounded-2xl font-black shadow-sm transition flex items-center gap-2 uppercase text-xs tracking-widest">Afficher plus</button>
                </div>
            )}
        </>
      )}

      {isSelectMode && selectedIds.length > 0 && !isLocked && (
          <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-surface shadow-2xl border border-border p-2 rounded-2xl flex items-center justify-around gap-2 z-50 animate-in slide-in-from-bottom-6 duration-300">
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-danger hover:bg-red-600 text-white rounded-xl text-xs font-black transition flex flex-col items-center leading-none gap-1 shadow-md w-full uppercase"><span>Supprimer {selectedIds.length} cartes</span></button>
          </div>
      )}

      <DataTransferHubModal isOpen={isHubOpen} onClose={closeAllModals} onSelectImport={handleSelectImport} onSelectExport={handleSelectExport} targetLabel="Wishlist" />
      <ImportModal isOpen={isImportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} targetCollection="wishlist" listId={selectedListId} />
      <ExportModal isOpen={isExportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} cards={cards} listName={currentListName} targetType="wishlist" />
      <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={() => { if(cardToDelete) removeCard(cardToDelete); }} title="Retirer ?" message="Cette carte sera retirée de votre wishlist." />
      <ConfirmModal isOpen={!!listToDelete} onClose={() => setListToDelete(null)} onConfirm={handleDeleteCurrentList} title="Supprimer la liste ?" message="Toutes les cartes seront supprimées définitivement." />
    </main>
  );
}

export default function WishlistPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted animate-pulse font-bold uppercase text-xs">Chargement...</div>}>
            <WishlistContent />
        </Suspense>
    );
}