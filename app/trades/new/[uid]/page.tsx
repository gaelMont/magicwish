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

// --- TABLEAU DE SÉLECTION (PANIER) ---
const TradeSelectionTable = ({ cards, onRemove, colorClass, emptyLabel }: { cards: CardType[], onRemove: (id: string) => void, colorClass: 'text-danger' | 'text-success', emptyLabel: string }) => {
    if (cards.length === 0) return <div className="flex-1 flex items-center justify-center border-b border-border bg-secondary/10 text-muted text-sm italic p-8">{emptyLabel}</div>;
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

// --- TABLEAU DU BAS (CLASSEURS AMIS/MOI) ---
const TradeSourceTable = ({ 
    cards, 
    onAdd, 
    buttonColorClass,
    loading 
}: { 
    cards: CardType[], 
    onAdd: (c: CardType) => void, 
    buttonColorClass: 'text-danger' | 'text-success',
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
                            <tr key={`${card.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground cursor-pointer group" onClick={() => onAdd(card)}>
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
  const [isPending, startTransition] = useTransition();

  const { cards: myCollection, loading: loadingMe } = useCardCollection('collection');
  const { cards: friendCollection, loading: loadingHim } = useCardCollection('collection', 'default', targetUid);

  const [targetName, setTargetName] = useState('L\'ami');
  const [toGive, setToGive] = useState<CardType[]>([]);
  const [toReceive, setToReceive] = useState<CardType[]>([]);
  const [searchMe, setSearchMe] = useState('');
  const [searchHim, setSearchHim] = useState('');

  useEffect(() => {
    const fetchName = async () => {
        try {
            const snap = await getDoc(doc(db, 'users', targetUid, 'public_profile', 'info'));
            if(snap.exists()) setTargetName(snap.data().displayName || snap.data().username);
        } catch(e) { console.error(e); }
    };
    if (targetUid) fetchName();
  }, [targetUid]);

  const handleSelectCard = (card: CardType, listType: 'give' | 'receive') => {
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    const targetList = listType === 'give' ? toGive : toReceive;
    const existing = targetList.find(c => c.id === card.id);
    const maxStock = (card.quantityForTrade ?? 0); 
    const currentSelected = existing ? existing.quantity : 0;

    if (currentSelected < maxStock) {
        if (existing) {
            setTarget(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setTarget(prev => [...prev, { ...card, quantity: 1 }]);
        }
    } else {
        toast.error(`Stock maximum atteint (${maxStock}x)`);
    }
  };

  const handleRemoveCard = (cardId: string, listType: 'give' | 'receive') => {
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    setTarget(prev => prev.filter(c => c.id !== cardId));
  };

  const handlePropose = () => {
    if (toGive.length === 0 && toReceive.length === 0) return;
    startTransition(async () => {
        const success = await proposeTrade(targetUid, targetName, toGive, toReceive);
        if (success) router.push('/trades');
    });
  };

  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const balance = valGive - valReceive;

  const filteredMyCollection = useMemo(() => {
      return myCollection.filter(c => (c.quantityForTrade ?? 0) > 0 && c.name.toLowerCase().includes(searchMe.toLowerCase())).slice(0, 50);
  }, [myCollection, searchMe]);

  const filteredFriendCollection = useMemo(() => {
      return friendCollection.filter(c => (c.quantityForTrade ?? 0) > 0 && c.name.toLowerCase().includes(searchHim.toLowerCase())).slice(0, 50);
  }, [friendCollection, searchHim]);

  if (!user) return <div className="p-10 text-center text-muted">Connexion requise.</div>;

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col">
        
        <div className="flex-none flex items-center gap-4 mb-4">
            <button onClick={() => router.back()} className="text-muted hover:text-foreground bg-secondary px-3 py-1 rounded-lg text-sm transition">← Retour</button>
            <h1 className="text-2xl font-bold truncate text-foreground">Échange avec <span className="text-primary">{targetName}</span></h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 grow overflow-hidden pb-24">
            
            {/* GAUCHE : MOI */}
            <div className="flex flex-col h-full bg-danger/5 rounded-xl border border-danger/20 overflow-hidden relative shadow-sm">
                
                {/* 1. Sélection (Top) */}
                <div className="flex-2 flex flex-col min-h-0 bg-surface">
                    <div className="flex justify-between items-center p-2 bg-danger/10 border-b border-danger/20">
                        <span className="text-xs font-bold text-danger uppercase">JE DONNE ({toGive.reduce((a,c)=>a+c.quantity,0)})</span>
                        <span className="text-sm font-bold text-danger">{valGive.toFixed(2)} €</span>
                    </div>
                    <TradeSelectionTable cards={toGive} onRemove={(id) => handleRemoveCard(id, 'give')} colorClass="text-danger" emptyLabel="Sélectionnez vos cartes..." />
                </div>

                {/* 2. Recherche (Middle) */}
                <div className="p-3 flex-none border-t border-border bg-surface border-b">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="font-bold text-muted text-xs uppercase tracking-wide">Mon Classeur</h2>
                        <span className="text-[10px] bg-secondary text-muted px-2 py-0.5 rounded-full">{myCollection.filter(c => (c.quantityForTrade ?? 0) > 0).length} dispo</span>
                    </div>
                    <input type="text" placeholder="Filtrer ma collection..." className="w-full p-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-danger outline-none" value={searchMe} onChange={e => setSearchMe(e.target.value)} />
                </div>
                
                {/* 3. Résultats (Bottom) */}
                <TradeSourceTable cards={filteredMyCollection} onAdd={(c) => handleSelectCard(c, 'give')} buttonColorClass="text-danger" loading={loadingMe} />
            </div>

            {/* DROITE : AMI */}
            <div className="flex flex-col h-full bg-success/5 rounded-xl border border-success/20 overflow-hidden relative shadow-sm">
                
                {/* 1. Sélection (Top) */}
                <div className="flex-2 flex flex-col min-h-0 bg-surface">
                    <div className="flex justify-between items-center p-2 bg-success/10 border-b border-success/20">
                        <span className="text-xs font-bold text-success uppercase">JE REÇOIS ({toReceive.reduce((a,c)=>a+c.quantity,0)})</span>
                        <span className="text-sm font-bold text-success">{valReceive.toFixed(2)} €</span>
                    </div>
                    <TradeSelectionTable cards={toReceive} onRemove={(id) => handleRemoveCard(id, 'receive')} colorClass="text-success" emptyLabel={`Sélectionnez les cartes de ${targetName}...`} />
                </div>

                {/* 2. Recherche (Middle) */}
                <div className="p-3 flex-none border-t border-border bg-surface border-b">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="font-bold text-muted text-xs uppercase tracking-wide">Classeur de {targetName}</h2>
                        <span className="text-[10px] bg-secondary text-muted px-2 py-0.5 rounded-full">{friendCollection.filter(c => (c.quantityForTrade ?? 0) > 0).length} dispo</span>
                    </div>
                    <input type="text" placeholder={`Filtrer chez ${targetName}...`} className="w-full p-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-success outline-none" value={searchHim} onChange={e => setSearchHim(e.target.value)} />
                </div>

                {/* 3. Résultats (Bottom) */}
                <TradeSourceTable cards={filteredFriendCollection} onAdd={(c) => handleSelectCard(c, 'receive')} buttonColorClass="text-success" loading={loadingHim} />
            </div>
        </div>

        {/* FOOTER */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-surface border-t border-border flex justify-between items-center px-6 z-40 shadow-sm">
            <div className="flex-1 hidden sm:block"></div>
            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Balance Estimée</span>
                <div className={`text-2xl font-black ${balance >= 0 ? 'text-success' : 'text-danger'}`}>{balance > 0 ? '+' : ''}{balance.toFixed(2)} €</div>
            </div>
            <div className="flex-1 flex justify-end">
                <button onClick={handlePropose} disabled={toGive.length === 0 && toReceive.length === 0} className="btn-primary px-8 py-3 disabled:opacity-50 flex items-center gap-2">
                    {isPending ? 'Envoi...' : 'Proposer'}
                </button>
            </div>
        </div>
    </div>
  );
}