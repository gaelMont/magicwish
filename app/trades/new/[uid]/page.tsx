// app/trades/new/[uid]/page.tsx
'use client';

import { useState, use, useEffect, useTransition, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeSystem } from '@/hooks/useTradeSystem';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ScryfallRawData } from '@/lib/cardUtils';

// --- TABLEAU DE SÉLECTION MODIFIABLE (AVEC PRIX) ---
const TradeSelectionTable = ({ 
    cards, 
    onRemove, 
    onUpdatePrice, 
    colorClass, 
    emptyLabel 
}: { 
    cards: CardType[], 
    onRemove: (id: string) => void, 
    onUpdatePrice: (id: string, newPrice: number) => void,
    colorClass: 'text-danger' | 'text-success', 
    emptyLabel: string 
}) => {
    if (cards.length === 0) return <div className="flex-1 flex items-center justify-center border-b border-border bg-secondary/10 text-muted text-sm italic p-8">{emptyLabel}</div>;
    
    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-surface border-b border-border shadow-sm">
            <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-secondary text-muted sticky top-0 z-10 font-semibold uppercase">
                        <tr>
                            <th className="px-2 py-2 text-center w-10">Qté</th>
                            <th className="px-2 py-2">Nom</th>
                            <th className="px-2 py-2 w-10 text-center">Set</th>
                            <th className="px-2 py-2 w-10 text-center">Foil</th>
                            <th className="px-2 py-2 text-right w-20">Prix/u</th>
                            <th className="px-2 py-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {cards.map((card, i) => {
                            const currentPrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);
                            const scryData = card.scryfallData as ScryfallRawData | undefined;
                            
                            return (
                                <tr key={`${card.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground">
                                    <td className={`px-2 py-1.5 text-center font-bold ${colorClass} bg-opacity-10`}>{card.quantity}</td>
                                    <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={card.name}>{card.name}</td>
                                    <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{card.setCode?.toUpperCase()}</span></td>
                                    <td className="px-2 py-1.5 text-center">{card.isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">Foil</span>}</td>
                                    
                                    {/* INPUT PRIX */}
                                    <td className="px-2 py-1.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <input 
                                                type="number" 
                                                min="0" 
                                                step="0.01"
                                                className="w-16 p-1 text-right bg-background border border-border rounded text-xs outline-none focus:border-primary"
                                                value={currentPrice}
                                                onChange={(e) => onUpdatePrice(card.id, parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="text-muted">€</span>
                                        </div>
                                    </td>
                                    
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

// --- TABLEAU DU BAS (CLASSEURS AMIS/MOI) ---
const TradeSourceTable = ({ 
    cards, 
    onAdd, 
    buttonColorClass,
    loading 
}: { 
    cards: CardType[], 
    onAdd: (c: CardType) => void, 
    buttonColorClass: 'text-danger' | 'text-success' | 'text-blue-600',
    loading?: boolean
}) => {
    if (loading) return <p className="text-xs text-muted text-center py-4">Chargement...</p>;
    if (cards.length === 0) return <p className="text-xs text-muted text-center py-4">Aucune carte trouvée.</p>;

    return (
        <div className="overflow-y-auto custom-scrollbar flex-1 bg-surface">
            <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-background text-muted sticky top-0 z-10 font-semibold uppercase">
                    <tr>
                        <th className="px-2 py-2 text-center w-10">Dispo</th>
                        <th className="px-2 py-2">Nom</th>
                        <th className="px-2 py-2 w-12 text-center">Set</th>
                        <th className="px-2 py-2 w-10 text-center">N°</th>
                        <th className="px-2 py-2 w-10 text-center">Foil</th>
                        <th className="px-2 py-2 w-8"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {cards.map((card, i) => {
                        const scryData = card.scryfallData as ScryfallRawData | undefined;
                        const collectorNum = scryData?.collector_number || '?';
                        const tradeQty = card.quantityForTrade ?? 0;
                        return (
                            // AJOUT DE select-none ICI
                            <tr key={`${card.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground cursor-pointer group select-none" onClick={() => onAdd(card)}>
                                <td className="px-2 py-1.5 text-center text-muted font-mono">{tradeQty}</td>
                                <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={card.name}>{card.name}</td>
                                <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{card.setCode?.toUpperCase()}</span></td>
                                <td className="px-2 py-1.5 text-center text-muted font-mono text-[10px]">{collectorNum}</td>
                                <td className="px-2 py-1.5 text-center">{card.isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">Foil</span>}</td>
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

export default function DirectTradePage({ params }: { params: Promise<{ uid: string }> }) {
  const unwrappedParams = use(params);
  const targetUid = unwrappedParams.uid;

  const { user } = useAuth();
  const router = useRouter();
  const { proposeTrade } = useTradeSystem();
  
  // États
  const { cards: myCollection, loading: loadingMe } = useCardCollection('collection');
  const { cards: friendCollection, loading: loadingHim } = useCardCollection('collection', 'default', targetUid);

  const [targetName, setTargetName] = useState('L\'ami');
  const [toGive, setToGive] = useState<CardType[]>([]);
  const [toReceive, setToReceive] = useState<CardType[]>([]);
  const [searchMe, setSearchMe] = useState('');
  const [searchHim, setSearchHim] = useState('');

  // Chargement du nom de l'ami
  useEffect(() => {
    const fetchName = async () => {
        try {
            const snap = await getDoc(doc(db, 'users', targetUid, 'public_profile', 'info'));
            if(snap.exists()) setTargetName(snap.data().displayName || snap.data().username);
        } catch(e) { console.error(e); }
    };
    if (targetUid) fetchName();
  }, [targetUid]);

  // Actions
  const handleSelectCard = (card: CardType, listType: 'give' | 'receive') => {
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    const targetList = listType === 'give' ? toGive : toReceive;
    const existing = targetList.find(c => c.id === card.id);
    const maxStock = (card.quantityForTrade ?? 0); 

    if (existing) {
        if (existing.quantity < maxStock) {
            setTarget(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            toast.error("Stock maximum atteint");
        }
    } else {
        // Initialiser avec le prix Scryfall par défaut dans customPrice pour être modifiable
        setTarget(prev => [...prev, { ...card, quantity: 1, customPrice: card.price }]);
    }
  };

  const handleUpdatePrice = (cardId: string, newPrice: number, listType: 'give' | 'receive') => {
      const setTarget = listType === 'give' ? setToGive : setToReceive;
      setTarget(prev => prev.map(c => c.id === cardId ? { ...c, customPrice: newPrice } : c));
  };

  const handleRemoveCard = (cardId: string, listType: 'give' | 'receive') => {
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    setTarget(prev => prev.filter(c => c.id !== cardId));
  };

  const handlePropose = async () => {
    if (toGive.length === 0 && toReceive.length === 0) return;
    const success = await proposeTrade(targetUid, targetName, toGive, toReceive);
    if (success) router.push('/trades'); 
  };

  // Calculs
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const balance = valGive - valReceive;

  // Filtrage
  const filteredMyCollection = useMemo(() => {
      return myCollection
        .filter(c => (c.quantityForTrade ?? 0) > 0 && c.name.toLowerCase().includes(searchMe.toLowerCase()))
        .slice(0, 50);
  }, [myCollection, searchMe]);

  const filteredFriendCollection = useMemo(() => {
      return friendCollection
        .filter(c => (c.quantityForTrade ?? 0) > 0 && c.name.toLowerCase().includes(searchHim.toLowerCase()))
        .slice(0, 50);
  }, [friendCollection, searchHim]);

  if (!user) return <div className="p-10 text-center text-muted">Connexion requise.</div>;

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col">
        
        {/* HEADER */}
        <div className="flex-none flex items-center gap-4 mb-4">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 bg-gray-100 px-3 py-1 rounded-lg text-sm">
                ← Retour
            </button>
            <h1 className="text-2xl font-bold truncate">
                Échange avec <span className="text-blue-600">{targetName}</span>
            </h1>
        </div>

        {/* GRILLE PRINCIPALE */}
        <div className="grid lg:grid-cols-2 gap-6 grow overflow-hidden pb-24">
            
            {/* COLONNE GAUCHE (MOI) */}
            <div className="flex flex-col h-full bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                     <h2 className="font-bold text-red-600 mb-2">📤 Je donne (Ma Collection)</h2>
                     <input 
                        type="text" 
                        placeholder="Filtrer ma collection..." 
                        className="w-full p-2 mb-2 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-600 text-sm"
                        value={searchMe}
                        onChange={e => setSearchMe(e.target.value)}
                    />
                </div>
                
                <TradeSelectionTable 
                    cards={toGive} 
                    onRemove={(id) => handleRemoveCard(id, 'give')} 
                    onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'give')}
                    colorClass="text-danger" 
                    emptyLabel="Sélectionnez vos cartes..." 
                />

                <div className="flex-none bg-red-50 dark:bg-red-900/20 p-3 border-t border-red-100 dark:border-red-900 text-center">
                    <span className="text-xs text-red-600 dark:text-red-400 font-bold uppercase">Total Donné</span>
                    <div className="text-xl font-bold text-red-700 dark:text-red-300">{valGive.toFixed(2)} €</div>
                </div>

                <TradeSourceTable 
                    cards={filteredMyCollection} 
                    onAdd={(c) => handleSelectCard(c, 'give')} 
                    buttonColorClass="text-danger" 
                    loading={loadingMe} 
                />
            </div>

            {/* COLONNE DROITE (AMI) */}
            <div className="flex flex-col h-full bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                    <h2 className="font-bold text-blue-600 mb-2">📥 Je reçois (Sa Collection)</h2>
                    <input 
                        type="text" 
                        placeholder={`Filtrer chez ${targetName}...`}
                        className="w-full p-2 mb-2 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-600 text-sm"
                        value={searchHim}
                        onChange={e => setSearchHim(e.target.value)}
                    />
                </div>

                <TradeSelectionTable 
                    cards={toReceive} 
                    onRemove={(id) => handleRemoveCard(id, 'receive')} 
                    onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'receive')}
                    colorClass="text-success" 
                    emptyLabel="Sélectionnez les cartes de l'ami..." 
                />

                <div className="flex-none bg-blue-50 dark:bg-blue-900/20 p-3 border-t border-blue-100 dark:border-blue-900 text-center">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Total Reçu</span>
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{valReceive.toFixed(2)} €</div>
                </div>

                <TradeSourceTable 
                    cards={filteredFriendCollection} 
                    onAdd={(c) => handleSelectCard(c, 'receive')} 
                    buttonColorClass="text-blue-600" 
                    loading={loadingHim} 
                />
            </div>
        </div>

        {/* FOOTER */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex items-center px-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex-1"></div>
            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Balance Estimée</span>
                <div className={`text-2xl font-black ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                </div>
            </div>
            <div className="flex-1 flex justify-end">
                <button 
                    onClick={handlePropose}
                    disabled={toGive.length === 0 && toReceive.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg transform active:scale-95"
                >
                    Proposer
                </button>
            </div>
        </div>

    </div>
  );
}