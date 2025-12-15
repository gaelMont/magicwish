'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection } from '@/hooks/useCardCollection'; 
import MagicCard from '@/components/MagicCard';
import ConfirmModal from '@/components/ConfirmModal';
import CollectionToolsModal from '@/components/CollectionToolsModal';
import DataTransferHubModal from '@/components/DataTransferHubModal'; 
import ImportModal from '@/components/ImportModal';
import ExportModal from '@/components/ExportModal';
import { updateUserStats } from '@/app/actions/stats';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference'; 
import CardListFilterBar from '@/components/common/CardListFilterBar';
import CollectionToolbar from '@/components/collection/CollectionToolbar';
import { useCollections } from '@/hooks/useCollections';
import { useSearchParams } from 'next/navigation';

const ITEMS_PER_PAGE = 50; 

export default function CollectionPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  // Récupération de l'ID depuis l'URL
  const selectedListId = searchParams.get('listId') || 'default';
  
  // On charge les métadonnées juste pour avoir le nom de la liste courante
  const { lists: collectionsMeta, deleteList, renameList, loading: metaLoading } = useCollections();

  const { 
    cards, loading, updateQuantity, removeCard, 
    setCustomPrice, setTradeQuantity, toggleAttribute,
    refreshCollectionPrices, bulkSetTradeStatus,
    bulkRemoveCards, bulkUpdateAttribute, 
    totalPrice 
  } = useCardCollection('collection', selectedListId);

  // --- ÉTATS GLOBAUX ---
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);

  // --- ÉTATS RENOMMAGE ---
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // --- ÉTATS D'AFFICHAGE ---
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
  const { columns, setColumns } = useColumnPreference('mw_cols_collection', 5); 

  // --- ÉTATS DE FILTRE ET TRI ---
  const [searchQuery, setSearchQuery] = useState('');
  const { sortBy, setSortBy } = useSortPreference('mw_sort_collection', 'date_desc' as SortOption); 
  const [filterSet, setFilterSet] = useState<string>('all');
  const [filterTrade, setFilterTrade] = useState(false);
  const [filterFoil, setFilterFoil] = useState(false);
  const [minPriceFilter, setMinPriceFilter] = useState<string>('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
  
  // Nouveaux filtres (CMC / Couleurs)
  const [filterCMC, setFilterCMC] = useState<string>('');
  const [filterColors, setFilterColors] = useState<string[]>([]);

  const currentListName = useMemo(() => {
    return collectionsMeta.find(l => l.id === selectedListId)?.name || 'Collection Principale';
  }, [collectionsMeta, selectedListId]);

  useEffect(() => {
      setRenameValue(currentListName);
  }, [currentListName]);

  // --- GESTION DES MODALES ---
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

  const triggerStatsUpdate = () => {
      if (user?.uid) updateUserStats(user.uid).catch(e => console.error("Stats update error", e));
  };

  // --- ACTIONS DE COLLECTION ---
  const handleDeleteCurrentCollection = async () => {
      if (collectionToDelete) {
          await deleteList(collectionToDelete);
          setCollectionToDelete(null);
          window.location.href = '/collection';
      }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (renameValue.trim() && selectedListId !== 'default') {
          await renameList(selectedListId, renameValue.trim());
          setIsRenaming(false);
      }
  };

  useEffect(() => {
    if (visibleCount !== ITEMS_PER_PAGE) {
      setVisibleCount(ITEMS_PER_PAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortBy, filterSet, filterTrade, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors, selectedListId]);

  // --- LOGIQUE DE FILTRAGE ---
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
    if (filterTrade) {
        result = result.filter(c => (c.quantityForTrade ?? 0) > 0);
    }
    if (filterFoil) {
        result = result.filter(c => c.isFoil);
    }
    
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
        result = result.filter(c => {
            const cardPrice = c.customPrice ?? c.price ?? 0;
            const isAboveMin = isNaN(minPrice) || cardPrice >= minPrice;
            const isBelowMax = isNaN(maxPrice) || cardPrice <= maxPrice;
            return isAboveMin && isBelowMax;
        });
    }

    // Filtre CMC
    if (filterCMC) {
        const targetCMC = parseFloat(filterCMC);
        if (!isNaN(targetCMC)) {
            result = result.filter(c => c.cmc === targetCMC);
        }
    }

    // Filtre Couleurs (Restrictif : la carte doit contenir TOUTES les couleurs sélectionnées)
    if (filterColors.length > 0) {
        result = result.filter(c => {
            // Si la carte n'a pas de couleurs (incolore), on l'affiche si 'C' est sélectionné
            if (!c.colors || c.colors.length === 0) {
                return filterColors.includes('C');
            }
            // Sinon, toutes les couleurs de la carte doivent être dans la sélection
            return c.colors.every(col => filterColors.includes(col));
        });
    }

    result.sort((a, b) => {
        const priceA = a.customPrice ?? a.price ?? 0;
        const priceB = b.customPrice ?? b.price ?? 0;
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
  }, [cards, searchQuery, sortBy, filterSet, filterTrade, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);

  const visibleCards = useMemo(() => {
      return filteredAndSortedCards.slice(0, visibleCount);
  }, [filteredAndSortedCards, visibleCount]);

  // --- HANDLERS ACTIONS CARTES ---
  const handleDecrement = async (cardId: string, currentQty: number) => {
    const result = await updateQuantity(cardId, -1, currentQty);
    if (result === 'shouldDelete') {
      setCardToDelete(cardId);
    } else {
        triggerStatsUpdate();
    }
  };

  const handleIncrementTrade = (cardId: string, currentTradeQty: number, totalQty: number) => {
      if (currentTradeQty < totalQty) {
          setTradeQuantity(cardId, currentTradeQty + 1);
      }
  };
  
  const handleDecrementTrade = (cardId: string, currentTradeQty: number) => {
      if (currentTradeQty > 0) {
          setTradeQuantity(cardId, currentTradeQty - 1);
      }
  };

  const toggleSelection = (id: string) => {
      setSelectedIds(prev => 
          prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
      );
  };

  const handleSelectAll = () => {
      if (selectedIds.length === filteredAndSortedCards.length) {
          setSelectedIds([]); 
      } else {
          setSelectedIds(filteredAndSortedCards.map(c => c.id)); 
      }
  };

  const handleBulkDelete = async () => {
      if (!confirm(`Supprimer ces ${selectedIds.length} cartes définitivement ?`)) return;
      await bulkRemoveCards(selectedIds);
      triggerStatsUpdate();
      setSelectedIds([]);
      setIsSelectMode(false);
  };

  const handleBulkTrade = async (isTrade: boolean) => {
      const targetQuantity = isTrade ? 99 : 0; 
      await bulkUpdateAttribute(selectedIds, 'quantityForTrade', targetQuantity); 
      setSelectedIds([]);
      setIsSelectMode(false);
  };

  const confirmDeleteSingle = async () => {
      if(cardToDelete) {
          await removeCard(cardToDelete);
          triggerStatsUpdate();
          setCardToDelete(null);
      }
  };

  if (loading && metaLoading) return <div className="flex h-screen items-center justify-center text-muted animate-pulse">Chargement...</div>;
  if (!user) return <p className="text-center p-10 text-muted">Veuillez vous connecter.</p>;

  return (
    <main className="container mx-auto p-4 pb-24 relative">
      
      {/* HEADER DE PAGE */}
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
                                  title="Renommer la collection"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                  </svg>
                              </button>
                          )}
                      </div>
                      
                      {selectedListId !== 'default' && (
                          <button 
                              onClick={() => setCollectionToDelete(selectedListId)}
                              className="text-xs text-danger hover:underline mt-1 block"
                          >
                              Supprimer cette collection
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
      
      {/* 1. BARRE D'OUTILS */}
      <CollectionToolbar 
          isSelectMode={isSelectMode}
          setIsSelectMode={setIsSelectMode}
          onOpenTools={() => setIsToolsOpen(true)}
          onOpenHub={openHub}
      />

      {/* 2. BARRE DE FILTRES */}
      <CardListFilterBar
        context="collection"
        cards={cards}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        filterSet={filterSet}
        setFilterSet={setFilterSet}
        filterTrade={filterTrade}
        setFilterTrade={setFilterTrade}
        filterFoil={filterFoil}
        setFilterFoil={setFilterFoil}
        minPriceFilter={minPriceFilter}
        setMinPriceFilter={setMinPriceFilter}
        maxPriceFilter={maxPriceFilter}
        setMaxPriceFilter={setMaxPriceFilter}
        
        // Nouveaux filtres
        filterCMC={filterCMC}
        setFilterCMC={setFilterCMC}
        filterColors={filterColors}
        setFilterColors={setFilterColors}
        
        columns={columns} 
        setColumns={setColumns}
      />

      {/* 3. BARRE D'ACTIONS DE SÉLECTION */}
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

      {/* 4. GRILLE DE CARTES */}
      {filteredAndSortedCards.length === 0 ? (
        <div className="text-center py-20 bg-secondary/50 rounded-xl border-2 border-dashed border-border">
          <p className="text-xl text-muted mb-4">Aucun résultat ne correspond à vos filtres.</p>
          <button 
              onClick={() => { setSearchQuery(''); setFilterSet('all'); setFilterTrade(false); setFilterFoil(false); setMinPriceFilter(''); setMaxPriceFilter(''); setFilterCMC(''); setFilterColors([]); }} 
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
                        onIncrement={() => {
                            updateQuantity(card.id, 1, card.quantity);
                            triggerStatsUpdate();
                        }}
                        onDecrement={() => handleDecrement(card.id, card.quantity)}
                        onEditPrice={(newPrice) => {
                            setCustomPrice(card.id, newPrice);
                            triggerStatsUpdate();
                        }}
                        onIncrementTrade={() => handleIncrementTrade(card.id, card.quantityForTrade ?? 0, card.quantity)}
                        onDecrementTrade={() => handleDecrementTrade(card.id, card.quantityForTrade ?? 0)}
                        onToggleAttribute={(field, val) => {
                            if (field !== 'isSpecificVersion') {
                                toggleAttribute(card.id, field, val); 
                            }
                        }}
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

      {/* 5. ACTION BAR FLOTTANTE */}
      {isSelectMode && selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-surface shadow-2xl border border-border p-2 rounded-2xl flex items-center justify-around gap-2 z-50 animate-in slide-in-from-bottom-6 duration-300">
              <button onClick={() => handleBulkTrade(true)} className="px-4 py-2 bg-success/10 hover:bg-success/20 text-success rounded-xl text-sm font-bold transition flex flex-col items-center leading-none gap-1">
                  <span>Trade</span>
              </button>
              <button onClick={() => handleBulkTrade(false)} className="px-4 py-2 bg-secondary hover:bg-border text-foreground rounded-xl text-sm font-bold transition flex flex-col items-center leading-none gap-1">
                  <span>Privé</span>
              </button>
              <div className="w-px h-8 bg-border mx-1"></div>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-danger hover:bg-red-600 text-white rounded-xl text-sm font-bold transition flex flex-col items-center leading-none gap-1 shadow-md">
                  <span>Suppr</span>
              </button>
          </div>
      )}

      {/* MODALES */}
      <DataTransferHubModal 
        isOpen={isHubOpen}
        onClose={closeAllModals}
        onSelectImport={handleSelectImport}
        onSelectExport={handleSelectExport}
        targetLabel="Collection"
      />

      <ImportModal 
          isOpen={isImportOpen} 
          onClose={closeAllModals} 
          onGoBack={openHub}       
          onCloseAll={closeAllModals}
          targetCollection="collection" 
          listId={selectedListId}
      />
      
      <ExportModal
        isOpen={isExportOpen}
        onClose={closeAllModals}
        onGoBack={openHub}
        onCloseAll={closeAllModals}
        cards={cards}
        listName={currentListName}
        targetType="collection"
      />

      <CollectionToolsModal isOpen={isToolsOpen} onClose={() => setIsToolsOpen(false)} totalCards={cards.length} onRefreshPrices={refreshCollectionPrices} onBulkTrade={bulkSetTradeStatus} />
      <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={confirmDeleteSingle} title="Retirer ?" message="Cette carte sera retirée de votre collection." />
      <ConfirmModal isOpen={!!collectionToDelete} onClose={() => setCollectionToDelete(null)} onConfirm={handleDeleteCurrentCollection} title="Supprimer la collection ?" message="Toutes les cartes de cette collection seront supprimées définitivement." />
    </main>
  );
}