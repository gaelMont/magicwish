// app/trades/manual/page.tsx
'use client';

import { useState, useMemo, useTransition } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { executeManualTrade } from '@/app/actions/trade'; 
import toast from 'react-hot-toast';
import CardVersionPickerModal from '@/components/CardVersionPickerModal';
import { ScryfallRawData } from '@/lib/cardUtils';

// Interface stricte des données de carte sérialisables pour le serveur (basée sur CardSchema)
interface ServerCardPayload {
    id: string;
    name: string;
    imageUrl: string;
    imageBackUrl: string | null;
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

// Fonction utilitaire pour convertir les CardType du client vers le format attendu par le serveur
const mapCardsForServer = (cards: CardType[]): ServerCardPayload[] => {
    return cards.map(c => {
        const payload: ServerCardPayload = {
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl,
            imageBackUrl: c.imageBackUrl || null,
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
        
        if (payload.customPrice === undefined) delete payload.customPrice;

        return payload;
    });
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

  const handleAddToGive = (card: CardType) => {
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

  const handleSearchResultClick = (scryfallCard: ScryfallRawData) => {
    setCardToPick(scryfallCard);
  };

  const handleConfirmReceive = (card: CardType) => {
      // Pour l'ajout libre, l'ID peut ne pas être la version exacte, on ajoute simplement la quantité.
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
      
      setSearchResults([]); 
      setRemoteSearch("");
      toast.success(`Ajouté : ${card.name}`);
  };

  // --- LOGIQUE DE VALIDATION SÉCURISÉE ---
  const handleValidate = async () => {
      if (!user) return;
      if (toGive.length === 0 && toReceive.length === 0) return;
      if (!confirm("Confirmer cet échange ? Vos cartes données seront retirées de votre collection.")) return;

      const toastId = toast.loading("Validation sécurisée...");

      startTransition(async () => {
        // Nettoyer les cartes ici avant de les envoyer au serveur
        const cleanToGive = mapCardsForServer(toGive);
        const cleanToReceive = mapCardsForServer(toReceive);

        // Appel du serveur, la réponse est typée (success: boolean, error?: string)
        const result = await executeManualTrade(user.uid, cleanToGive, cleanToReceive) as { 
            success: boolean; 
            error?: string; 
        };
        
        if (result.success) {
            toast.success("Echange validé !", { id: toastId });
            setToGive([]);
            setToReceive([]);
            setLocalSearch("");
        } else {
            toast.error(result.error || "Erreur lors de l'échange", { id: toastId });
        }
      });
  };

  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.price || 0) * c.quantity, 0);

  const uniqueSearchResults = useMemo(() => {
    const seen = new Set();
    return searchResults.filter(card => {
      const rawName = card.name || "";
      const name = rawName.split(' // ')[0];
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [searchResults]);

  if (!user) return <div className="p-10 text-center text-muted">Connectez-vous.</div>;

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col">
        
        <h1 className="text-2xl font-bold mb-4 flex-none flex items-center gap-2 text-foreground">
            Échange Manuel / Externe
        </h1>

        <div className="grid lg:grid-cols-2 gap-6 grow overflow-hidden pb-24">
            
            {/* COLONNE GAUCHE : JE DONNE */}
            <div className="flex flex-col h-full bg-danger/5 rounded-xl border border-danger/20 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                    <h2 className="font-bold text-danger mb-2">Je donne (De ma collection)</h2>
                    <input 
                        type="text" 
                        placeholder="Chercher dans ma collection..." 
                        className="w-full p-2 mb-2 rounded border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-danger outline-none"
                        value={localSearch}
                        onChange={e => setLocalSearch(e.target.value)}
                    />
                </div>
                
                 <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                    {/* Liste des cartes sélectionnées */}
                    {toGive.length > 0 && (
                        <div className="bg-surface rounded-lg border border-danger/30 overflow-hidden">
                            <div className="bg-danger/10 px-3 py-1 text-xs font-bold text-danger">
                                SÉLECTION ({toGive.reduce((a,c)=>a+c.quantity,0)})
                            </div>
                            {toGive.map(card => (
                                <div key={card.id} className="flex justify-between items-center text-sm p-2 border-b border-border last:border-0 hover:bg-secondary/50">
                                    <span className="truncate text-foreground">{card.quantity}x {card.name}</span>
                                    <button onClick={() => setToGive(p => p.filter(c => c.id !== card.id))} className="text-danger hover:bg-danger/10 rounded px-1">X</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Liste de la collection */}
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Ma Collection</p>
                        {loading ? <p className="text-sm text-muted">Chargement...</p> : 
                            myCollection
                                .filter(c => c.name.toLowerCase().includes(localSearch.toLowerCase()))
                                .slice(0, 50)
                                .map(card => (
                                    <div key={card.id} onClick={() => handleAddToGive(card)} className="cursor-pointer bg-surface hover:bg-danger/10 p-2 rounded flex items-center gap-2 border border-transparent hover:border-danger/30 transition shadow-sm group">
                                        <div className="w-8 h-11 bg-secondary rounded shrink-0 overflow-hidden">
                                            <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="grow min-w-0">
                                            <p className="font-bold text-xs truncate text-foreground">{card.name}</p>
                                            <p className="text-[10px] text-muted">{card.setName} - Stock: {card.quantity}</p>
                                        </div>
                                        <span className="text-xs font-bold text-muted group-hover:text-danger shrink-0">+</span>
                                    </div>
                                ))
                        }
                    </div>
                </div>

                <div className="flex-none bg-danger/10 p-3 border-t border-danger/20 text-center">
                    <span className="text-xs text-danger font-bold uppercase">Total Donné</span>
                    <div className="text-xl font-bold text-danger">{valGive.toFixed(2)} EUR</div>
                </div>
            </div>

            {/* COLONNE DROITE : JE REÇOIS */}
            <div className="flex flex-col h-full bg-success/5 rounded-xl border border-success/20 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                    <h2 className="font-bold text-success mb-2">Je reçois (Ajout libre)</h2>
                    <form onSubmit={handleSearchScryfall} className="flex gap-2 mb-2">
                        <input 
                            type="text" 
                            placeholder="Rechercher carte à recevoir..." 
                            className="grow p-2 rounded border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-success outline-none"
                            value={remoteSearch}
                            onChange={e => setRemoteSearch(e.target.value)}
                        />
                        <button type="submit" className="bg-success hover:bg-green-600 text-white px-3 rounded shadow-sm">V</button>
                    </form>
                </div>

                 <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                    
                    {toReceive.length > 0 && (
                        <div className="bg-surface rounded-lg border border-success/30 overflow-hidden">
                            <div className="bg-success/10 px-3 py-1 text-xs font-bold text-success">
                                SÉLECTION ({toReceive.reduce((a,c)=>a+c.quantity,0)})
                            </div>
                            {toReceive.map((card, idx) => (
                                <div key={`${card.id}-${idx}`} className="flex justify-between items-center text-sm p-2 border-b border-border last:border-0 hover:bg-secondary/50">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="font-bold shrink-0 text-foreground">{card.quantity}x</span>
                                        <div className="flex flex-col truncate">
                                            <span className="text-foreground truncate">{card.name}</span>
                                            <span className="text-[10px] text-muted truncate">
                                                {card.setName} {card.isFoil && 'Foil'}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => setToReceive(p => p.filter((_, i) => i !== idx))} className="text-danger hover:bg-danger/10 rounded px-1 ml-2">X</button>
                                </div>
                            ))}
                        </div>
                    )}

                     <div className="space-y-1">
                        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Résultats Scryfall</p>
                        {isSearching && <p className="text-xs text-center py-4 text-muted">Recherche...</p>}
                        
                        {uniqueSearchResults.map(card => (
                            <div key={card.id} onClick={() => handleSearchResultClick(card)} className="cursor-pointer bg-surface hover:bg-success/10 p-2 rounded flex items-center gap-2 border border-transparent hover:border-success/30 transition shadow-sm group">
                                 <div className="w-8 h-11 bg-secondary rounded overflow-hidden shrink-0">
                                    {card.image_uris?.small && <img src={card.image_uris.small} className="w-full h-full object-cover" alt="" />}
                                 </div>
                                 <div className="grow min-w-0">
                                    <p className="font-bold text-xs truncate text-foreground">{card.name}</p>
                                    <p className="text-[10px] text-muted italic">Sélectionner version...</p>
                                 </div>
                                 <span className="text-xs font-bold text-muted group-hover:text-success shrink-0">Choisir</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-none bg-success/10 p-3 border-t border-success/20 text-center">
                    <span className="text-xs text-success font-bold uppercase">Total Reçu</span>
                    <div className="text-xl font-bold text-success">{valReceive.toFixed(2)} EUR</div>
                </div>
            </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 h-20 bg-surface border-t border-border flex justify-between items-center px-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            
            <div className="flex-1"></div>

            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-xs text-muted font-bold uppercase tracking-widest">Balance</span>
                <div className={`text-2xl font-black ${valGive - valReceive >= 0 ? 'text-success' : 'text-danger'}`}>
                    {valGive - valReceive > 0 ? '+' : ''}{(valGive - valReceive).toFixed(2)} EUR
                </div>
            </div>

            <div className="flex-1 flex justify-end">
                <button 
                    onClick={handleValidate}
                    disabled={isPending || (toGive.length === 0 && toReceive.length === 0)}
                    className="bg-primary hover:opacity-90 text-primary-foreground px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg transform active:scale-95"
                >
                    {isPending ? 'Validation...' : 'Valider l\'échange'}
                </button>
            </div>
        </div>

        <CardVersionPickerModal 
            isOpen={!!cardToPick}
            baseCard={cardToPick}
            onClose={() => setCardToPick(null)}
            onConfirm={handleConfirmReceive}
        />

    </div>
  );
}