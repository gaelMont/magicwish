// app/collection/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection } from '@/hooks/useCardCollection'; 
import MagicCard from '@/components/MagicCard';
import ImportModal from '@/components/ImportModal';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteAllButton from '@/components/DeleteAllButton';

// 1. Définition stricte des options de tri
type SortOption = 'name' | 'price_desc' | 'price_asc' | 'quantity' | 'date';

export default function CollectionPage() {
  const { user } = useAuth();
  
  const { 
    cards, loading, updateQuantity, removeCard, 
    setCustomPrice, toggleAttribute, refreshCollectionPrices,
    totalPrice 
  } = useCardCollection('collection');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  
  // 2. Utilisation du type strict
  const [sortBy, setSortBy] = useState<SortOption>('date');
  
  const [filterSet, setFilterSet] = useState<string>('all');
  const [filterTrade, setFilterTrade] = useState(false);
  const [filterFoil, setFilterFoil] = useState(false);

  // --- LOGIQUE DE FILTRAGE ET TRI ---
  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];

    // Filtrage
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

    // Tri
    result.sort((a, b) => {
        const priceA = a.customPrice ?? a.price ?? 0;
        const priceB = b.customPrice ?? b.price ?? 0;

        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'price_desc':
                return priceB - priceA;
            case 'price_asc':
                return priceA - priceB;
            case 'quantity':
                return b.quantity - a.quantity;
            case 'date':
            default:
                return 0; 
        }
    });

    return result;
  }, [cards, searchQuery, sortBy, filterSet, filterTrade, filterFoil]);

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

  if (loading) return <p className="text-center p-10 text-gray-500">Chargement de votre collection...</p>;
  if (!user) return <p className="text-center p-10">Veuillez vous connecter.</p>;

  return (
    <main className="container mx-auto p-4 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            Ma Collection 
            <span className="ml-3 text-lg font-normal text-gray-500">
                ({filteredAndSortedCards.length} / {cards.reduce((acc, c) => acc + c.quantity, 0)})
            </span>
        </h1>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={refreshCollectionPrices}
             className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm border border-gray-200 dark:border-gray-600"
             title="Mettre à jour les prix depuis Scryfall"
           >
             🔄 Actualiser
           </button>

           <DeleteAllButton targetCollection="collection" />
           
           <button 
            onClick={() => setIsImportOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
          >
            Importer CSV
          </button>
           <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-100 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-right min-w-[100px]">
             <span className="text-[10px] uppercase tracking-wide opacity-70 block">Valeur Totale</span>
             <span className="font-bold">{totalPrice.toFixed(2)} €</span>
           </div>
        </div>
      </div>

      {/* BARRE D'OUTILS DE FILTRES */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6 space-y-4 md:space-y-0 md:flex md:items-end md:gap-4">
          
          <div className="flex-grow">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nom de la carte</label>
              <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
          </div>

          <div className="min-w-[200px]">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Édition</label>
              <select 
                  value={filterSet} 
                  onChange={(e) => setFilterSet(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                  <option value="all">Toutes les éditions</option>
                  {availableSets.map(set => (
                      <option key={set} value={set}>{set}</option>
                  ))}
              </select>
          </div>

          <div className="min-w-[180px]">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Trier par</label>
              <select 
                  value={sortBy} 
                  // 3. Casting propre vers le type SortOption
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                  <option value="date">Date d&apos;ajout</option>
                  <option value="price_desc">Prix : Haut → Bas</option>
                  <option value="price_asc">Prix : Bas → Haut</option>
                  <option value="name">Nom : A → Z</option>
                  <option value="quantity">Quantité</option>
              </select>
          </div>

          <div className="flex items-center gap-4 pb-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={filterFoil} 
                    onChange={(e) => setFilterFoil(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm font-medium">Foil</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={filterTrade} 
                    onChange={(e) => setFilterTrade(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300"
                  />
                  <span className="text-sm font-medium">Échange</span>
              </label>
          </div>
      </div>

      {/* GRILLE */}
      {filteredAndSortedCards.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-xl text-gray-500 mb-4">Aucun résultat.</p>
          <button 
            onClick={() => { setSearchQuery(''); setFilterSet('all'); setFilterTrade(false); setFilterFoil(false); }}
            className="text-blue-600 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAndSortedCards.map((card) => (
            <MagicCard 
              key={card.id}
              {...card}
              onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
              onDecrement={() => handleDecrement(card.id, card.quantity)}
              onDelete={() => setCardToDelete(card.id)}
              onEditPrice={(newPrice) => setCustomPrice(card.id, newPrice)}
              onToggleAttribute={(field, val) => toggleAttribute(card.id, field, val)}
            />
          ))}
        </div>
      )}

      {/* MODALES */}
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} targetCollection="collection" />
      
      <ConfirmModal 
        isOpen={!!cardToDelete} 
        onClose={() => setCardToDelete(null)} 
        onConfirm={() => { if(cardToDelete) removeCard(cardToDelete); }} 
        title="Retirer ?" 
        message="Cette carte sera retirée de votre collection."
      />
    </main>
  );
}