'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeTransaction } from '@/hooks/useTradeTransaction';
import toast from 'react-hot-toast';
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

  // État pour la modale de sélection
  const [cardToPick, setCardToPick] = useState<ScryfallCardRaw | null>(null);

  // --- LOGIQUE AJOUT / RETRAIT ---
  
  const handleAddToGive = (card: CardType) => {
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
          const res = await fetch(`/api/search?q=${remoteSearch}`); 
          const data = await res.json();
          setSearchResults(data.data || []);
      } catch (e) { toast.error("Erreur recherche"); }
      finally { setIsSearching(false); }
  };

  // Click sur résultat recherche -> Ouvre la modale
  const handleSearchResultClick = (scryfallCard: ScryfallCardRaw) => {
    setCardToPick(scryfallCard);
  };

  // Retour de la modale -> Ajoute à la liste "Je reçois"
  const handleConfirmReceive = (card: CardType) => {
      const existing = toReceive.find(c => c.id === card.id && c.isFoil === card.isFoil); 
      
      if (existing) {
          setToReceive(prev => prev.map(c => 
              (c.id === card.id && c.isFoil === card.isFoil) 
              ? { ...c, quantity: c.quantity + card.quantity } 
              : c
          ));
      } else {
          setToReceive(prev => [...prev, card]);
      }
      
      // On vide la recherche pour nettoyer l'interface
      setSearchResults([]); 
      setRemoteSearch("");
      toast.success(`Ajouté : ${card.name}`);
  };

  // --- VALIDATION ---
  const handleValidate = async () => {
      if (toGive.length === 0 && toReceive.length === 0) return;
      if (!confirm("Confirmer cet échange ? Vos cartes données seront retirées de votre collection.")) return;

      const success = await executeTrade(toGive, toReceive, null);
      if (success) {
          setToGive([]);
          setToReceive([]);
          setLocalSearch("");
      }
  };

  // --- CALCULS & FILTRES ---
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);

  // ⚡ On filtre les doublons de nom pour l'affichage
  const uniqueSearchResults = useMemo(() => {
    const seen = new Set();
    return searchResults.filter(card => {
      const name = card.name.split(' // ')[0];
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [searchResults]);

  if (!user) return <div className="p-10 text-center">Connectez-vous.</div>;

  return (
    // CONTENEUR PRINCIPAL FIXE (Hauteur écran - Header)
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col">
        
        <h1 className="text-2xl font-bold mb-4 flex-none flex items-center gap-2">
            🖐️ Échange Manuel / Externe
        </h1>

        {/* GRILLE QUI PREND TOUT L'ESPACE RESTANT */}
        <div className="grid lg:grid-cols-2 gap-6 grow overflow-hidden pb-24">
            
            {/* --- COLONNE GAUCHE : JE DONNE --- */}
            <div className="flex flex-col h-full bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900 p-4 overflow-hidden shadow-sm">
                <h2 className="font-bold text-red-600 mb-2 flex-none">📤 Je donne (De ma collection)</h2>
                
                {/* 1. Liste Sélectionnée (Max 30% hauteur) */}
                 <div className="flex-none max-h-[30%] overflow-y-auto custom-scrollbar mb-4 space-y-2 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                    {toGive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">Aucune carte sélectionnée</p>}
                    {toGive.map(card => (
                        <div key={card.id} className="flex justify-between items-center text-sm p-1 border-b dark:border-gray-700 last:border-0">
                            <span>{card.quantity}x {card.name}</span>
                            <button onClick={() => setToGive(p => p.filter(c => c.id !== card.id))} className="text-red-500 hover:bg-red-50 rounded px-1">✕</button>
                        </div>
                    ))}
                </div>
                
                {/* 2. Barre Recherche (Fixe) */}
                <input 
                    type="text" 
                    placeholder="Chercher dans ma collection..." 
                    className="flex-none w-full p-2 mb-2 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                />
                
                {/* 3. Résultats (Prend tout le reste de l'espace) */}
                <div className="grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {loading ? <p>Chargement...</p> : 
                        myCollection
                            .filter(c => c.name.toLowerCase().includes(localSearch.toLowerCase()))
                            .slice(0, 50)
                            .map(card => (
                                <div key={card.id} onClick={() => handleAddToGive(card)} className="cursor-pointer bg-white dark:bg-gray-800/50 hover:bg-red-100 dark:hover:bg-red-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-red-200 transition shadow-sm">
                                    <img src={card.imageUrl} className="w-8 h-11 rounded object-cover bg-gray-200 shrink-0" alt="" />
                                    <div className="grow min-w-0">
                                        <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                        <p className="text-[10px] text-gray-500">{card.setName} - Stock: {card.quantity}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400 shrink-0">+</span>
                                </div>
                            ))
                    }
                </div>
            </div>

            {/* --- COLONNE DROITE : JE REÇOIS --- */}
            <div className="flex flex-col h-full bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900 p-4 overflow-hidden shadow-sm">
                <h2 className="font-bold text-green-600 mb-2 flex-none">📥 Je reçois (Ajout libre)</h2>

                {/* 1. Liste Sélectionnée (Max 30% hauteur) */}
                 <div className="flex-none max-h-[30%] overflow-y-auto custom-scrollbar mb-4 space-y-2 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                    {toReceive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">Aucune carte ajoutée</p>}
                    {toReceive.map((card, idx) => (
                        <div key={`${card.id}-${idx}`} className="flex justify-between items-center text-sm p-1 border-b dark:border-gray-700 last:border-0">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="font-bold shrink-0">{card.quantity}x</span>
                                <div className="flex flex-col truncate">
                                    <span className="dark:text-gray-200 truncate">{card.name}</span>
                                    <span className="text-[10px] text-gray-500 truncate">
                                        {card.setName} {card.isFoil && '✨'} - {(card.price || 0).toFixed(2)}€
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setToReceive(p => p.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 rounded px-1 ml-2">✕</button>
                        </div>
                    ))}
                </div>

                {/* 2. Moteur Scryfall (Fixe) */}
                <form onSubmit={handleSearchScryfall} className="flex-none flex gap-2 mb-2">
                    <input 
                        type="text" 
                        placeholder="Rechercher carte à recevoir..." 
                        className="grow p-2 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-600"
                        value={remoteSearch}
                        onChange={e => setRemoteSearch(e.target.value)}
                    />
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-3 rounded shadow-sm">🔍</button>
                </form>

                {/* 3. Résultats Scryfall (Prend tout le reste) */}
                 <div className="grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {isSearching && <p className="text-xs text-center py-4">Recherche Scryfall...</p>}
                    
                    {uniqueSearchResults.map(card => (
                        <div key={card.id} onClick={() => handleSearchResultClick(card)} className="cursor-pointer bg-white dark:bg-gray-800/50 hover:bg-green-100 dark:hover:bg-green-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-green-200 transition shadow-sm">
                             <div className="w-8 h-11 bg-gray-200 rounded overflow-hidden shrink-0">
                                {card.image_uris?.small && <img src={card.image_uris.small} className="w-full h-full object-cover" alt="" />}
                             </div>
                             <div className="grow min-w-0">
                                <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                <p className="text-[10px] text-gray-500 italic">Sélectionner version...</p>
                             </div>
                             <span className="text-xs font-bold text-gray-400 shrink-0">Choisir ›</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* --- FOOTER DE VALIDATION (Fixe en bas) --- */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex justify-between items-center px-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex gap-6 text-sm">
                <div>Donne: <span className="font-bold text-red-600">{valGive.toFixed(2)}€</span></div>
                <div>Reçoit: <span className="font-bold text-green-600">{valReceive.toFixed(2)}€</span></div>
            </div>
            <button 
                onClick={handleValidate}
                disabled={isProcessing || (toGive.length === 0 && toReceive.length === 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg transform active:scale-95"
            >
                {isProcessing ? 'Validation...' : '✅ Valider l\'échange'}
            </button>
        </div>

        {/* MODALE DE SÉLECTION DE VERSION */}
        <CardVersionPickerModal 
            isOpen={!!cardToPick}
            baseCard={cardToPick}
            onClose={() => setCardToPick(null)}
            onConfirm={handleConfirmReceive}
        />

    </div>
  );
}