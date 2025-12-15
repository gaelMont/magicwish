// app/trades/new/[uid]/page.tsx
'use client';

import { useState, use, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeSystem } from '@/hooks/useTradeSystem';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// --- IMPORTS DES COMPOSANTS DÉCOUPÉS ---
import TradeSelectionTable from '@/components/trades/TradeSelectionTable';
import TradeSourceTable from '@/components/trades/TradeSourceTable';
// ---------------------------------------

export default function DirectTradePage({ params }: { params: Promise<{ uid: string }> }) {
  const unwrappedParams = use(params);
  const targetUid = unwrappedParams.uid;

  const { user } = useAuth();
  const router = useRouter();
  const { proposeTrade } = useTradeSystem();

  // --- CHARGEMENT ---
  const { cards: myCollection, loading: loadingMe } = useCardCollection('collection');
  const { cards: friendCollection, loading: loadingHim } = useCardCollection('collection', 'default', targetUid);

  // --- ÉTATS ---
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

  // --- ACTIONS ---
  
  // Fonction unifiée pour gérer l'ajout de cartes
  const handleSelectCard = (card: CardType, listType: 'give' | 'receive') => {
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    const targetList = listType === 'give' ? toGive : toReceive;
    const existing = targetList.find(c => c.id === card.id);
    
    // Pour la source : max est la quantité à l'échange
    const maxStock = (card.quantityForTrade ?? 0); 
    const currentSelected = existing ? existing.quantity : 0;

    if (currentSelected < maxStock) {
        if (existing) {
            setTarget(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            // Initialiser avec le prix Scryfall par défaut dans customPrice pour être modifiable
            setTarget(prev => [...prev, { ...card, quantity: 1, customPrice: card.price }]);
        }
    } else {
        toast.error("Stock maximum atteint");
    }
  };
  
  // Fonction pour mettre à jour le prix d'une carte sélectionnée
  const handleUpdatePrice = (cardId: string, newPrice: number, listType: 'give' | 'receive') => {
      const setTarget = listType === 'give' ? setToGive : setToReceive;
      setTarget(prev => prev.map(c => c.id === cardId ? { ...c, customPrice: newPrice } : c));
  };

  // Fonction pour retirer une carte sélectionnée
  const handleRemoveCard = (cardId: string, listType: 'give' | 'receive') => {
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    setTarget(prev => prev.filter(c => c.id !== cardId));
  };

  const handlePropose = async () => {
    if (toGive.length === 0 && toReceive.length === 0) return;
    const success = await proposeTrade(targetUid, targetName, toGive, toReceive);
    if (success) router.push('/trades'); 
  };

  // --- CALCULS ---
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const balance = valGive - valReceive;

  // Filtrage des cartes sources
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
            <button onClick={() => router.back()} className="text-muted hover:text-foreground bg-secondary px-3 py-1 rounded-lg text-sm">
                ← Retour
            </button>
            <h1 className="text-2xl font-bold truncate text-foreground">
                Échange avec <span className="text-primary">{targetName}</span>
            </h1>
        </div>

        {/* GRILLE PRINCIPALE */}
        <div className="grid lg:grid-cols-2 gap-6 grow overflow-hidden pb-24">
            
            {/* COLONNE GAUCHE (MOI) - JE DONNE */}
            <div className="flex flex-col h-full bg-danger/5 rounded-xl border border-danger/20 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                     <h2 className="font-bold text-danger mb-2">📤 Je donne (Ma Collection)</h2>
                     <input 
                        type="text" 
                        placeholder="Filtrer ma collection..." 
                        className="w-full p-2 mb-2 rounded border border-border bg-background text-foreground text-sm"
                        value={searchMe}
                        onChange={e => setSearchMe(e.target.value)}
                    />
                </div>
                
                {/* TABLE DES CARTES SÉLECTIONNÉES À DONNER */}
                <TradeSelectionTable 
                    cards={toGive} 
                    onRemove={(id) => handleRemoveCard(id, 'give')} 
                    onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'give')}
                    colorClass="text-danger" 
                    emptyLabel="Sélectionnez vos cartes en bas..." 
                />

                <div className="flex-none bg-danger/10 p-3 border-t border-danger/20 text-center">
                    <span className="text-xs text-danger font-bold uppercase">Total Donné</span>
                    <div className="text-xl font-bold text-danger">{valGive.toFixed(2)} €</div>
                </div>

                {/* TABLE DES CARTES DISPONIBLES DANS MA COLLECTION */}
                <TradeSourceTable 
                    cards={filteredMyCollection} 
                    onAdd={(c) => handleSelectCard(c, 'give')} 
                    buttonColorClass="text-danger" 
                    loading={loadingMe} 
                />
            </div>

            {/* COLONNE DROITE (AMI) - JE REÇOIS */}
            <div className="flex flex-col h-full bg-success/5 rounded-xl border border-success/20 overflow-hidden relative shadow-sm">
                <div className="p-4 pb-0 flex-none">
                    <h2 className="font-bold text-success mb-2">📥 Je reçois (Sa Collection)</h2>
                    <input 
                        type="text" 
                        placeholder={`Filtrer chez ${targetName}...`}
                        className="w-full p-2 mb-2 rounded border border-border bg-background text-foreground text-sm"
                        value={searchHim}
                        onChange={e => setSearchHim(e.target.value)}
                    />
                </div>

                {/* TABLE DES CARTES SÉLECTIONNÉES À RECEVOIR */}
                <TradeSelectionTable 
                    cards={toReceive} 
                    onRemove={(id) => handleRemoveCard(id, 'receive')} 
                    onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'receive')}
                    colorClass="text-success" 
                    emptyLabel={`Sélectionnez les cartes de ${targetName} en bas...`} 
                />

                <div className="flex-none bg-success/10 p-3 border-t border-success/20 text-center">
                    <span className="text-xs text-success font-bold uppercase">Total Reçu</span>
                    <div className="text-xl font-bold text-success">{valReceive.toFixed(2)} €</div>
                </div>

                {/* TABLE DES CARTES DISPONIBLES CHEZ L'AMI */}
                <TradeSourceTable 
                    cards={filteredFriendCollection} 
                    onAdd={(c) => handleSelectCard(c, 'receive')} 
                    buttonColorClass="text-success" 
                    loading={loadingHim} 
                />
            </div>
        </div>

        {/* FOOTER PRINCIPAL AVEC BALANCE CENTRÉE */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-surface border-t border-border flex items-center px-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            
            <div className="flex-1"></div>

            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-xs text-muted font-bold uppercase tracking-widest">Balance Estimée</span>
                <div className={`text-2xl font-black ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                </div>
            </div>

            <div className="flex-1 flex justify-end">
                <button 
                    onClick={handlePropose}
                    disabled={toGive.length === 0 && toReceive.length === 0}
                    className="bg-primary hover:opacity-90 text-primary-foreground px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg transform active:scale-95 flex items-center gap-2"
                >
                    Proposer
                </button>
            </div>
        </div>

    </div>
  );
}