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
  // Récupération des paramètres (Next.js 15)
  const unwrappedParams = use(params);
  const targetUid = unwrappedParams.uid;

  const { user } = useAuth();
  const router = useRouter();
  const { proposeTrade } = useTradeSystem();

  // --- CHARGEMENT DES COLLECTIONS ---
  // 1. Ma Collection
  const { cards: myCollection, loading: loadingMe } = useCardCollection('collection');
  // 2. Collection de l'ami (on utilise le 3ème argument targetUid)
  const { cards: friendCollection, loading: loadingHim } = useCardCollection('collection', 'default', targetUid);

  // --- ÉTATS ---
  const [targetName, setTargetName] = useState('L\'ami');
  
  // Cartes sélectionnées pour l'échange
  const [toGive, setToGive] = useState<CardType[]>([]);
  const [toReceive, setToReceive] = useState<CardType[]>([]);

  // Filtres de recherche locaux
  const [searchMe, setSearchMe] = useState('');
  const [searchHim, setSearchHim] = useState('');

  // Récupérer le nom de l'ami pour l'affichage propre
  useEffect(() => {
    const fetchName = async () => {
        try {
            const snap = await getDoc(doc(db, 'users', targetUid, 'public_profile', 'info'));
            if(snap.exists()) setTargetName(snap.data().displayName || snap.data().username);
        } catch(e) { console.error(e); }
    };
    if (targetUid) fetchName();
  }, [targetUid]);

  // --- LOGIQUE DE SÉLECTION ---

  const handleSelectCard = (card: CardType, listType: 'give' | 'receive') => {
    const targetList = listType === 'give' ? toGive : toReceive;
    const setTarget = listType === 'give' ? setToGive : setToReceive;

    const existing = targetList.find(c => c.id === card.id);
    
    // On vérifie qu'on ne dépasse pas le stock disponible de la collection source
    const maxStock = card.quantity;
    const currentSelected = existing ? existing.quantity : 0;

    if (currentSelected < maxStock) {
        if (existing) {
            setTarget(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setTarget(prev => [...prev, { ...card, quantity: 1 }]);
        }
    } else {
        toast.error("Stock maximum atteint pour cette carte");
    }
  };

  const handleRemoveCard = (cardId: string, listType: 'give' | 'receive') => {
    const setTarget = listType === 'give' ? setToGive : setToReceive;
    setTarget(prev => prev.filter(c => c.id !== cardId));
  };

  // --- VALIDATION ---
  const handlePropose = async () => {
    if (toGive.length === 0 && toReceive.length === 0) return;
    
    // On lance la proposition d'échange
    const success = await proposeTrade(targetUid, targetName, toGive, toReceive);
    if (success) {
        router.push('/trades'); // Redirection vers le centre d'échanges après succès
    }
  };

  // Calculs totaux (Valeurs estimées)
  const valGive = toGive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);
  const valReceive = toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);

  if (!user) return <div className="p-10 text-center">Connexion requise.</div>;

  return (
    <div className="container mx-auto p-4 min-h-screen pb-24">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 bg-gray-100 px-3 py-1 rounded-lg text-sm">
                ← Retour
            </button>
            <h1 className="text-2xl font-bold">
                Échange avec <span className="text-blue-600">{targetName}</span>
            </h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
            
            {/* --- COLONNE GAUCHE : CE QUE JE DONNE --- */}
            <div className="flex flex-col bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900 p-4">
                <h2 className="font-bold text-red-600 mb-2">📤 Je donne (Ma Collection)</h2>
                
                {/* 1. Liste des cartes SÉLECTIONNÉES */}
                <div className="flex-none mb-4 space-y-2 min-h-[100px] bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[25vh]">
                    {toGive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Rien sélectionné</p>}
                    {toGive.map(card => (
                        <div key={card.id} className="flex justify-between items-center text-sm p-1 border-b dark:border-gray-700">
                            <span>{card.quantity}x {card.name} <span className="text-gray-400 text-xs">({card.setName})</span></span>
                            <button onClick={() => handleRemoveCard(card.id, 'give')} className="text-red-500 font-bold px-2">✕</button>
                        </div>
                    ))}
                </div>

                {/* 2. Filtre Recherche locale */}
                <input 
                    type="text" 
                    placeholder="Filtrer ma collection..." 
                    className="w-full p-2 mb-2 rounded border dark:bg-gray-800 dark:text-white"
                    value={searchMe}
                    onChange={e => setSearchMe(e.target.value)}
                />

                {/* 3. Liste DISPONIBLE (Source) */}
                <div className="grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {loadingMe ? <p>Chargement...</p> : 
                        myCollection
                            .filter(c => c.name.toLowerCase().includes(searchMe.toLowerCase()))
                            .slice(0, 50) // Limite d'affichage pour éviter le lag
                            .map(card => (
                                <div key={card.id} onClick={() => handleSelectCard(card, 'give')} className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-red-200 transition">
                                    <div className="w-8 h-11 bg-gray-200 rounded shrink-0 overflow-hidden">
                                        <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="grow min-w-0">
                                        <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                        <p className="text-[10px] text-gray-500">{card.setName} - Dispo: {card.quantity}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400">+</span>
                                </div>
                            ))
                    }
                </div>
            </div>

            {/* --- COLONNE DROITE : CE QUE JE VEUX (SA COLLECTION) --- */}
            <div className="flex flex-col bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900 p-4">
                <h2 className="font-bold text-blue-600 mb-2">📥 Je reçois (Sa Collection)</h2>

                {/* 1. Liste des cartes SÉLECTIONNÉES */}
                <div className="flex-none mb-4 space-y-2 min-h-[100px] bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[25vh]">
                    {toReceive.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Rien sélectionné</p>}
                    {toReceive.map(card => (
                        <div key={card.id} className="flex justify-between items-center text-sm p-1 border-b dark:border-gray-700">
                            <span>{card.quantity}x {card.name} <span className="text-gray-400 text-xs">({card.setName})</span></span>
                            <button onClick={() => handleRemoveCard(card.id, 'receive')} className="text-red-500 font-bold px-2">✕</button>
                        </div>
                    ))}
                </div>

                {/* 2. Filtre Recherche locale (chez l'ami) */}
                <input 
                    type="text" 
                    placeholder={`Filtrer la collection de ${targetName}...`}
                    className="w-full p-2 mb-2 rounded border dark:bg-gray-800 dark:text-white"
                    value={searchHim}
                    onChange={e => setSearchHim(e.target.value)}
                />

                {/* 3. Liste DISPONIBLE (Source Ami) */}
                <div className="grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {loadingHim ? <p>Chargement...</p> : 
                        friendCollection
                            .filter(c => c.name.toLowerCase().includes(searchHim.toLowerCase()))
                            .slice(0, 50)
                            .map(card => (
                                <div key={card.id} onClick={() => handleSelectCard(card, 'receive')} className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 p-2 rounded flex items-center gap-2 border border-transparent hover:border-blue-200 transition">
                                    <div className="w-8 h-11 bg-gray-200 rounded shrink-0 overflow-hidden">
                                        <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="grow min-w-0">
                                        <p className="font-bold text-xs truncate dark:text-gray-200">{card.name}</p>
                                        <p className="text-[10px] text-gray-500">{card.setName} - Dispo: {card.quantity}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400">+</span>
                                </div>
                            ))
                    }
                </div>
            </div>

        </div>

        {/* --- FOOTER DE VALIDATION --- */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 flex justify-between items-center z-40 shadow-2xl">
            <div className="flex gap-4 text-sm">
                <div>Donne: <span className="font-bold">{valGive.toFixed(2)}€</span></div>
                <div>Reçoit: <span className="font-bold">{valReceive.toFixed(2)}€</span></div>
            </div>
            <button 
                onClick={handlePropose}
                disabled={toGive.length === 0 && toReceive.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg flex items-center gap-2"
            >
                <span>🚀</span> Proposer l&apos;échange
            </button>
        </div>

    </div>
  );
}