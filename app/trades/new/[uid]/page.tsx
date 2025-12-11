// app/trades/new/[uid]/page.tsx
'use client';

import { useState, use, useEffect } from 'react';
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
    const maxStock = card.quantity;
    const currentSelected = existing ? existing.quantity : 0;

    if (currentSelected < maxStock) {
        if (existing) {
            setTarget(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setTarget(prev => [...prev, { ...card, quantity: 1 }]);
        }
    } else {
        toast.error("Stock maximum atteint");
    }
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

  // CALCULS
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const balance = valGive - valReceive;

  if (!user) return <div className="p-10 text-center">Connexion requise.</div>;

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
            
            {/* --- COLONNE GAUCHE (MOI) --- */}
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
                
                {/* LISTE DÉFILANTE UNIQUE (Sélectionnés en haut, Dispos en bas) */}
                <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                    
                    {/* SÉLECTIONNÉS */}
                    {toGive.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                            <div className="bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300">
                                SÉLECTION ({toGive.reduce((a,c)=>a+c.quantity,0)})
                            </div>
                            {toGive.map(card => (
                                <div key={card.id} className="flex justify-between items-center text-sm p-2 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <span className="truncate">{card.quantity}x {card.name}</span>
                                    <button onClick={() => handleRemoveCard(card.id, 'give')} className="text-red-500 hover:bg-red-50 rounded px-2">✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* DISPONIBLES */}
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mon Classeur d&apos;échange</p>
                        {loadingMe ? <p className="text-sm">Chargement...</p> : 
                            myCollection
                                .filter(c => c.isForTrade) // <--- FILTRE AJOUTÉ ICI
                                .filter(c => c.name.toLowerCase().includes(searchMe.toLowerCase()))
                                .slice(0, 50) 
                                .map(card => (
                                    <div key={card.id} onClick={() => handleSelectCard(card, 'give')} className="cursor-pointer bg-white dark:bg-gray-800/50 hover:bg-red-100 dark:hover:bg-red-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-red-200 transition shadow-sm group">
                                        <div className="w-8 h-11 bg-gray-200 rounded shrink-0 overflow-hidden relative">
                                            <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                            {card.isForTrade && <div className="absolute bottom-0 right-0 bg-green-500 text-white text-[8px] px-1">🤝</div>}
                                        </div>
                                        <div className="grow min-w-0">
                                            <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                            <p className="text-[10px] text-gray-500">{card.setName} - Dispo: {card.quantity}</p>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 group-hover:text-red-500 transition-colors shrink-0">+</span>
                                    </div>
                                ))
                        }
                    </div>
                </div>

                {/* TOTAL COLONNE GAUCHE (Fixe en bas de colonne) */}
                <div className="flex-none bg-red-50 dark:bg-red-900/20 p-3 border-t border-red-100 dark:border-red-900 text-center">
                    <span className="text-xs text-red-600 dark:text-red-400 font-bold uppercase">Total Donné</span>
                    <div className="text-xl font-bold text-red-700 dark:text-red-300">{valGive.toFixed(2)} €</div>
                </div>
            </div>

            {/* --- COLONNE DROITE (AMI) --- */}
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

                {/* LISTE DÉFILANTE UNIQUE */}
                <div className="grow overflow-y-auto custom-scrollbar p-4 pt-0 space-y-4">
                     {/* SÉLECTIONNÉS */}
                     {toReceive.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                            <div className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                                SÉLECTION ({toReceive.reduce((a,c)=>a+c.quantity,0)})
                            </div>
                            {toReceive.map(card => (
                                <div key={card.id} className="flex justify-between items-center text-sm p-2 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <span className="truncate">{card.quantity}x {card.name}</span>
                                    <button onClick={() => handleRemoveCard(card.id, 'receive')} className="text-red-500 hover:bg-red-50 rounded px-2">✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* DISPONIBLES */}
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Son Classeur d&apos;échange</p>
                        {loadingHim ? <p className="text-sm">Chargement...</p> : 
                            friendCollection
                                .filter(c => c.isForTrade) // FILTRE DÉJÀ PRÉSENT
                                .filter(c => c.name.toLowerCase().includes(searchHim.toLowerCase()))
                                .slice(0, 50)
                                .map(card => (
                                    <div key={card.id} onClick={() => handleSelectCard(card, 'receive')} className="cursor-pointer bg-white dark:bg-gray-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-blue-200 transition shadow-sm group">
                                        <div className="w-8 h-11 bg-gray-200 rounded shrink-0 overflow-hidden relative">
                                            <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                            <div className="absolute bottom-0 right-0 bg-green-500 text-white text-[8px] px-1">🤝</div>
                                        </div>
                                        <div className="grow min-w-0">
                                            <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                            <p className="text-[10px] text-gray-500">{card.setName} - Dispo: {card.quantity}</p>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 group-hover:text-blue-500 transition-colors shrink-0">+</span>
                                    </div>
                                ))
                        }
                    </div>
                </div>

                {/* TOTAL COLONNE DROITE (Fixe en bas de colonne) */}
                <div className="flex-none bg-blue-50 dark:bg-blue-900/20 p-3 border-t border-blue-100 dark:border-blue-900 text-center">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Total Reçu</span>
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{valReceive.toFixed(2)} €</div>
                </div>
            </div>
        </div>

        {/* FOOTER PRINCIPAL AVEC BALANCE CENTRÉE */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex items-center px-6 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            
            {/* Espace vide à gauche pour l'équilibre */}
            <div className="flex-1"></div>

            {/* BALANCE CENTRALE */}
            <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Valeur Résiduelle</span>
                <div className={`text-2xl font-black ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {balance > 0 ? '+' : ''}{balance.toFixed(2)} €
                </div>
            </div>

            {/* BOUTON D'ACTION À DROITE */}
            <div className="flex-1 flex justify-end">
                <button 
                    onClick={handlePropose}
                    disabled={toGive.length === 0 && toReceive.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg transform active:scale-95 flex items-center gap-2"
                >
                    <span>🚀</span> Proposer
                </button>
            </div>
        </div>

    </div>
  );
}