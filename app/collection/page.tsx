// app/collection/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection } from '@/hooks/useCardCollection'; // <--- IMPORT DU HOOK
import MagicCard from '@/components/MagicCard';
import ImportModal from '@/components/ImportModal';
import ConfirmModal from '@/components/ConfirmModal';
import DeleteAllButton from '@/components/DeleteAllButton';

export default function CollectionPage() {
  const { user } = useAuth();
  
  // TOUTE LA LOGIQUE EST ICI :
  const { cards, loading, updateQuantity, removeCard, totalPrice } = useCardCollection('collection');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  // Gestion du clic sur "-"
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
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            Ma Collection <span className="ml-3 text-lg font-normal text-gray-500">({cards.reduce((acc, c) => acc + c.quantity, 0)})</span>
          </h1>
          <button 
            onClick={() => setIsImportOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
          >
            📂 Importer CSV
          </button>
        </div>
        
        <div className="flex items-center gap-4">
           <DeleteAllButton targetCollection="collection" />
           <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-100 px-6 py-3 rounded-xl shadow-sm border border-blue-200 dark:border-blue-700">
             <span className="text-sm uppercase tracking-wide opacity-80">Valeur</span>
             <div className="text-2xl font-bold">{totalPrice.toFixed(2)} €</div>
           </div>
        </div>
      </div>

      {/* LISTE DES CARTES */}
      {cards.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-xl text-gray-500 mb-4">Votre collection est vide.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <MagicCard 
              key={card.id}
              {...card}
              onIncrement={() => updateQuantity(card.id, 1, card.quantity)}
              onDecrement={() => handleDecrement(card.id, card.quantity)}
              onDelete={() => setCardToDelete(card.id)}
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