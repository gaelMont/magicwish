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

  const [toGive, setToGive] = useState<CardType[]>([]);
  const [toReceive, setToReceive] = useState<CardType[]>([]);
  
  const [localSearch, setLocalSearch] = useState('');
  const [remoteSearch, setRemoteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ScryfallCardRaw[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cardToPick, setCardToPick] = useState<ScryfallCardRaw | null>(null);

  // --- LOGIQUE ---
  const handleAddToGive = (card: CardType) => {
      const existing = toGive.find(c => c.id === card.id);
      if (existing) {
          if (existing.quantity < card.quantity) { 
              setToGive(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
          } else { toast.error("Max quantité atteinte"); }
      } else { setToGive(prev => [...prev, { ...card, quantity: 1 }]); }
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

  const handleSearchResultClick = (scryfallCard: ScryfallCardRaw) => { setCardToPick(scryfallCard); };

  const handleConfirmReceive = (card: CardType) => {
      const existing = toReceive.find(c => c.id === card.id && c.isFoil === card.isFoil); 
      if (existing) {
          setToReceive(prev => prev.map(c => (c.id === card.id && c.isFoil === card.isFoil) ? { ...c, quantity: c.quantity + card.quantity } : c));
      } else { setToReceive(prev => [...prev, card]); }
      setSearchResults([]); setRemoteSearch(""); toast.success(`Ajouté : ${card.name}`);
  };

  const handleValidate = async () => {
      if (toGive.length === 0 && toReceive.length === 0) return;
      if (!confirm("Confirmer cet échange ?")) return;
      const success = await executeTrade(toGive, toReceive, null);
      if (success) { setToGive([]); setToReceive([]); setLocalSearch(""); }
  };

  // CALCULS
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);
  const balance = valGive - valReceive;

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
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col">
        <h1 className="text-2xl font-bold mb-4 flex-none flex items-center gap-2">🖐️ Échange Manuel</h1>

        <div className="grid lg:grid-cols-2 gap-6 grow overflow-hidden pb-24">
            
            {/* --- COLONNE GAUCHE --- */}
            <div className="flex flex-col h-full bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900 overflow-hidden relative shadow-sm">
                 <div className="p-4 pb-0 flex-none">
                     <h2 className="font-bold text-red-600 mb-2">📤 Je donne</h2>
                     <input type="text" placeholder="Chercher dans ma collection..." className="w-full p-2 mb-2 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-600 text-sm" value={localSearch} onChange={e => setLocalSearch(e.target.value)} />
                 </div>
                 
                 <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                     {toGive.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                             <div className="bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300">SÉLECTION</div>
                             {toGive.map(card => (
                                <div key={card.id} className="flex justify-between items-center text-sm p-2 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50">
                                    <span>{card.quantity}x {card.name}</span>
                                    <button onClick={() => setToGive(p => p.filter(c => c.id !== card.id))} className="text-red-500 rounded px-1">✕</button>
                                </div>
                            ))}
                        </div>
                     )}
                     
                     <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ma Collection</p>
                        {loading ? <p className="text-sm">Chargement...</p> : 
                            myCollection.filter(c => c.name.toLowerCase().includes(localSearch.toLowerCase())).slice(0, 50).map(card => (
                                <div key={card.id} onClick={() => handleAddToGive(card)} className="cursor-pointer bg-white dark:bg-gray-800/50 hover:bg-red-100 p-2 rounded flex items-center gap-2 border border-transparent hover:border-red-200 transition shadow-sm group">
                                    <img src={card.imageUrl} className="w-8 h-11 rounded object-cover bg-gray-200 shrink-0" alt="" />
                                    <div className="grow min-w-0">
                                        <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                        <p className="text-[10px] text-gray-500">{card.setName} - Stock: {card.quantity}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400 group-hover:text-red-500 shrink-0">+</span>
                                </div>
                            ))
                        }
                     </div>
                 </div>
                 
                 <div className="flex-none bg-red-50 dark:bg-red-900/20 p-3 border-t border-red-100 dark:border-red-900 text-center">
                    <span className="text-xs text-red-600 font-bold uppercase">Total Donné</span>
                    <div className="text-xl font-bold text-red-700 dark:text-red-300">{valGive.toFixed(2)} €</div>
                </div>
            </div>

            {/* --- COLONNE DROITE --- */}
            <div className="flex flex-col h-full bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                    <h2 className="font-bold text-green-600 mb-2">📥 Je reçois</h2>
                    <form onSubmit={handleSearchScryfall} className="flex gap-2 mb-2">
                         <input type="text" placeholder="Rechercher carte..." className="grow p-2 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-600 text-sm" value={remoteSearch} onChange={e => setRemoteSearch(e.target.value)} />
                         <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-3 rounded shadow-sm">🔍</button>
                    </form>
                </div>

                <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                     {toReceive.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 overflow-hidden">
                             <div className="bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-bold text-green-700 dark:text-green-300">SÉLECTION</div>
                             {toReceive.map((card, idx) => (
                                <div key={`${card.id}-${idx}`} className="flex justify-between items-center text-sm p-2 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="font-bold shrink-0">{card.quantity}x</span>
                                        <div className="flex flex-col truncate"><span className="truncate">{card.name}</span><span className="text-[10px] text-gray-500 truncate">{card.setName} {card.isFoil && '✨'}</span></div>
                                    </div>
                                    <button onClick={() => setToReceive(p => p.filter((_, i) => i !== idx))} className="text-red-500 rounded px-1 ml-2">✕</button>
                                </div>
                            ))}
                        </div>
                     )}

                     <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Résultats Scryfall</p>
                        {uniqueSearchResults.map(card => (
                            <div key={card.id} onClick={() => handleSearchResultClick(card)} className="cursor-pointer bg-white dark:bg-gray-800/50 hover:bg-green-100 p-2 rounded flex items-center gap-2 border border-transparent hover:border-green-200 transition shadow-sm group">
                                <div className="w-8 h-11 bg-gray-200 rounded overflow-hidden shrink-0"><img src={card.image_uris?.small} className="w-full h-full object-cover" alt="" /></div>
                                <div className="grow min-w-0"><p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p><p className="text-[10px] text-gray-500 italic">Sélectionner...</p></div>
                                <span className="text-xs font-bold text-gray-400 group-hover:text-green-500 shrink-0">Choisir ›</span>
                            </div>
                        ))}
                     </div>
                </div>

                <div className="flex-none bg-green-50 dark:bg-green-900/20 p-3 border-t border-green-100 dark:border-green-900 text-center">
                    <span className="text-xs text-green-600 font-bold uppercase">Total Reçu</span>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">{valReceive.toFixed(2)} €</div>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex items-center px-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex-1"></div>
            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Balance</span>
                <div className={`text-2xl font-black ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                </div>
            </div>
            <div className="flex-1 flex justify-end">
                <button onClick={handleValidate} disabled={isProcessing || (toGive.length === 0 && toReceive.length === 0)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg transform active:scale-95">
                    {isProcessing ? 'Validation...' : '✅ Valider'}
                </button>
            </div>
        </div>

        <CardVersionPickerModal isOpen={!!cardToPick} baseCard={cardToPick} onClose={() => setCardToPick(null)} onConfirm={handleConfirmReceive} />
    </div>
  );
}