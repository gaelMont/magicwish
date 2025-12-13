// app/trades/new/[uid]/page.tsx
'use client';

import { useState, use, useEffect, useTransition } from 'react'; // Ajout de useTransition
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeSystem } from '@/hooks/useTradeSystem';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function DirectTradePage({ params }: { params: Promise<{ uid: string }> }) {
  const unwrappedParams = use(params);
  const targetUid = unwrappedParams.uid;

  const { user } = useAuth();
  const router = useRouter();
  const { proposeTrade } = useTradeSystem();
  const [isPending, startTransition] = useTransition(); // Ajout de useTransition pour le blocage

  // --- CHARGEMENT ---
  const { cards: myCollection, loading: loadingMe } = useCardCollection('collection');
  const { cards: friendCollection, loading: loadingHim } = useCardCollection('collection', 'default', targetUid);

  // --- ÉTATS ---
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

  // --- ACTIONS ---
  const handleSelectCard = (card: CardType, listType: 'give' | 'receive') => {
    const targetList = listType === 'give' ? toGive : toReceive;
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    const existing = targetList.find(c => c.id === card.id);
    
    // CORRECTION : On utilise quantityForTrade pour le stock Max
    const maxStock = listType === 'give' ? (card.quantityForTrade ?? 0) : card.quantity; 
    
    const currentSelected = existing ? existing.quantity : 0;

    if (currentSelected < maxStock) {
        if (existing) {
            setTarget(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setTarget(prev => [...prev, { ...card, quantity: 1 }]);
        }
    } else {
        toast.error(`Stock maximum à échanger atteint (${maxStock}x)`);
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

  // CALCULS
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const balance = valGive - valReceive;

  if (!user) return <div className="p-10 text-center text-muted">Connexion requise.</div>;

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col">
        
        {/* HEADER */}
        <div className="flex-none flex items-center gap-4 mb-4">
            <button onClick={() => router.back()} className="text-muted hover:text-foreground bg-secondary px-3 py-1 rounded-lg text-sm">
                ← Retour
            </button>
            <h1 className="text-2xl font-bold truncate text-foreground">
                Échange avec <span className="text-primary">{targetName}</span>
            </h1>
        </div>

        {/* GRILLE PRINCIPALE */}
        <div className="grid lg:grid-cols-2 gap-6 grow overflow-hidden pb-24">
            
            {/* --- COLONNE GAUCHE (MOI) --- */}
            <div className="flex flex-col h-full bg-danger/5 rounded-xl border border-danger/20 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                     <h2 className="font-bold text-danger mb-2">📤 Je donne (Ma Collection)</h2>
                     <input 
                        type="text" 
                        placeholder="Filtrer ma collection..." 
                        className="w-full p-2 mb-2 rounded border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-danger outline-none"
                        value={searchMe}
                        onChange={e => setSearchMe(e.target.value)}
                    />
                </div>
                
                {/* LISTE DÉFILANTE UNIQUE (Sélectionnés en haut, Dispos en bas) */}
                <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                    
                    {/* SÉLECTIONNÉS */}
                    {toGive.length > 0 && (
                        <div className="bg-surface rounded-lg border border-danger/30 overflow-hidden">
                            <div className="bg-danger/10 px-3 py-1 text-xs font-bold text-danger">
                                SÉLECTION ({toGive.reduce((a,c)=>a+c.quantity,0)})
                            </div>
                            {toGive.map(card => (
                                <div key={card.id} className="flex justify-between items-center text-sm p-2 border-b border-border last:border-0 hover:bg-secondary/50">
                                    <span className="truncate text-foreground">{card.quantity}x {card.name}</span>
                                    <button onClick={() => handleRemoveCard(card.id, 'give')} className="text-danger hover:bg-danger/10 rounded px-2">✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* DISPONIBLES */}
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Mon Classeur d&apos;échange</p>
                        {loadingMe ? <p className="text-sm text-muted">Chargement...</p> : 
                            myCollection
                                .filter(c => (c.quantityForTrade ?? 0) > 0) // CORRECTION : Filtre sur quantityForTrade
                                .filter(c => c.name.toLowerCase().includes(searchMe.toLowerCase()))
                                .slice(0, 50) 
                                .map(card => (
                                    <div key={card.id} onClick={() => handleSelectCard(card, 'give')} className="cursor-pointer bg-surface hover:bg-danger/10 p-2 rounded flex items-center gap-2 border border-transparent hover:border-danger/20 transition shadow-sm group">
                                        <div className="w-8 h-11 bg-secondary rounded shrink-0 overflow-hidden relative">
                                            <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                            {/* CORRECTION : Utilise quantityForTrade dans le badge */}
                                            <div className="absolute bottom-0 right-0 bg-success text-white text-[8px] px-1">
                                                🤝 {card.quantityForTrade}x
                                            </div>
                                        </div>
                                        <div className="grow min-w-0">
                                            <p className="font-bold text-xs truncate text-foreground">{card.name}</p>
                                            <p className="text-[10px] text-muted">{card.setName} - Dispo: {card.quantityForTrade ?? 0} ({card.quantity} total)</p>
                                        </div>
                                        <span className="text-xs font-bold text-muted group-hover:text-danger transition-colors shrink-0">+</span>
                                    </div>
                                ))
                        }
                    </div>
                </div>

                {/* TOTAL COLONNE GAUCHE (Fixe en bas de colonne) */}
                <div className="flex-none bg-danger/10 p-3 border-t border-danger/20 text-center">
                    <span className="text-xs text-danger font-bold uppercase">Total Donné</span>
                    <div className="text-xl font-bold text-danger">{valGive.toFixed(2)} €</div>
                </div>
            </div>

            {/* --- COLONNE DROITE (AMI) --- */}
            <div className="flex flex-col h-full bg-success/5 rounded-xl border border-success/20 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                    <h2 className="font-bold text-success mb-2">📥 Je reçois (Sa Collection)</h2>
                    <input 
                        type="text" 
                        placeholder={`Filtrer chez ${targetName}...`}
                        className="w-full p-2 mb-2 rounded border border-border bg-surface text-foreground text-sm focus:ring-2 focus:ring-success outline-none"
                        value={searchHim}
                        onChange={e => setSearchHim(e.target.value)}
                    />
                </div>

                {/* LISTE DÉFILANTE UNIQUE */}
                <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                     {/* SÉLECTIONNÉS */}
                     {toReceive.length > 0 && (
                        <div className="bg-surface rounded-lg border border-success/30 overflow-hidden">
                            <div className="bg-success/10 px-3 py-1 text-xs font-bold text-success">
                                SÉLECTION ({toReceive.reduce((a,c)=>a+c.quantity,0)})
                            </div>
                            {toReceive.map(card => (
                                <div key={card.id} className="flex justify-between items-center text-sm p-2 border-b border-border last:border-0 hover:bg-secondary/50">
                                    <span className="truncate text-foreground">{card.quantity}x {card.name}</span>
                                    <button onClick={() => handleRemoveCard(card.id, 'receive')} className="text-danger hover:bg-danger/10 rounded px-2">✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* DISPONIBLES */}
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Son Classeur d&apos;échange</p>
                        {loadingHim ? <p className="text-sm text-muted">Chargement...</p> : 
                            friendCollection
                                .filter(c => (c.quantityForTrade ?? 0) > 0) // CORRECTION : Filtre sur quantityForTrade
                                .filter(c => c.name.toLowerCase().includes(searchHim.toLowerCase()))
                                .slice(0, 50)
                                .map(card => (
                                    <div key={card.id} onClick={() => handleSelectCard(card, 'receive')} className="cursor-pointer bg-surface hover:bg-success/10 p-2 rounded flex items-center gap-2 border border-transparent hover:border-success/20 transition shadow-sm group">
                                        <div className="w-8 h-11 bg-secondary rounded shrink-0 overflow-hidden relative">
                                            <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                            {/* CORRECTION : Utilise quantityForTrade dans le badge */}
                                            <div className="absolute bottom-0 right-0 bg-success text-white text-[8px] px-1">
                                                🤝 {card.quantityForTrade}x
                                            </div>
                                        </div>
                                        <div className="grow min-w-0">
                                            <p className="font-bold text-xs truncate text-foreground">{card.name}</p>
                                            <p className="text-[10px] text-muted">{card.setName} - Dispo: {card.quantityForTrade ?? 0}</p>
                                        </div>
                                        <span className="text-xs font-bold text-muted group-hover:text-success transition-colors shrink-0">+</span>
                                    </div>
                                ))
                        }
                    </div>
                </div>

                {/* TOTAL COLONNE DROITE (Fixe en bas de colonne) */}
                <div className="flex-none bg-success/10 p-3 border-t border-success/20 text-center">
                    <span className="text-xs text-success font-bold uppercase">Total Reçu</span>
                    <div className="text-xl font-bold text-success">{valReceive.toFixed(2)} €</div>
                </div>
            </div>
        </div>

        {/* FOOTER PRINCIPAL AVEC BALANCE CENTRÉE */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-surface border-t border-border flex items-center px-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            
            {/* Espace vide à gauche pour l'équilibre */}
            <div className="flex-1"></div>

            {/* BALANCE CENTRALE */}
            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-xs text-muted font-bold uppercase tracking-widest">Valeur Résiduelle</span>
                <div className={`text-2xl font-black ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                </div>
            </div>

            {/* BOUTON D'ACTION À DROITE */}
            <div className="flex-1 flex justify-end">
                <button 
                    onClick={handlePropose}
                    disabled={isPending || (toGive.length === 0 && toReceive.length === 0)}
                    className="bg-primary hover:opacity-90 text-primary-foreground px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg transform active:scale-95 flex items-center gap-2"
                >
                    <span>🚀</span> {isPending ? 'Envoi...' : 'Proposer'}
                </button>
            </div>
        </div>

    </div>
  );
}