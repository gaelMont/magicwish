// app/collection/page.tsx
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import ConfirmModal from '@/components/ConfirmModal';
import CollectionToolsModal from '@/components/CollectionToolsModal';
import DataTransferHubModal from '@/components/DataTransferHubModal';
import ImportModal from '@/components/ImportModal';
import ExportModal from '@/components/ExportModal';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import CardListFilterBar from '@/components/common/CardListFilterBar';
import CollectionToolbar from '@/components/collection/CollectionToolbar';
import { useCollections } from '@/hooks/useCollections';
import { useSearchParams, useRouter } from 'next/navigation';
import { LockedListModal } from '@/components/LockedListModal';
import { Lock } from 'lucide-react'; // AJOUT DE L'IMPORT

const ITEMS_PER_PAGE = 50;

function CollectionContent() {
    const { user, userProfile } = useAuth();
    const searchParams = useSearchParams();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const router = useRouter();
    const selectedListId = searchParams.get('listId') || 'default';

    const { lists: collectionsMeta } = useCollections();
    const { 
        cards, loading, updateQuantity, setCardQuantity,
        removeCard, setCustomPrice, setTradeQuantity, toggleAttribute, 
        refreshCollectionPrices, bulkSetTradeStatus, bulkRemoveCards, totalPrice 
    } = useCardCollection('collection', selectedListId);

    // --- LOGIQUE DE VERROUILLAGE (Soft Lock) ---
    const isLocked = useMemo(() => {
        if (selectedListId === 'default' || selectedListId === 'GLOBAL_VIEW') return false;
        if (userProfile?.isPremium) return false;

        const sortedLists = [...collectionsMeta].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        const index = sortedLists.findIndex(l => l.id === selectedListId);
        
        return index >= 1;
    }, [selectedListId, collectionsMeta, userProfile]);

    const [isHubOpen, setIsHubOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState<string | null>(null);
    
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
    const { columns, setColumns } = useColumnPreference('mw_cols_collection', 5);
    
    // Filtres
    const [searchQuery, setSearchQuery] = useState('');
    const { sortBy, setSortBy } = useSortPreference('mw_sort_collection', 'date_desc' as SortOption);
    const [filterSet, setFilterSet] = useState<string>('all');
    const [filterTrade, setFilterTrade] = useState(false);
    const [filterFoil, setFilterFoil] = useState(false);
    const [minPriceFilter, setMinPriceFilter] = useState<string>('');
    const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
    const [filterCMC, setFilterCMC] = useState<string>('');
    const [filterColors, setFilterColors] = useState<string[]>([]);

    const currentListName = useMemo(() => {
        return collectionsMeta.find(l => l.id === selectedListId)?.name || 'Collection Principale';
    }, [collectionsMeta, selectedListId]);

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

    const handleSelectImport = () => { setIsHubOpen(false); setIsImportOpen(true); };
    const handleSelectExport = () => { setIsHubOpen(false); setIsExportOpen(true); };

    useEffect(() => {
        if (visibleCount !== ITEMS_PER_PAGE) {
            setVisibleCount(ITEMS_PER_PAGE);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, sortBy, filterSet, filterTrade, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors, selectedListId]);

    const filteredAndSortedCards = useMemo(() => {
        let result = [...cards];
        const minPrice = parseFloat(minPriceFilter);
        const maxPrice = parseFloat(maxPriceFilter);

        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(c => c.name.toLowerCase().includes(lowerQ));
        }
        if (filterSet !== 'all') result = result.filter(c => c.setName === filterSet);
        if (filterTrade) result = result.filter(c => (c.quantityForTrade ?? 0) > 0);
        if (filterFoil) result = result.filter(c => c.isFoil);

        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            result = result.filter(c => {
                const cardPrice = c.customPrice ?? c.price ?? 0;
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
            const priceA = a.customPrice ?? a.price ?? 0;
            const priceB = b.customPrice ?? b.price ?? 0;
            const dateA = a.lastPriceUpdate ? new Date(a.lastPriceUpdate).getTime() : 0;
            const dateB = b.lastPriceUpdate ? new Date(b.lastPriceUpdate).getTime() : 0;
            const cmcA = a.cmc ?? 0;
            const cmcB = b.cmc ?? 0;

            switch (sortBy) {
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'name': return a.name.localeCompare(b.name);
                case 'price_asc': return priceA - priceB;
                case 'price_desc': return priceB - priceA;
                case 'quantity_asc': return a.quantity - b.quantity;
                case 'quantity_desc': return b.quantity - a.quantity;
                case 'quantity': return b.quantity - a.quantity;
                case 'date_asc': return dateA - dateB;
                case 'date_desc': return dateB - dateA;
                case 'date': return dateB - dateA;
                case 'cmc_asc': return cmcA - cmcB;
                case 'cmc_desc': return cmcB - cmcA;
                case 'set_asc': return (a.setName || '').localeCompare(b.setName || '');
                case 'set_desc': return (b.setName || '').localeCompare(a.setName || '');
                default: return 0;
            }
        });

        return result;
    }, [cards, searchQuery, sortBy, filterSet, filterTrade, filterFoil, minPriceFilter, maxPriceFilter, filterCMC, filterColors]);

    const visibleCards = useMemo(() => {
        return filteredAndSortedCards.slice(0, visibleCount);
    }, [filteredAndSortedCards, visibleCount]);

    const handleDecrement = async (cardId: string, currentQty: number) => {
        if (isLocked) return;
        if (currentQty === 1) {
            setCardToDelete(cardId);
        } else {
            await updateQuantity(cardId, -1, currentQty);
        }
    };

    const confirmDeleteSingle = async () => {
        if (isLocked) return;
        if (cardToDelete) {
            await removeCard(cardToDelete);
            setCardToDelete(null);
        }
    };

    const toggleSelection = (id: string) => {
        if (isLocked) return;
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(pid => pid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleSelectAll = () => {
        if (isLocked) return;
        if (selectedIds.length === filteredAndSortedCards.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredAndSortedCards.map(c => c.id));
        }
    };

    const handleBulkDelete = async () => {
        if (isLocked) return;
        if (!confirm(`Supprimer ces ${selectedIds.length} cartes définitivement ?`)) return;
        await bulkRemoveCards(selectedIds);
        setSelectedIds([]);
        setIsSelectMode(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleBulkTrade = async (isForTrade: boolean) => {
        if (isLocked) return;
        alert("Fonction à venir pour la sélection multiple spécifique.");
    };

    const handleIncrementTrade = (cardId: string, currentTradeQty: number, totalQty: number) => {
        if (isLocked) return;
        if (currentTradeQty < totalQty) {
            setTradeQuantity(cardId, currentTradeQty + 1);
        }
    };

    const handleDecrementTrade = (cardId: string, currentTradeQty: number) => {
        if (isLocked) return;
        if (currentTradeQty > 0) {
            setTradeQuantity(cardId, currentTradeQty - 1);
        }
    };

    if (!user) return <p className="p-10 text-center text-muted">Veuillez vous connecter.</p>;

    return (
        <main className="container mx-auto p-4 pb-24 relative">
            <LockedListModal isOpen={isLocked} listName={currentListName} />

            <div className="flex justify-between items-end mb-6 bg-surface p-4 rounded-xl border border-border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        {currentListName}
                        {/* UTILISATION DE L'ICÔNE LOCK */}
                        {isLocked && <Lock className="w-5 h-5 text-muted-foreground" />}
                    </h1>
                    <p className="text-sm text-muted mt-1">
                        {filteredAndSortedCards.length} cartes {isLocked && "(Lecture Seule)"} • <span className="text-success font-bold">{totalPrice.toFixed(2)} €</span>
                    </p>
                </div>
            </div>

            {!isLocked && (
                <CollectionToolbar 
                    isSelectMode={isSelectMode} 
                    setIsSelectMode={setIsSelectMode} 
                    onOpenTools={() => setIsToolsOpen(true)}
                    onOpenHub={openHub}
                />
            )}

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
                filterCMC={filterCMC}
                setFilterCMC={setFilterCMC}
                filterColors={filterColors}
                setFilterColors={setFilterColors}
                columns={columns}
                setColumns={setColumns}
            />

            {isSelectMode && !isLocked && (
                <div className="mb-4 flex items-center justify-between bg-primary/10 p-3 rounded-lg border border-primary/30 animate-in fade-in">
                    <span className="font-bold text-primary pl-2">{selectedIds.length} carte(s) sélectionnée(s)</span>
                    <button 
                        onClick={handleSelectAll}
                        className="text-sm text-primary font-bold px-3 py-1 rounded hover:bg-primary/10 transition"
                    >
                        {selectedIds.length === filteredAndSortedCards.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                </div>
            )}

            {loading ? (
                <p className="text-center p-10 text-muted">Chargement de votre collection...</p>
            ) : filteredAndSortedCards.length === 0 ? (
                <div className="text-center py-20 bg-secondary/50 rounded-xl border-2 border-dashed border-border">
                    <p className="text-xl text-muted mb-4">Aucun résultat ne correspond à vos filtres.</p>
                    <button onClick={() => { setSearchQuery(''); setFilterSet('all'); }} className="text-primary hover:underline">Réinitialiser les filtres</button>
                </div>
            ) : (
                <>
                    <div 
                        className="grid gap-4 grid-cols-2 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
                        style={{ '--cols': columns } as React.CSSProperties}
                    >
                        {visibleCards.map((card) => (
                            <div key={card.id} className="relative group">
                                <MagicCard 
                                    {...card} 
                                    hideFooter={isLocked}
                                    isSelectMode={isSelectMode && !isLocked}
                                    isSelected={selectedIds.includes(card.id)}
                                    onSelect={() => toggleSelection(card.id)}
                                    onQuantityChange={!isLocked ? (newVal) => setCardQuantity(card.id, newVal) : undefined}
                                    onDecrement={!isLocked ? () => handleDecrement(card.id, card.quantity) : undefined}
                                    onEditPrice={!isLocked ? (newPrice) => setCustomPrice(card.id, newPrice) : undefined}
                                    onToggleAttribute={!isLocked ? (field, val) => toggleAttribute(card.id, field, val) : undefined}
                                    onIncrementTrade={!isLocked ? () => handleIncrementTrade(card.id, card.quantityForTrade ?? 0, card.quantity) : undefined}
                                    onDecrementTrade={!isLocked ? () => handleDecrementTrade(card.id, card.quantityForTrade ?? 0) : undefined}
                                    allowPriceEdit={!isLocked}
                                />
                            </div>
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

            {isSelectMode && selectedIds.length > 0 && !isLocked && (
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

            <DataTransferHubModal isOpen={isHubOpen} onClose={closeAllModals} onSelectImport={handleSelectImport} onSelectExport={handleSelectExport} targetLabel="Collection" />
            <ImportModal isOpen={isImportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} targetCollection="collection" listId={selectedListId} />
            <ExportModal isOpen={isExportOpen} onClose={closeAllModals} onGoBack={openHub} onCloseAll={closeAllModals} cards={cards} listName={currentListName} targetType="collection" />
            
            <CollectionToolsModal isOpen={isToolsOpen} onClose={() => setIsToolsOpen(false)} totalCards={cards.length} onRefreshPrices={refreshCollectionPrices} onBulkTrade={bulkSetTradeStatus} />
            
            <ConfirmModal isOpen={!!cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={confirmDeleteSingle} title="Retirer ?" message="Cette carte sera retirée de votre collection." />
        </main>
    );
}

export default function CollectionPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted animate-pulse">Chargement de la collection...</div>}>
            <CollectionContent />
        </Suspense>
    );
}