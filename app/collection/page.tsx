'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection } from '@/hooks/useCardCollection'; 
import MagicCard from '@/components/MagicCard';
import ImportModal from '@/components/ImportModal';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteAllButton from '@/components/DeleteAllButton';
import CollectionToolsModal from '@/components/CollectionToolsModal';

type SortOption = 'name' | 'price_desc' | 'price_asc' | 'quantity' | 'date';

const ITEMS_PER_PAGE = 50; 

export default function CollectionPage() {
  const { user } = useAuth();
  
  const { 
    cards, loading, updateQuantity, removeCard, 
    setCustomPrice, toggleAttribute, refreshCollectionPrices, bulkSetTradeStatus,
    bulkRemoveCards, bulkUpdateAttribute, 
    totalPrice 
  } = useCardCollection('collection');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [showFilters, setShowFilters] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterSet, setFilterSet] = useState<string>('all');
  const [filterTrade, setFilterTrade] = useState(false);
  const [filterFoil, setFilterFoil] = useState(false);

  useEffect(() => {
    if (visibleCount !== ITEMS_PER_PAGE) {
      setVisibleCount(ITEMS_PER_PAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortBy, filterSet, filterTrade, filterFoil]);

  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];

    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(lowerQ));
    }
    if (filterSet !== 'all') {
        result = result.filter(c => c.setName === filterSet);
    }
    if (filterTrade) {
        result = result.filter(c => c.isForTrade);
    }
    if (filterFoil) {
        result = result.filter(c => c.isFoil);
    }

    result.sort((a, b) => {
        const priceA = a.customPrice ?? a.price ?? 0;
        const priceB = b.customPrice ?? b.price ?? 0;
        switch (sortBy) {
            case 'name': return a.name.localeCompare(b.name);
            case 'price_desc': return priceB - priceA;
            case 'price_asc': return priceA - priceB;
            case 'quantity': return b.quantity - a.quantity;
            case 'date': default: return 0; 
        }
    });

    return result;
  }, [cards, searchQuery, sortBy, filterSet, filterTrade, filterFoil]);

  const visibleCards = useMemo(() => {
      return filteredAndSortedCards.slice(0, visibleCount);
  }, [filteredAndSortedCards, visibleCount]);

  const availableSets = useMemo(() => {
      const sets = new Set(cards.map(c => c.setName).filter((s): s is string => !!s));
      return Array.from(sets).sort();
  }, [cards]);

  const handleDecrement = async (cardId: string, currentQty: number) => {
    const result = await updateQuantity(cardId, -1, currentQty);
    if (result === 'shouldDelete') {
      setCardToDelete(cardId);
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
      setSelectedIds([]);
      setIsSelectMode(false);
  };

  const handleBulkTrade = async (isTrade: boolean) => {
      await bulkUpdateAttribute(selectedIds, 'isForTrade', isTrade);
      setSelectedIds([]);
      setIsSelectMode(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-muted animate-pulse">Chargement de votre collection...</div>;
  if (!user) return <p className="text-center p-10 text-muted">Veuillez vous connecter.</p>;

  return (
    <main className="container mx-auto p-4 pb-24 relative">
      
      <div className="flex flex-col gap-4 mb-6">
        
        {/* TITRE + TOTAL */}
        <div className="flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-primary truncate">
                Ma Collection 
                <span className="ml-2 text-base font-normal text-muted">
                    ({filteredAndSortedCards.length})
                </span>
            </h1>
            <div className="shrink-0 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-sm text-right">
                <span className="text-[10px] uppercase tracking-wide opacity-80 block">Total</span>
                <span className="font-bold whitespace-nowrap">{totalPrice.toFixed(2)} €</span>
            </div>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
           <button 
             onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }}
             className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm border flex items-center gap-2 whitespace-nowrap ${isSelectMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface hover:bg-secondary text-foreground border-border'}`}
           >
             {isSelectMode ? 'Annuler' : 'Sélectionner'}
           </button>

           {!isSelectMode && (
               <>
                <button 
                    onClick={() => setIsToolsOpen(true)}
                    className="shrink-0 bg-surface hover:bg-secondary text-foreground px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm border border-border flex items-center gap-2 whitespace-nowrap"
                >
                    Gérer
                </button>

                <div className="shrink-0">
                    <DeleteAllButton targetCollection="collection" />
                </div>
                
                <button 
                    onClick={() => setIsImportOpen(true)} 
                    className="btn-primary text-sm whitespace-nowrap"
                >
                    Importer CSV
                </button>
               </>
           )}
        </div>
      </div>

      {/* FILTRES (Remplacé bg-white par bg-surface) */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-sm mb-6">
          <div className="flex gap-2 items-center">
              <div className="grow">
                  <input 
                      type="text" 
                      placeholder="Rechercher une carte..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden shrink-0 px-3 py-2 bg-secondary rounded-lg text-foreground border border-border text-sm font-medium"
              >
                {showFilters ? 'Masquer' : 'Filtres'}
              </button>
          </div>

          <div className={`mt-4 space-y-4 md:space-y-0 md:flex md:items-end md:gap-4 ${showFilters ? 'block' : 'hidden md:flex'}`}>
            <div className="min-w-[200px]">
                <label className="block text-xs font-bold text-muted mb-1 uppercase">Edition</label>
                <select value={filterSet} onChange={(e) => setFilterSet(e.target.value)} className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer">
                    <option value="all">Toutes les éditions</option>
                    {availableSets.map(set => <option key={set} value={set}>{set}</option>)}
                </select>
            </div>
            <div className="min-w-[180px]">
                <label className="block text-xs font-bold text-muted mb-1 uppercase">Trier par</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-sm cursor-pointer">
                    <option value="date">Date d&apos;ajout</option>
                    <option value="price_desc">Prix : Haut - Bas</option>
                    <option value="price_asc">Prix : Bas - Haut</option>
                    <option value="name">Nom : A - Z</option>
                    <option value="quantity">Quantité</option>
                </select>
            </div>
            <div className="flex items-center gap-4 pb-3 pt-2 md:pt-0">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={filterFoil} onChange={(e) => setFilterFoil(e.target.checked)} className="w-4 h-4 text-primary rounded border-border" />
                    <span className="text-sm font-medium text-foreground">Foil</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={filterTrade} onChange={(e) => setFilterTrade(e.target.checked)} className="w-4 h-4 text-success rounded border-border" />
                    <span className="text-sm font-medium text-foreground">Échange</span>
                </label>
            </div>
          </div>
      </div>

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

      {/* GRILLE */}
      {filteredAndSortedCards.length === 0 ? (
        <div className="text-center py-20 bg-secondary/50 rounded-xl border-2 border-dashed border-border">
          <p className="text-xl text-muted mb-4">Aucun résultat ne correspond à vos filtres.</p>
          <button onClick={() => { setSearchQuery(''); setFilterSet('all'); setFilterTrade(false); setFilterFoil(false); }} className="text-primary hover:underline">Réinitialiser les filtres</button>
        </div>
      ) : (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visibleCards.map((card) => (
                <MagicCard 
                    key={card.id}
                    {...card}
                    onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
                    onDecrement={() => handleDecrement(card.id, card.quantity)}
                    onEditPrice={(newPrice) => setCustomPrice(card.id, newPrice)}
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
                        Afficher plus ({filteredAndSortedCards.length - visibleCount}) ▼
                    </button>
                </div>
            )}
        </>
      )}

      {/* ACTION BAR FLOTTANTE */}
      {isSelectMode && selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-surface shadow-2xl border border-border p-2 rounded-2xl flex items-center justify-around gap-2 z-50 animate-in slide-in-from-bottom-6 duration-300">
              <button onClick={() => handleBulkTrade(true)} className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-xl text-sm font-bold transition flex flex-col items-center leading-none gap-1">
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

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} targetCollection="collection" />
      <CollectionToolsModal isOpen={isToolsOpen} onClose={() => setIsToolsOpen(false)} totalCards={cards.length} onRefreshPrices={refreshCollectionPrices} onBulkTrade={bulkSetTradeStatus} />
      <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={() => { if(cardToDelete) removeCard(cardToDelete); }} title="Retirer ?" message="Cette carte sera retirée de votre collection." />
    </main>
  );
}