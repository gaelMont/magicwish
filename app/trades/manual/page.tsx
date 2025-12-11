// app/trades/manual/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeTransaction } from '@/hooks/useTradeTransaction';
import MagicCard from '@/components/MagicCard';
import toast from 'react-hot-toast';

export default function ManualTradePage() {
  const { user } = useAuth();
  const { cards: myCollection, loading } = useCardCollection('collection'); // Chargement de TOUTE ma collection
  const { executeTrade, isProcessing } = useTradeTransaction();

  // --- ÉTATS ---
  const [toGive, setToGive] = useState<CardType[]>([]);
  const [toReceive, setToReceive] = useState<CardType[]>([]);
  
  // Recherche Locale (Pour trouver mes cartes à donner)
  const [localSearch, setLocalSearch] = useState('');
  
  // Recherche Scryfall (Pour trouver ce que je reçois)
  const [remoteSearch, setRemoteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- LOGIQUE AJOUT / RETRAIT ---
  
  const handleAddToGive = (card: CardType) => {
      // On vérifie si déjà ajouté
      const existing = toGive.find(c => c.id === card.id);
      if (existing) {
          if (existing.quantity < card.quantity) { // Max ce que je possède
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

  const handleAddToReceive = (scryfallCard: any) => {
      // Conversion Scryfall -> CardType simplifié
      const newCard: CardType = {
          id: scryfallCard.id,
          name: scryfallCard.name,
          imageUrl: scryfallCard.image_uris?.normal || "",
          quantity: 1,
          price: parseFloat(scryfallCard.prices?.eur || "0"),
          setName: scryfallCard.set_name,
          isFoil: false
      };
      
      const existing = toReceive.find(c => c.id === newCard.id);
      if (existing) {
          setToReceive(prev => prev.map(c => c.id === newCard.id ? { ...c, quantity: c.quantity + 1 } : c));
      } else {
          setToReceive(prev => [...prev, newCard]);
      }
      setSearchResults([]); // On vide les résultats après choix
      setRemoteSearch("");
  };

  // --- VALIDATION ---
  const handleValidate = async () => {
      if (toGive.length === 0 && toReceive.length === 0) return;
      if (!confirm("Confirmer cet échange ? Vos cartes données seront retirées de votre collection.")) return;

      const success = await executeTrade(toGive, toReceive, null); // null = pas d'ami, juste moi
      if (success) {
          // Reset total
          setToGive([]);
          setToReceive([]);
          setLocalSearch("");
      }
  };

  // --- CALCULS ---
  const valGive = toGive.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);

  if (!user) return <div className="p-10 text-center">Connectez-vous.</div>;

  return (
    <div className="container mx-auto p-4 min-h-screen pb-20">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            🖐️ Échange Manuel / Externe
        </h1>

        <div className="grid lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
            
            {/* --- COLONNE GAUCHE : JE DONNE (Ma Collection) --- */}
            <div className="flex flex-col bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900 p-4">
                <h2 className="font-bold text-red-600 mb-2">📤 Je donne (De ma collection)</h2>
                
                {/* 1. Liste des cartes sélectionnées */}
                <div className="flex-none mb-4 space-y-2 min-h-[100px] bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[30vh]">
                    {toGive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Aucune carte sélectionnée</p>}
                    {toGive.map(card => (
                        <div key={card.id} className="flex justify-between items-center text-sm p-1 border-b">
                            <span>{card.quantity}x {card.name}</span>
                            <button onClick={() => setToGive(p => p.filter(c => c.id !== card.id))} className="text-red-500">✕</button>
                        </div>
                    ))}
                </div>

                {/* 2. Moteur de recherche local */}
                <input 
                    type="text" 
                    placeholder="Chercher dans ma collection..." 
                    className="w-full p-2 mb-2 rounded border dark:bg-gray-800"
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                />
                
                {/* 3. Résultats locaux */}
                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {loading ? <p>Chargement...</p> : 
                        myCollection
                            .filter(c => c.name.toLowerCase().includes(localSearch.toLowerCase()))
                            .slice(0, 20) // Limite affichage
                            .map(card => (
                                <div key={card.id} onClick={() => handleAddToGive(card)} className="cursor-pointer hover:bg-red-100 p-2 rounded flex items-center gap-2 border border-transparent hover:border-red-200 transition">
                                    <img src={card.imageUrl} className="w-8 h-11 rounded object-cover bg-gray-200" alt="" />
                                    <div className="flex-grow min-w-0">
                                        <p className="font-bold text-xs truncate">{card.name}</p>
                                        <p className="text-[10px] text-gray-500">{card.setName} - En stock: {card.quantity}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400">+</span>
                                </div>
                            ))
                    }
                </div>
            </div>

            {/* --- COLONNE DROITE : JE REÇOIS (Recherche Scryfall) --- */}
            <div className="flex flex-col bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900 p-4">
                <h2 className="font-bold text-green-600 mb-2">📥 Je reçois (Ajout libre)</h2>

                {/* 1. Liste des cartes reçues */}
                 <div className="flex-none mb-4 space-y-2 min-h-[100px] bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[30vh]">
                    {toReceive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Aucune carte ajoutée</p>}
                    {toReceive.map(card => (
                        <div key={card.id} className="flex justify-between items-center text-sm p-1 border-b">
                            <span>{card.quantity}x {card.name}</span>
                            <button onClick={() => setToReceive(p => p.filter(c => c.id !== card.id))} className="text-red-500">✕</button>
                        </div>
                    ))}
                </div>

                {/* 2. Moteur Scryfall */}
                <form onSubmit={handleSearchScryfall} className="flex gap-2 mb-2">
                    <input 
                        type="text" 
                        placeholder="Rechercher carte à recevoir..." 
                        className="flex-grow p-2 rounded border dark:bg-gray-800"
                        value={remoteSearch}
                        onChange={e => setRemoteSearch(e.target.value)}
                    />
                    <button type="submit" className="bg-green-600 text-white px-3 rounded">🔍</button>
                </form>

                {/* 3. Résultats Scryfall */}
                 <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {isSearching && <p className="text-xs">Recherche...</p>}
                    {searchResults.map(card => (
                        <div key={card.id} onClick={() => handleAddToReceive(card)} className="cursor-pointer hover:bg-green-100 p-2 rounded flex items-center gap-2 border border-transparent hover:border-green-200 transition">
                             <div className="w-8 h-11 bg-gray-200 rounded overflow-hidden">
                                {card.image_uris?.small && <img src={card.image_uris.small} className="w-full h-full object-cover" alt="" />}
                             </div>
                             <div className="flex-grow min-w-0">
                                <p className="font-bold text-xs truncate">{card.name}</p>
                                <p className="text-[10px] text-gray-500">{card.set_name}</p>
                             </div>
                             <span className="text-xs font-bold text-gray-400">+</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* --- FOOTER DE VALIDATION --- */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex justify-between items-center z-50 shadow-2xl">
            <div className="flex gap-4 text-sm">
                <div>Donne: <span className="font-bold">{valGive.toFixed(2)}€</span></div>
                <div>Reçoit: <span className="font-bold">{valReceive.toFixed(2)}€</span></div>
            </div>
            <button 
                onClick={handleValidate}
                disabled={isProcessing || (toGive.length === 0 && toReceive.length === 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition"
            >
                {isProcessing ? 'Validation...' : '✅ Valider et Mettre à jour ma collection'}
            </button>
        </div>
    </div>
  );
}