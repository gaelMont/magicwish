// app/trades/new/[uid]/page.tsx
'use client';

import { useState, use, useEffect, useMemo } from 'react'; // useTransition retiré
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeSystem } from '@/hooks/useTradeSystem';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import MagicCard from '@/components/MagicCard';
import Image from 'next/image'; // Import pour optimisation image

// --- TABLEAU DE SÉLECTION (Panier - Haut) ---
const TradeSelectionTable = ({ 
    cards, 
    onRemove, 
    onUpdatePrice, 
    onUpdateQuantity,
    getMaxQuantity,
    colorClass, 
    emptyLabel,
    onCardClick
}: { 
    cards: CardType[], 
    onRemove: (id: string) => void, 
    onUpdatePrice: (id: string, price: number) => void,
    onUpdateQuantity: (id: string, delta: number) => void,
    getMaxQuantity: (id: string) => number,
    colorClass: 'text-danger' | 'text-success',
    emptyLabel: string,
    onCardClick: (card: CardType) => void
}) => {
    if (cards.length === 0) return <div className="flex-1 flex items-center justify-center border-b border-border bg-secondary/10 text-muted text-sm italic p-8">{emptyLabel}</div>;

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-surface border-b border-border shadow-sm">
            <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-secondary text-muted sticky top-0 z-10 font-semibold uppercase">
                        <tr>
                            <th className="px-2 py-2 text-center w-24">Qté</th>
                            <th className="px-2 py-2">Nom</th>
                            <th className="px-2 py-2 w-10 text-center">Set</th>
                            <th className="px-2 py-2 w-10 text-center">Foil</th>
                            <th className="px-2 py-2 text-right w-16">Prix</th>
                            <th className="px-2 py-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {cards.map((card, i) => {
                            const currentPrice = card.customPrice !== undefined ? card.customPrice : (card.price || 0);
                            const maxQty = getMaxQuantity(card.id);
                            const isMaxReached = card.quantity >= maxQty;
                            const isMinReached = card.quantity <= 1;

                            return (
                                <tr 
                                    key={`${card.id}-${i}`} 
                                    className="hover:bg-secondary/50 transition-colors text-foreground select-none cursor-pointer"
                                    onClick={() => onCardClick(card)}
                                >
                                    <td className="px-2 py-1.5 text-center">
                                        <div className={`flex items-center justify-center gap-1 bg-background/50 rounded border border-border p-0.5 ${colorClass}`} onClick={e => e.stopPropagation()}>
                                            <button 
                                                onClick={() => onUpdateQuantity(card.id, -1)} 
                                                disabled={isMinReached}
                                                className="w-5 h-5 flex items-center justify-center bg-surface hover:bg-secondary rounded text-xs font-bold disabled:opacity-30 transition-colors border border-border"
                                            >
                                                -
                                            </button>
                                            <span className="font-mono font-bold w-8 text-center text-[10px]">
                                                {card.quantity}
                                                <span className="opacity-50 font-normal">/{maxQty}</span>
                                            </span>
                                            <button 
                                                onClick={() => onUpdateQuantity(card.id, 1)} 
                                                disabled={isMaxReached}
                                                className="w-5 h-5 flex items-center justify-center bg-surface hover:bg-secondary rounded text-xs font-bold disabled:opacity-30 transition-colors border border-border"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={card.name}>{card.name}</td>
                                    <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{card.setCode?.toUpperCase()}</span></td>
                                    <td className="px-2 py-1.5 text-center">{card.isFoil && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">Foil</span>}</td>
                                    <td className="px-2 py-1.5 text-right">
                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="number" min="0" step="0.01"
                                                className="w-14 p-1 text-right bg-background border border-border rounded text-xs outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={currentPrice}
                                                onChange={(e) => onUpdatePrice(card.id, parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="text-muted">€</span>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        <button onClick={(e) => { e.stopPropagation(); onRemove(card.id); }} className="text-muted hover:text-danger transition px-1 font-bold">✕</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- TABLEAU SOURCE (Recherche - Bas) ---
const TradeSourceTable = ({ cards, onAdd, buttonColorClass, loading }: { cards: CardType[], onAdd: (c: CardType) => void, buttonColorClass: 'text-danger' | 'text-success', loading?: boolean }) => {
    if (loading) return <p className="text-xs text-muted text-center py-4">Chargement...</p>;
    if (cards.length === 0) return null;
    
    return (
        <div className="overflow-y-auto custom-scrollbar bg-surface border-t border-border max-h-[300px]">
            <table className="w-full text-xs text-left border-collapse">
                <tbody className="divide-y divide-border">
                    {cards.map((item, i) => {
                        return (
                            <tr key={`${item.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground cursor-pointer group select-none" onClick={() => onAdd(item)}>
                                <td className="px-2 py-1.5 text-center text-muted font-mono">+</td>
                                <td className="px-2 py-1.5 font-medium truncate" title={item.name}>{item.name}</td>
                                <td className="px-2 py-1.5 text-center text-muted italic" colSpan={3}>
                                    Cliquez pour choisir une version
                                </td>
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

// --- MODALE DE SÉLECTION COLLECTION ---
const CollectionPickerModal = ({ 
    isOpen, 
    onClose, 
    cardName, 
    matchingCards, 
    onConfirm 
}: { 
    isOpen: boolean;
    onClose: () => void;
    cardName: string;
    matchingCards: CardType[];
    onConfirm: (card: CardType) => void;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/30">
                    <h3 className="font-bold text-lg text-foreground">Sélectionner une version</h3>
                    <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar space-y-2">
                    <p className="text-sm text-muted mb-2">Versions disponibles pour <strong>{cardName}</strong> :</p>
                    {matchingCards.length === 0 ? (
                        <p className="text-center text-muted italic">Aucune carte correspondante trouvée avec les filtres actuels.</p>
                    ) : (
                        <div className="grid gap-2">
                            {matchingCards.map(card => (
                                <div 
                                    key={card.id} 
                                    onClick={() => { onConfirm(card); onClose(); }}
                                    className="flex items-center gap-3 p-2 rounded-lg border border-border hover:border-primary cursor-pointer hover:bg-primary/5 transition-all group"
                                >
                                    <div className="w-10 h-14 bg-black/10 rounded overflow-hidden shrink-0 relative">
                                        {/* Utilisation de next/image pour l'optimisation */}
                                        <Image 
                                            src={card.imageUrl} 
                                            alt={card.name} 
                                            fill
                                            className="object-cover"
                                            sizes="40px" // Indique au navigateur que c'est une petite image
                                        />
                                    </div>
                                    <div className="grow">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-foreground">{card.name}</span>
                                            {card.isFoil && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 rounded border border-amber-200">Foil</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                                            <span className="bg-secondary px-1.5 rounded text-foreground border border-border font-mono">{card.setName}</span>
                                            <span>•</span>
                                            <span>Stock: <strong className="text-foreground">{card.quantity}</strong></span>
                                            {card.quantityForTrade !== undefined && (
                                                <span>(Trade: {card.quantityForTrade})</span>
                                            )}
                                        </div>
                                    </div>
                                    <button className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                        Choisir
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- PAGE PRINCIPALE ---

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
    
    // Privacy & Toggles
    const [partnerAllowsFull, setPartnerAllowsFull] = useState(false);
    const [showMyFull, setShowMyFull] = useState(false);
    const [showPartnerFull, setShowPartnerFull] = useState(false);

    // Modales & Preview
    const [previewCard, setPreviewCard] = useState<CardType | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerSource, setPickerSource] = useState<'me' | 'him'>('me');
    const [pickerName, setPickerName] = useState('');

    // Chargement infos partenaire (Nom + Settings Privacy)
    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const snap = await getDoc(doc(db, 'users', targetUid, 'public_profile', 'info'));
                if(snap.exists()) {
                    const data = snap.data();
                    setTargetName(data.displayName || data.username || 'L\'ami');
                    setPartnerAllowsFull(data.allowFullCollectionInTrade === true);
                }
            } catch(e) { console.error(e); }
        };
        if (targetUid) fetchInfo();
    }, [targetUid]);

    // Sécurité : Si le partenaire coupe l'accès, on désactive la vue full
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!partnerAllowsFull) setShowPartnerFull(false);
    }, [partnerAllowsFull]);

    // --- LOGIQUE FILTRAGE (Accessible collections) ---
    const accessibleMyCollection = useMemo(() => {
        if (showMyFull) return myCollection;
        return myCollection.filter(c => (c.quantityForTrade || 0) > 0);
    }, [myCollection, showMyFull]);

    const accessibleFriendCollection = useMemo(() => {
        if (showPartnerFull) return friendCollection;
        return friendCollection.filter(c => (c.quantityForTrade || 0) > 0);
    }, [friendCollection, showPartnerFull]);

    // --- LOGIQUE RECHERCHE (Noms Uniques) ---
    const mySearchResults = useMemo(() => {
        if (!searchMe.trim()) return [];
        const lower = searchMe.toLowerCase();
        const matches = accessibleMyCollection.filter(c => c.name.toLowerCase().includes(lower));
        const uniqueNames = Array.from(new Set(matches.map(c => c.name))).slice(0, 10);
        return uniqueNames.map(name => matches.find(c => c.name === name)!);
    }, [accessibleMyCollection, searchMe]);

    const friendSearchResults = useMemo(() => {
        if (!searchHim.trim()) return [];
        const lower = searchHim.toLowerCase();
        const matches = accessibleFriendCollection.filter(c => c.name.toLowerCase().includes(lower));
        const uniqueNames = Array.from(new Set(matches.map(c => c.name))).slice(0, 10);
        return uniqueNames.map(name => matches.find(c => c.name === name)!);
    }, [accessibleFriendCollection, searchHim]);

    // --- LOGIQUE PICKER (Contenu Modale) ---
    const matchingCardsForPicker = useMemo(() => {
        if (!pickerName) return [];
        const source = pickerSource === 'me' ? accessibleMyCollection : accessibleFriendCollection;
        return source.filter(c => c.name === pickerName);
    }, [pickerName, pickerSource, accessibleMyCollection, accessibleFriendCollection]);

    // --- ACTIONS ---

    // 1. Ouvrir le picker
    const openPicker = (card: CardType, source: 'me' | 'him') => {
        setPickerName(card.name);
        setPickerSource(source);
        setPickerOpen(true);
    };

    // 2. Confirmer ajout depuis picker
    const confirmAdd = (card: CardType) => {
        const isMe = pickerSource === 'me';
        const setTarget = isMe ? setToGive : setToReceive;
        const targetList = isMe ? toGive : toReceive;
        
        // Check existant
        const existing = targetList.find(c => c.id === card.id);
        
        // Check stock max
        const isFullView = isMe ? showMyFull : showPartnerFull;
        const maxStock = isFullView ? card.quantity : (card.quantityForTrade || 0);

        if (existing) {
            if (existing.quantity < maxStock) {
                setTarget(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
                toast.success("+1 ajouté");
            } else {
                toast.error("Stock max atteint");
            }
        } else {
            // Ajout nouvelle ligne
            setTarget(prev => [...prev, { ...card, quantity: 1, customPrice: card.price }]);
            toast.success("Carte ajoutée");
        }
        
        setPickerOpen(false);
        if (isMe) setSearchMe(''); else setSearchHim('');
    };

    // 3. Update Quantité (+/-)
    const handleUpdateQuantity = (cardId: string, delta: number, listType: 'give' | 'receive') => {
        const setTarget = listType === 'give' ? setToGive : setToReceive;
        const isMe = listType === 'give';

        setTarget(prev => prev.map(c => {
            if (c.id !== cardId) return c;
            const newQty = c.quantity + delta;
            
            if (newQty < 1) return c; // Pas de suppression, utiliser croix

            // Recalcul du max stock en direct
            const sourceCol = isMe ? accessibleMyCollection : accessibleFriendCollection;
            const sourceCard = sourceCol.find(sc => sc.id === cardId);
            // Si on ne trouve pas la carte source (cas rare de changement de filtre), on bloque pas forcément
            const max = sourceCard ? (isMe && showMyFull ? sourceCard.quantity : (sourceCard?.quantityForTrade || 0)) : 999;
            
            if (newQty > max) {
                toast.error("Stock maximum atteint");
                return c;
            }
            return { ...c, quantity: newQty };
        }));
    };
    
    // 4. Update Prix
    const handleUpdatePrice = (cardId: string, newPrice: number, listType: 'give' | 'receive') => {
        const setTarget = listType === 'give' ? setToGive : setToReceive;
        setTarget(prev => prev.map(c => c.id === cardId ? { ...c, customPrice: newPrice } : c));
    };

    // 5. Remove
    const handleRemoveCard = (cardId: string, listType: 'give' | 'receive') => {
        const setTarget = listType === 'give' ? setToGive : setToReceive;
        setTarget(prev => prev.filter(c => c.id !== cardId));
    };

    // 6. Helper pour le Max Quantity dans le tableau
    const getMaxStockDisplay = (cardId: string, isMe: boolean) => {
        const sourceCol = isMe ? myCollection : friendCollection;
        const isFull = isMe ? showMyFull : showPartnerFull;
        const c = sourceCol.find(x => x.id === cardId);
        if (!c) return 0;
        return isFull ? c.quantity : (c.quantityForTrade || 0);
    };

    // 7. Proposer
    const handlePropose = async () => {
        if (toGive.length === 0 && toReceive.length === 0) return;
        const success = await proposeTrade(targetUid, targetName, toGive, toReceive);
        if (success) router.push('/trades'); 
    };

    // Calculs Totaux
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
                
                {/* COLONNE GAUCHE (MOI) */}
                <div className="flex flex-col h-full bg-danger/5 rounded-xl border border-danger/20 overflow-hidden relative shadow-sm">
                    <div className="p-4 pb-0 flex-none space-y-2">
                        
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-danger">📤 Je donne</h2>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    className="w-3.5 h-3.5 text-danger rounded border-danger/30 focus:ring-danger accent-danger"
                                    checked={showMyFull}
                                    onChange={(e) => setShowMyFull(e.target.checked)}
                                />
                                <span className="text-[10px] font-semibold text-danger/80 hover:text-danger">
                                    Tout voir
                                </span>
                            </label>
                        </div>

                        <input 
                            type="text" 
                            placeholder="Filtrer ma collection..." 
                            className="w-full p-2 mb-2 rounded border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-danger/30 outline-none"
                            value={searchMe}
                            onChange={e => setSearchMe(e.target.value)}
                        />
                    </div>
                    
                    <TradeSelectionTable 
                        cards={toGive} 
                        onRemove={(id) => handleRemoveCard(id, 'give')} 
                        onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'give')}
                        onUpdateQuantity={(id, d) => handleUpdateQuantity(id, d, 'give')}
                        getMaxQuantity={(id) => getMaxStockDisplay(id, true)}
                        colorClass="text-danger" 
                        emptyLabel="Recherchez vos cartes ci-dessus..." 
                        onCardClick={setPreviewCard}
                    />

                    <div className="flex-none bg-danger/10 p-2 border-t border-danger/20 text-center">
                        <span className="text-xs text-danger font-bold uppercase">Total : {valGive.toFixed(2)} €</span>
                    </div>

                    {/* RÉSULTATS DE RECHERCHE (NOMS UNIQUES) */}
                    {searchMe && (
                        <TradeSourceTable 
                            cards={mySearchResults} 
                            onAdd={(c) => openPicker(c, 'me')} 
                            buttonColorClass="text-danger" 
                            loading={loadingMe} 
                        />
                    )}
                </div>

                {/* COLONNE DROITE (AMI) */}
                <div className="flex flex-col h-full bg-success/5 rounded-xl border border-success/20 overflow-hidden relative shadow-sm">
                    <div className="p-4 pb-0 flex-none space-y-2">
                        
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-success">Je reçois</h2>
                            
                            {partnerAllowsFull ? (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        className="w-3.5 h-3.5 text-success rounded border-success/30 focus:ring-success accent-success"
                                        checked={showPartnerFull}
                                        onChange={(e) => setShowPartnerFull(e.target.checked)}
                                    />
                                    <span className="text-[10px] font-semibold text-success/80 hover:text-success">
                                        Tout voir
                                    </span>
                                </label>
                            ) : (
                                <span className="text-[10px] text-muted italic flex items-center gap-1">
                                    Trade binder uniquement
                                </span>
                            )}
                        </div>

                        <input 
                            type="text" 
                            placeholder={`Filtrer chez ${targetName}...`}
                            className="w-full p-2 mb-2 rounded border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-success/30 outline-none"
                            value={searchHim}
                            onChange={e => setSearchHim(e.target.value)}
                        />
                    </div>

                    <TradeSelectionTable 
                        cards={toReceive} 
                        onRemove={(id) => handleRemoveCard(id, 'receive')} 
                        onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'receive')}
                        onUpdateQuantity={(id, d) => handleUpdateQuantity(id, d, 'receive')}
                        getMaxQuantity={(id) => getMaxStockDisplay(id, false)}
                        colorClass="text-success" 
                        emptyLabel={`Sélectionnez les cartes de ${targetName} en bas...`} 
                        onCardClick={setPreviewCard}
                    />

                    <div className="flex-none bg-success/10 p-2 border-t border-success/20 text-center">
                        <span className="text-xs text-success font-bold uppercase">Total : {valReceive.toFixed(2)} €</span>
                    </div>

                    {/* RÉSULTATS DE RECHERCHE (NOMS UNIQUES) */}
                    {searchHim && (
                        <TradeSourceTable 
                            cards={friendSearchResults} 
                            onAdd={(c) => openPicker(c, 'him')} 
                            buttonColorClass="text-success" 
                            loading={loadingHim} 
                        />
                    )}
                </div>
            </div>

            {/* FOOTER */}
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

            {/* MODALES */}
            
            {/* 1. Picker de Collection */}
            <CollectionPickerModal 
                isOpen={pickerOpen} 
                onClose={() => setPickerOpen(false)} 
                cardName={pickerName} 
                matchingCards={matchingCardsForPicker} 
                onConfirm={confirmAdd}
            />

            {/* 2. Prévisualisation */}
            {previewCard && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in cursor-pointer"
                    onClick={() => setPreviewCard(null)}
                >
                    <div className="relative transform transition-all scale-100 p-4" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setPreviewCard(null)} 
                            className="absolute -top-2 -right-2 bg-surface text-foreground rounded-full p-2 shadow-lg z-10 border border-border hover:bg-secondary transition-colors"
                        >
                            ✕
                        </button>
                        <div className="w-[300px] h-[420px] shadow-2xl rounded-xl overflow-hidden pointer-events-none">
                            <MagicCard {...previewCard} readOnly={true} quantity={previewCard.quantity} />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}