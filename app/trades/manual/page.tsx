'use client';

import { useState, useMemo, useTransition } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { executeManualTrade } from '@/app/actions/trade'; 
import toast from 'react-hot-toast';
import CardVersionPickerModal from '@/components/CardVersionPickerModal';
import { ScryfallRawData } from '@/lib/cardUtils';

// Definition locale stricte du payload attendu par le serveur
interface ServerCardPayload {
    id: string;
    name: string;
    imageUrl: string;
    imageBackUrl: string | null; // Ici, pas d'undefined autorisé
    quantity: number;
    price: number;
    customPrice?: number;
    setName: string;
    setCode: string;
    isFoil: boolean;
    isSpecificVersion: boolean;
    scryfallData: Record<string, unknown> | null;
    wishlistId: string | null;
}

// Fonction de conversion CardType (Client) -> ServerCardPayload (Serveur)
// Elle transforme les undefined en null pour satisfaire le typage strict
const mapCardsForServer = (cards: CardType[]): ServerCardPayload[] => {
    return cards.map(c => {
        const payload: ServerCardPayload = {
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl,
            // CORRECTION ICI : on force null si c.imageBackUrl est undefined
            imageBackUrl: c.imageBackUrl ?? null,
            quantity: c.quantity,
            price: c.price ?? 0,
            customPrice: c.customPrice,
            setName: c.setName ?? '',
            setCode: c.setCode ?? '',
            isFoil: c.isFoil ?? false,
            isSpecificVersion: c.isSpecificVersion ?? false,
            scryfallData: (c.scryfallData as Record<string, unknown>) || null,
            wishlistId: c.wishlistId ?? null,
        };
        
        // Nettoyage si customPrice est undefined (car optionnel dans l'interface aussi)
        if (payload.customPrice === undefined) delete payload.customPrice;
        
        return payload;
    });
};

// Type Guard pour distinguer une carte de collection d'un résultat API brut
function isCollectionCard(item: CardType | ScryfallRawData): item is CardType {
    return (item as CardType).quantity !== undefined;
}

// --- COMPOSANTS UI ---

