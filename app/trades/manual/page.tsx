// app/trades/manual/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeTransaction } from '@/hooks/useTradeTransaction';
import MagicCard from '@/components/MagicCard';
import toast from 'react-hot-toast';
// 1. IMPORT DU NOUVEAU COMPOSANT
import CardVersionPickerModal, { ScryfallCardRaw } from '@/components/CardVersionPickerModal';

export default function ManualTradePage() {
  const { user } = useAuth();
  const { cards: myCollection, loading } = useCardCollection('collection'); 
  const { executeTrade, isProcessing } = useTradeTransaction();

  // --- ÉTATS ---
  const [toGive, setToGive] = useState<CardType[]>([]);
  const [toReceive, setToReceive] = useState<CardType[]>([]);
  
  const [localSearch, setLocalSearch] = useState('');
  
  const [remoteSearch, setRemoteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ScryfallCardRaw[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 2. ÉTAT POUR LA MODALE DE SÉLECTION
  const [cardToPick, setCardToPick] = useState<ScryfallCardRaw | null>(null);

  // --- LOGIQUE AJOUT / RETRAIT ---
  
  const handleAddToGive = (card: CardType) => {
      // (Code existant inchangé pour "Je donne")
      const existing = toGive.find(c => c.id === card.id);
      if (existing) {
          if (existing.quantity < card.quantity) { 
              setToGive(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
          } else {
              toast.error("Max quantité atteinte");
          }
      } else {
          setToGive(prev => [...prev, { ...card, quantity: 1 }]);
      }
  };

  const handleSearchScryfall = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!remoteSearch.trim()) return;
      setIsSearching(true);
      try {
          // On ajoute &unique=prints pour avoir moins de doublons visuels dans la recherche initiale
          const res = await fetch(`/api/search?q=${remoteSearch}`); 
          const data = await res.json();
          setSearchResults(data.data || []);
      } catch (e) { toast.error("Erreur recherche"); }
      finally { setIsSearching(false); }
  };

  // 3. FONCTION DÉCLENCHEUR (Click sur résultat recherche)
  const handleSearchResultClick = (scryfallCard: ScryfallCardRaw) => {
    // Au lieu d'ajouter direct, on ouvre la modale
    setCardToPick(scryfallCard);
  };

  // 4. FONCTION DE CONFIRMATION (Retour de la modale)
  const handleConfirmReceive = (card: CardType) => {
      const existing = toReceive.find(c => c.id === card.id && c.isFoil === card.isFoil); // On distingue les foils
      
      if (existing) {
          setToReceive(prev => prev.map(c => 
              (c.id === card.id && c.isFoil === card.isFoil) 
              ? { ...c, quantity: c.quantity + card.quantity } 
              : c
          ));
      } else {
          setToReceive(prev => [...prev, card]);
      }
      
      // On ferme la recherche pour plus de clarté
      setSearchResults([]); 
      setRemoteSearch("");
      toast.success(`Ajouté : ${card.name}`);
  };

  // --- VALIDATION ---
  const handleValidate = async () => {
      // (Code existant inchangé)
      if (toGive.length === 0 && toReceive.length === 0) return;
      if (!confirm("Confirmer cet échange ? Vos cartes données seront retirées de votre collection.")) return;

      const success = await executeTrade(toGive, toReceive, null);
      if (success) {
          setToGive([]);
          setToReceive([]);
          setLocalSearch("");
      }
  };

  // --- CALCULS ---
  // On prend en compte le customPrice s'il existe (non pertinent pour l'externe mais bon pour la structure)
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);

  if (!user) return <div className="p-10 text-center">Connectez-vous.</div>;

  return (
    <div className="container mx-auto p-4 min-h-screen pb-20">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            🖐️ Échange Manuel / Externe
        </h1>

        <div className="grid lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
            
            {/* --- COLONNE GAUCHE (Inchinchangé) --- */}
            <div className="flex flex-col bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900 p-4">
                <h2 className="font-bold text-red-600 mb-2">📤 Je donne (De ma collection)</h2>
                {/* ... (Reste du code de la colonne gauche inchangé) ... */}
                 <div className="flex-none mb-4 space-y-2 min-h-[100px] bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[30vh]">
                    {toGive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Aucune carte sélectionnée</p>}
                    {toGive.map(card => (
                        <div key={card.id} className="flex justify-between items-center text-sm p-1 border-b dark:border-gray-700">
                            <span>{card.quantity}x {card.name}</span>
                            <button onClick={() => setToGive(p => p.filter(c => c.id !== card.id))} className="text-red-500">✕</button>
                        </div>
                    ))}
                </div>
                <input 
                    type="text" 
                    placeholder="Chercher dans ma collection..." 
                    className="w-full p-2 mb-2 rounded border dark:bg-gray-800 dark:text-white"
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                />
                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {loading ? <p>Chargement...</p> : 
                        myCollection
                            .filter(c => c.name.toLowerCase().includes(localSearch.toLowerCase()))
                            .slice(0, 20)
                            .map(card => (
                                <div key={card.id} onClick={() => handleAddToGive(card)} className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-red-200 transition">
                                    <img src={card.imageUrl} className="w-8 h-11 rounded object-cover bg-gray-200" alt="" />
                                    <div className="flex-grow min-w-0">
                                        <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                        <p className="text-[10px] text-gray-500">{card.setName} - En stock: {card.quantity}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400">+</span>
                                </div>
                            ))
                    }
                </div>
            </div>

            {/* --- COLONNE DROITE : JE REÇOIS (Modifiée) --- */}
            <div className="flex flex-col bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900 p-4">
                <h2 className="font-bold text-green-600 mb-2">📥 Je reçois (Ajout libre)</h2>

                {/* 1. Liste des cartes reçues */}
                 <div className="flex-none mb-4 space-y-2 min-h-[100px] bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[30vh]">
                    {toReceive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Aucune carte ajoutée</p>}
                    {toReceive.map((card, idx) => (
                        <div key={`${card.id}-${idx}`} className="flex justify-between items-center text-sm p-1 border-b dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{card.quantity}x</span>
                                <div className="flex flex-col">
                                    <span className="dark:text-gray-200">{card.name}</span>
                                    <span className="text-[10px] text-gray-500">
                                        {card.setName} {card.isFoil && '✨ Foil'} - {(card.price || 0).toFixed(2)}€
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setToReceive(p => p.filter((_, i) => i !== idx))} className="text-red-500">✕</button>
                        </div>
                    ))}
                </div>

                {/* 2. Moteur Scryfall */}
                <form onSubmit={handleSearchScryfall} className="flex gap-2 mb-2">
                    <input 
                        type="text" 
                        placeholder="Rechercher carte à recevoir..." 
                        className="flex-grow p-2 rounded border dark:bg-gray-800 dark:text-white"
                        value={remoteSearch}
                        onChange={e => setRemoteSearch(e.target.value)}
                    />
                    <button type="submit" className="bg-green-600 text-white px-3 rounded">🔍</button>
                </form>

                {/* 3. Résultats Scryfall (Click ouvre la modale) */}
                 <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {isSearching && <p className="text-xs">Recherche...</p>}
                    {searchResults.map(card => (
                        <div key={card.id} onClick={() => handleSearchResultClick(card)} className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-green-200 transition">
                             <div className="w-8 h-11 bg-gray-200 rounded overflow-hidden">
                                {card.image_uris?.small && <img src={card.image_uris.small} className="w-full h-full object-cover" alt="" />}
                             </div>
                             <div className="flex-grow min-w-0">
                                <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                <p className="text-[10px] text-gray-500">{card.set_name}</p>
                             </div>
                             <span className="text-xs font-bold text-gray-400">Choisir ›</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* --- FOOTER DE VALIDATION --- */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex justify-between items-center z-40 shadow-2xl">
            <div className="flex gap-4 text-sm">
                <div>Donne: <span className="font-bold">{valGive.toFixed(2)}€</span></div>
                <div>Reçoit: <span className="font-bold">{valReceive.toFixed(2)}€</span></div>
            </div>
            <button 
                onClick={handleValidate}
                disabled={isProcessing || (toGive.length === 0 && toReceive.length === 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition"
            >
                {isProcessing ? 'Validation...' : '✅ Valider l\'échange'}
            </button>
        </div>

        {/* 5. INTÉGRATION DE LA MODALE */}
        <CardVersionPickerModal 
            isOpen={!!cardToPick}
            baseCard={cardToPick}
            onClose={() => setCardToPick(null)}
            onConfirm={handleConfirmReceive}
        />

    </div>
  );
}