const TradeSelectionTable = ({ 
    cards, 
    onRemove, 
    colorClass, 
    emptyLabel 
}: { 
    cards: CardType[], 
    onRemove: (id: string) => void, 
    colorClass: 'text-danger' | 'text-success',
    emptyLabel: string
}) => {
    if (cards.length === 0) {
        return <div className="flex-1 flex items-center justify-center border-b border-border bg-secondary/10 text-muted text-sm italic p-8">{emptyLabel}</div>;
    }

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-surface border-b border-border shadow-sm">
            <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-secondary text-muted sticky top-0 z-10 font-semibold uppercase">
                        <tr>
                            <th className="px-2 py-2 text-center w-10">Qté</th>
                            <th className="px-2 py-2">Nom</th>
                            <th className="px-2 py-2 w-12 text-center">Set</th>
                            <th className="px-2 py-2 w-10 text-center">N°</th>
                            <th className="px-2 py-2 w-10 text-center">Foil</th>
                            <th className="px-2 py-2 text-right w-16">Prix</th>
                            <th className="px-2 py-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {cards.map((card, i) => {
                            const scryData = card.scryfallData as ScryfallRawData | undefined;
                            const collectorNum = scryData?.collector_number || '?';
                            return (
                                <tr key={`${card.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground">
                                    <td className={`px-2 py-1.5 text-center font-bold ${colorClass} bg-opacity-10`}>{card.quantity}</td>
                                    <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={card.name}>{card.name}</td>
                                    <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{card.setCode?.toUpperCase()}</span></td>
                                    <td className="px-2 py-1.5 text-center text-muted font-mono text-[10px]">{collectorNum}</td>
                                    <td className="px-2 py-1.5 text-center">{card.isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">Foil</span>}</td>
                                    <td className="px-2 py-1.5 text-right text-muted tabular-nums">{(card.customPrice ?? card.price ?? 0).toFixed(2)}€</td>
                                    <td className="px-2 py-1.5 text-center"><button onClick={() => onRemove(card.id)} className="text-muted hover:text-danger transition px-1 font-bold">✕</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TradeSourceTable = ({ 
    cards, 
    onAdd, 
    buttonColorClass,
    loading 
}: { 
    cards: (CardType | ScryfallRawData)[], 
    onAdd: (c: CardType | ScryfallRawData) => void, 
    buttonColorClass: 'text-danger' | 'text-success',
    loading?: boolean
}) => {
    if (loading) return <p className="text-xs text-muted text-center py-4">Chargement...</p>;
    if (cards.length === 0) return <p className="text-xs text-muted text-center py-4">Aucun résultat.</p>;

    return (
        <div className="overflow-y-auto custom-scrollbar flex-1 bg-surface">
            <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-background text-muted sticky top-0 z-10 font-semibold uppercase">
                    <tr>
                        <th className="px-2 py-2 text-center w-10">Stock</th>
                        <th className="px-2 py-2">Nom</th>
                        <th className="px-2 py-2 w-12 text-center">Set</th>
                        <th className="px-2 py-2 w-10 text-center">N°</th>
                        <th className="px-2 py-2 w-10 text-center">Foil</th>
                        <th className="px-2 py-2 w-8"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {cards.map((item, i) => {
                        let name: string;
                        let setCode: string;
                        let collectorNum: string;
                        let isFoil: boolean;
                        let quantityDisplay: string | number;

                        if (isCollectionCard(item)) {
                            name = item.name;
                            setCode = item.setCode || '';
                            const scryData = item.scryfallData as ScryfallRawData | undefined;
                            collectorNum = scryData?.collector_number || '?';
                            isFoil = !!item.isFoil;
                            quantityDisplay = item.quantity;
                        } else {
                            name = item.name;
                            setCode = item.set || '';
                            collectorNum = item.collector_number || '?';
                            isFoil = false; 
                            quantityDisplay = '-';
                        }

                        return (
                            <tr key={`${item.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground cursor-pointer group" onClick={() => onAdd(item)}>
                                <td className="px-2 py-1.5 text-center text-muted font-mono">{quantityDisplay}</td>
                                <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={name}>{name}</td>
                                <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{setCode.toUpperCase()}</span></td>
                                <td className="px-2 py-1.5 text-center text-muted font-mono text-[10px]">{collectorNum}</td>
                                <td className="px-2 py-1.5 text-center">{isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">Foil</span>}</td>
                                <td className="px-2 py-1.5 text-center">
                                    <button className={`${buttonColorClass} font-bold hover:scale-125 transition-transform`}>+</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default function ManualTradePage() {
  const { user } = useAuth();
  const { cards: myCollection, loading } = useCardCollection('collection'); 
  
  const [isPending, startTransition] = useTransition();

  const [toGive, setToGive] = useState<CardType[]>([]);
  const [toReceive, setToReceive] = useState<CardType[]>([]);
  
  const [localSearch, setLocalSearch] = useState('');
  const [remoteSearch, setRemoteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ScryfallRawData[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [cardToPick, setCardToPick] = useState<ScryfallRawData | null>(null);

  // --- ACTIONS ---

  const handleAddToGive = (item: CardType | ScryfallRawData) => {
      if (!isCollectionCard(item)) return;
      const card = item;

      const existing = toGive.find(c => c.id === card.id);
      const maxStock = card.quantity;
      const currentSelected = existing ? existing.quantity : 0;

      if (currentSelected < maxStock) { 
          if (existing) {
              setToGive(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
          } else {
              setToGive(prev => [...prev, { ...card, quantity: 1 }]);
          }
      } else {
          toast.error("Stock max atteint");
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) { toast.error("Erreur recherche"); }
      finally { setIsSearching(false); }
  };

  const handleConfirmReceive = (card: CardType) => {
      const existing = toReceive.find(c => c.id === card.id && c.isFoil === card.isFoil); 
      if (existing) {
          setToReceive(prev => prev.map(c => (c.id === card.id && c.isFoil === card.isFoil) ? { ...c, quantity: c.quantity + card.quantity } : c));
      } else {
          setToReceive(prev => [...prev, card]);
      }
      setSearchResults([]); 
      setRemoteSearch("");
      toast.success(`Ajouté : ${card.name}`);
  };

  const handleValidate = async () => {
      if (!user) return;
      if (toGive.length === 0 && toReceive.length === 0) return;
      if (!confirm("Confirmer cet échange ? Vos cartes données seront retirées de votre collection.")) return;

      const toastId = toast.loading("Validation...");

      startTransition(async () => {
        // CORRECTION MAJEURE ICI :
        // On passe les données par la fonction de mapping pour convertir
        // les propriétés 'undefined' en 'null' (pour imageBackUrl notamment).
        const cleanToGive = mapCardsForServer(toGive);
        const cleanToReceive = mapCardsForServer(toReceive);
        
        const result = await executeManualTrade(user.uid, cleanToGive, cleanToReceive) as { success: boolean; error?: string; };
        
        if (result.success) {
            toast.success("Echange validé !", { id: toastId });
            setToGive([]); setToReceive([]); setLocalSearch("");
        } else {
            toast.error(result.error || "Erreur", { id: toastId });
        }
      });
  };

  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);

  const filteredCollection = useMemo(() => {
      return myCollection.filter(c => c.name.toLowerCase().includes(localSearch.toLowerCase())).slice(0, 50);
  }, [myCollection, localSearch]);

  const uniqueSearchResults = useMemo(() => {
    const seen = new Set();
    return searchResults.filter(card => {
      const name = card.name.split(' // ')[0];
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [searchResults]);

  if (!user) return <div className="p-10 text-center text-muted">Connectez-vous.</div>;

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col">
        <h1 className="text-2xl font-bold mb-4 flex-none text-foreground">Échange Manuel</h1>

        <div className="grid lg:grid-cols-2 gap-4 grow overflow-hidden pb-24">
            
            {/* GAUCHE : JE DONNE */}
            <div className="flex flex-col h-full bg-danger/5 rounded-xl border border-danger/20 overflow-hidden relative shadow-sm">
                
                <div className="flex-2 flex flex-col min-h-0 bg-surface">
                    <div className="flex justify-between items-center p-2 bg-danger/10 border-b border-danger/20">
                        <span className="text-xs font-bold text-danger uppercase">À DONNER ({toGive.reduce((a,c)=>a+c.quantity,0)})</span>
                        <span className="text-sm font-bold text-danger">{valGive.toFixed(2)} €</span>
                    </div>
                    <TradeSelectionTable cards={toGive} onRemove={(id) => setToGive(p => p.filter(c => c.id !== id))} colorClass="text-danger" emptyLabel="Sélectionnez vos cartes en bas..." />
                </div>

                <div className="p-3 flex-none border-t border-border bg-surface border-b">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="font-bold text-muted text-xs uppercase tracking-wide">Chercher dans ma Collection</h2>
                        <span className="text-[10px] bg-secondary text-muted px-2 py-0.5 rounded-full">{myCollection.length} cartes</span>
                    </div>
                    <input type="text" placeholder="Filtrer par nom..." className="w-full p-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-danger outline-none" value={localSearch} onChange={e => setLocalSearch(e.target.value)} />
                </div>
                
                <TradeSourceTable 
                    cards={filteredCollection} 
                    onAdd={handleAddToGive} 
                    buttonColorClass="text-danger" 
                    loading={loading}
                />
            </div>

            {/* DROITE : JE REÇOIS */}
            <div className="flex flex-col h-full bg-success/5 rounded-xl border border-success/20 overflow-hidden relative shadow-sm">
                
                <div className="flex-2 flex flex-col min-h-0 bg-surface">
                    <div className="flex justify-between items-center p-2 bg-success/10 border-b border-success/20">
                        <span className="text-xs font-bold text-success uppercase">À RECEVOIR ({toReceive.reduce((a,c)=>a+c.quantity,0)})</span>
                        <span className="text-sm font-bold text-success">{valReceive.toFixed(2)} €</span>
                    </div>
                    <TradeSelectionTable cards={toReceive} onRemove={(id) => setToReceive(p => p.filter((_, idx) => p[idx].id !== id || idx !== p.findIndex(x => x.id === id)))} colorClass="text-success" emptyLabel="Recherchez des cartes en bas..." />
                </div>

                <div className="p-3 flex-none border-t border-border bg-surface border-b">
                    <h2 className="font-bold text-muted text-xs uppercase tracking-wide mb-2">Recherche Scryfall</h2>
                    <form onSubmit={handleSearchScryfall} className="flex gap-2">
                        <input type="text" placeholder="Carte à recevoir..." className="grow p-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-success outline-none" value={remoteSearch} onChange={e => setRemoteSearch(e.target.value)} />
                        <button type="submit" className="bg-success hover:opacity-90 text-primary-foreground px-3 rounded-lg shadow-sm font-bold text-xs">GO</button>
                    </form>
                </div>

                <TradeSourceTable 
                    cards={uniqueSearchResults} 
                    onAdd={(item) => { 
                        if (!isCollectionCard(item)) setCardToPick(item); 
                    }} 
                    buttonColorClass="text-success" 
                    loading={isSearching}
                />
            </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 h-20 bg-surface border-t border-border flex justify-between items-center px-6 z-40 shadow-sm">
            <div className="hidden sm:block flex-1"></div>
            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Balance Estimée</span>
                <div className={`text-2xl font-black ${valGive - valReceive >= 0 ? 'text-success' : 'text-danger'}`}>
                    {valGive - valReceive > 0 ? '+' : ''}{(valGive - valReceive).toFixed(2)} €
                </div>
            </div>
            <div className="flex-1 flex justify-end">
                <button onClick={handleValidate} disabled={isPending || (toGive.length === 0 && toReceive.length === 0)} className="btn-primary px-6 py-3 disabled:opacity-50 text-sm">
                    {isPending ? 'Validation...' : 'Valider'}
                </button>
            </div>
        </div>

        <CardVersionPickerModal isOpen={!!cardToPick} baseCard={cardToPick} onClose={() => setCardToPick(null)} onConfirm={handleConfirmReceive} />
    </div>
  );
}