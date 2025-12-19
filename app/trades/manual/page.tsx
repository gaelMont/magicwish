'use client';

import { useState, useMemo, useTransition } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { executeManualTrade } from '@/app/actions/trade'; 
import toast from 'react-hot-toast';
import CardVersionPickerModal from '@/components/CardVersionPickerModal';
import { ScryfallRawData } from '@/lib/cardUtils';
import MagicCard from '@/components/MagicCard';
import Image from 'next/image'; // 1. IMPORT AJOUTÉ

// --- DEFINITIONS ---

// On définit le Payload pour correspondre aux données attendues par le serveur
interface ServerCardPayload {
    id: string;
    name: string;
    imageUrl: string;
    imageBackUrl: string | null;
    quantity: number;
    quantityForTrade: number; // Requis par CardType
    price: number;
    customPrice?: number;
    setName: string;
    setCode: string;
    isFoil: boolean;
    isSpecificVersion: boolean;
    scryfallData: ScryfallRawData | null; // Typage strict ici aussi
    wishlistId: string | null;
}

const mapCardsForServer = (cards: CardType[]): ServerCardPayload[] => {
    return cards.map(c => {
        // On s'assure que scryfallData est du bon type ou null
        const scryData = (c.scryfallData as ScryfallRawData) || null;

        const payload: ServerCardPayload = {
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl,
            imageBackUrl: c.imageBackUrl ?? null,
            quantity: c.quantity,
            quantityForTrade: c.quantityForTrade ?? 0,
            price: c.price ?? 0,
            customPrice: c.customPrice,
            setName: c.setName ?? '',
            setCode: c.setCode ?? '',
            isFoil: c.isFoil ?? false,
            isSpecificVersion: c.isSpecificVersion ?? false,
            scryfallData: scryData,
            wishlistId: c.wishlistId ?? null,
        };
        
        // Nettoyage si undefined
        if (payload.customPrice === undefined) delete payload.customPrice;
        
        return payload;
    });
};

function isCollectionCard(item: CardType | ScryfallRawData): item is CardType {
    return (item as CardType).quantity !== undefined;
}

// --- TABLEAU DE SÉLECTION (Panier) ---
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
    getMaxQuantity?: (id: string) => number,
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
                            
                            const maxQty = getMaxQuantity ? getMaxQuantity(card.id) : Infinity;
                            const isMaxReached = card.quantity >= maxQty;
                            const isMinReached = card.quantity <= 1;

                            return (
                                <tr 
                                    key={`${card.id}-${i}`} 
                                    className="hover:bg-secondary/50 transition-colors text-foreground select-none cursor-pointer"
                                    onClick={() => onCardClick(card)}
                                >
                                    {/* CELLULE QUANTITÉ INTERACTIVE */}
                                    <td className="px-2 py-1.5 text-center">
                                        <div 
                                            className={`flex items-center justify-center gap-1 bg-background/50 rounded border border-border p-0.5 ${colorClass}`}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button 
                                                onClick={() => onUpdateQuantity(card.id, -1)} 
                                                disabled={isMinReached}
                                                className="w-5 h-5 flex items-center justify-center bg-surface hover:bg-secondary rounded text-xs font-bold disabled:opacity-30 transition-colors border border-border"
                                            >
                                                -
                                            </button>
                                            
                                            <span className="font-mono font-bold w-8 text-center text-[10px]">
                                                {card.quantity}
                                                {maxQty !== Infinity && <span className="opacity-50 font-normal">/{maxQty}</span>}
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
                                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onRemove(card.id); }} 
                                            className="text-muted hover:text-danger transition px-1 font-bold"
                                        >
                                            ✕
                                        </button>
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

// --- TABLEAU SOURCE (RESULTATS RECHERCHE) ---
const TradeSourceTable = ({ cards, onAdd, buttonColorClass, loading }: { cards: (CardType | ScryfallRawData)[], onAdd: (c: CardType | ScryfallRawData) => void, buttonColorClass: 'text-danger' | 'text-success', loading?: boolean }) => {
    if (loading) return <p className="text-xs text-muted text-center py-4">Chargement...</p>;
    if (cards.length === 0) return null; 
    
    return (
        <div className="overflow-y-auto custom-scrollbar bg-surface border-t border-border max-h-[300px]">
            <table className="w-full text-xs text-left border-collapse">
                <tbody className="divide-y divide-border">
                    {cards.map((item, i) => {
                        const name = item.name;
                        const setCode = isCollectionCard(item) ? item.setCode || '' : item.set || '';
                        const isFoil = isCollectionCard(item) ? !!item.isFoil : false;
                        const qty = isCollectionCard(item) ? item.quantity : '-';

                        return (
                            <tr key={`${item.id}-${i}`} className="hover:bg-secondary/50 transition-colors text-foreground cursor-pointer group select-none" onClick={() => onAdd(item)}>
                                <td className="px-2 py-1.5 text-center text-muted font-mono">{qty}</td>
                                <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={name}>{name}</td>
                                <td className="px-2 py-1.5 text-center"><span className="text-[9px] font-mono bg-secondary text-muted px-1 rounded border border-border">{setCode.toUpperCase()}</span></td>
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
                        <p className="text-center text-muted italic">Aucune carte correspondante trouvée.</p>
                    ) : (
                        <div className="grid gap-2">
                            {matchingCards.map(card => (
                                <div 
                                    key={card.id} 
                                    onClick={() => { onConfirm(card); onClose(); }}
                                    className="flex items-center gap-3 p-2 rounded-lg border border-border hover:border-primary cursor-pointer hover:bg-primary/5 transition-all group"
                                >
                                    {/* 2. REMPLACEMENT DE <IMG> PAR <IMAGE> */}
                                    <div className="w-10 h-14 bg-black/10 rounded overflow-hidden shrink-0 relative">
                                        <Image 
                                            src={card.imageUrl} 
                                            alt={card.name} 
                                            fill // S'adapte au parent w-10 h-14
                                            className="object-cover"
                                            sizes="40px" // Optimisation : indique que l'image est petite
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
export default function ManualTradePage() {
    const { user } = useAuth();
    const { cards: myCollection, loading } = useCardCollection('collection'); 
    const [isPending, startTransition] = useTransition();

    // Etats Sélection
    const [toGive, setToGive] = useState<CardType[]>([]);
    const [toReceive, setToReceive] = useState<CardType[]>([]);
    
    // Etats Recherche
    const [localSearch, setLocalSearch] = useState('');
    const [remoteSearch, setRemoteSearch] = useState('');
    const [searchResults, setSearchResults] = useState<ScryfallRawData[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Etats Modales
    const [cardToPick, setCardToPick] = useState<ScryfallRawData | null>(null);
    const [collectionPickOpen, setCollectionPickOpen] = useState(false);
    const [selectedCollectionName, setSelectedCollectionName] = useState('');
    
    // Preview
    const [previewCard, setPreviewCard] = useState<CardType | null>(null);

    // --- TOGGLE VUE ---
    const [showFullCollection, setShowFullCollection] = useState(false);

    // --- LOGIQUE METIER ---

    // 1. Mise à jour des prix
    const handleUpdatePrice = (cardId: string, newPrice: number, listType: 'give' | 'receive') => {
        const setTarget = listType === 'give' ? setToGive : setToReceive;
        setTarget(prev => prev.map(c => c.id === cardId ? { ...c, customPrice: newPrice } : c));
    };

    // 2. Gestion stock max pour la colonne "DONNER"
    const getGiveMaxQuantity = (cardId: string) => {
        const sourceCard = myCollection.find(c => c.id === cardId);
        if (!sourceCard) return 0;
        return showFullCollection ? sourceCard.quantity : (sourceCard.quantityForTrade || 0);
    };

    // 3. Mise à jour Quantité (Boutons +/-)
    const handleUpdateQuantity = (cardId: string, delta: number, listType: 'give' | 'receive') => {
        const setTarget = listType === 'give' ? setToGive : setToReceive;
        
        setTarget(prev => {
            return prev.map(c => {
                if (c.id !== cardId) return c;

                const newQty = c.quantity + delta;
                if (newQty < 1) return c; 

                // Vérification du stock max SEULEMENT si on DONNE
                if (listType === 'give') {
                    const max = getGiveMaxQuantity(cardId);
                    if (newQty > max) {
                        toast.error("Stock insuffisant");
                        return c;
                    }
                }
                
                return { ...c, quantity: newQty };
            });
        });
    };

    // 4. Filtrage de la collection (Pour la recherche)
    const accessibleCollection = useMemo(() => {
        if (showFullCollection) return myCollection;
        return myCollection.filter(c => (c.quantityForTrade || 0) > 0);
    }, [myCollection, showFullCollection]);

    const localSearchResults = useMemo(() => {
        if (!localSearch.trim()) return [];
        const lower = localSearch.toLowerCase();
        const matches = accessibleCollection.filter(c => c.name.toLowerCase().includes(lower));
        const uniqueNames = Array.from(new Set(matches.map(c => c.name))).slice(0, 10);
        return uniqueNames.map(name => matches.find(c => c.name === name)!);
    }, [accessibleCollection, localSearch]);

    const matchingCollectionCards = useMemo(() => {
        if (!selectedCollectionName) return [];
        return accessibleCollection.filter(c => c.name === selectedCollectionName);
    }, [accessibleCollection, selectedCollectionName]);

    // 5. Handlers Ajout
    const handleLocalResultClick = (item: CardType | ScryfallRawData) => {
        setSelectedCollectionName(item.name);
        setCollectionPickOpen(true);
    };

    const confirmAddFromCollection = (card: CardType) => {
        const existing = toGive.find(c => c.id === card.id);
        const maxStock = getGiveMaxQuantity(card.id);

        if (existing) {
            if (existing.quantity < maxStock) {
                setToGive(prev => prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c));
                toast.success("+1 ajouté");
            } else {
                toast.error("Stock max atteint");
            }
        } else {
            setToGive(prev => [...prev, { ...card, quantity: 1, customPrice: card.price }]);
            toast.success("Carte ajoutée");
        }
        setCollectionPickOpen(false);
        setLocalSearch(''); 
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
            setToReceive(prev => [...prev, { ...card, customPrice: card.price }]);
        }
        setSearchResults([]); setRemoteSearch(""); toast.success(`Ajouté`);
    };

    const handleValidate = async () => {
        if (!user) return;
        if (toGive.length === 0 && toReceive.length === 0) return;
        if (!confirm("Confirmer cet échange ? Vos cartes données seront retirées de votre collection.")) return;

        const toastId = toast.loading("Validation...");
        startTransition(async () => {
            // CORRECTION: Utilisation de "as unknown as CardType[]" au lieu de "as any[]"
            // Cela permet de transformer notre Payload (DTO) en CardType pour l'action serveur
            // sans désactiver la vérification de type globale.
            const cleanToGive = mapCardsForServer(toGive) as unknown as CardType[]; 
            const cleanToReceive = mapCardsForServer(toReceive) as unknown as CardType[]; 
            
            // Typage explicite du retour de l'action server
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
    const valReceive = toReceive.reduce((acc, c) => acc + (c.customPrice ?? c.price ?? 0) * c.quantity, 0);

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
                
                {/* COLONNE GAUCHE : JE DONNE */}
                <div className="flex flex-col h-full bg-danger/5 rounded-xl border border-danger/20 overflow-hidden shadow-sm">
                    <div className="p-4 pb-0 flex-none space-y-3">
                        
                        {/* Header + Toggle */}
                        <div className="flex justify-between items-start">
                            <h2 className="font-bold text-red-600">À DONNER ({toGive.reduce((a,c)=>a+c.quantity,0)}) - {valGive.toFixed(2)} €</h2>
                            
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    className="w-3.5 h-3.5 text-danger rounded border-danger/30 focus:ring-danger accent-danger"
                                    checked={showFullCollection}
                                    onChange={(e) => setShowFullCollection(e.target.checked)}
                                />
                                <span className="text-[10px] font-semibold text-danger/80 hover:text-danger">
                                    Accéder à toute la collection
                                </span>
                            </label>
                        </div>

                        {/* Search Bar */}
                        <input 
                            type="text" 
                            placeholder="Rechercher une carte à donner..." 
                            className="w-full p-2 rounded border text-sm bg-background text-foreground focus:ring-2 focus:ring-danger/50 outline-none" 
                            value={localSearch} 
                            onChange={e => setLocalSearch(e.target.value)} 
                        />
                    </div>

                    {/* Table des sélections */}
                    <TradeSelectionTable 
                        cards={toGive} 
                        onRemove={(id) => setToGive(p => p.filter(c => c.id !== id))} 
                        onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'give')} 
                        onUpdateQuantity={(id, d) => handleUpdateQuantity(id, d, 'give')}
                        getMaxQuantity={getGiveMaxQuantity}
                        colorClass="text-danger" 
                        emptyLabel="Recherchez vos cartes ci-dessus..." 
                        onCardClick={setPreviewCard}
                    />
                    
                    {/* Résultats de recherche */}
                    {localSearch && (
                        <div className="flex-none max-h-[200px] border-t border-danger/20 bg-surface shadow-inner">
                            <TradeSourceTable 
                                cards={localSearchResults} 
                                onAdd={handleLocalResultClick} 
                                buttonColorClass="text-danger" 
                                loading={loading} 
                            />
                        </div>
                    )}
                </div>

                {/* COLONNE DROITE : JE RECOIS */}
                <div className="flex flex-col h-full bg-success/5 rounded-xl border border-success/20 overflow-hidden shadow-sm">
                    <div className="p-4 pb-0 flex-none">
                        <h2 className="font-bold text-green-600 mb-2">À RECEVOIR ({toReceive.reduce((a,c)=>a+c.quantity,0)}) - {valReceive.toFixed(2)} €</h2>
                        <form onSubmit={handleSearchScryfall} className="flex gap-2 mb-2">
                            <input type="text" placeholder="Carte à recevoir..." className="grow p-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-success outline-none" value={remoteSearch} onChange={e => setRemoteSearch(e.target.value)} />
                            <button type="submit" className="bg-success hover:opacity-90 text-primary-foreground px-3 rounded-lg shadow-sm font-bold text-xs">GO</button>
                        </form>
                    </div>
                    
                    <TradeSelectionTable 
                        cards={toReceive} 
                        onRemove={(id) => setToReceive(p => p.filter((_, idx) => p[idx].id !== id || idx !== p.findIndex(x => x.id === id)))} 
                        onUpdatePrice={(id, p) => handleUpdatePrice(id, p, 'receive')} 
                        onUpdateQuantity={(id, d) => handleUpdateQuantity(id, d, 'receive')}
                        colorClass="text-success" 
                        emptyLabel="Recherchez des cartes en bas..." 
                        onCardClick={setPreviewCard}
                    />
                    
                    <div className="flex-none max-h-[200px] border-t border-success/20 bg-surface shadow-inner">
                        <TradeSourceTable 
                            cards={uniqueSearchResults} 
                            onAdd={(item) => { if (!isCollectionCard(item)) setCardToPick(item); }} 
                            buttonColorClass="text-success" 
                            loading={isSearching} 
                        />
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-surface border-t border-border flex justify-between items-center px-6 z-40 shadow-sm">
                <div className="hidden sm:block flex-1"></div>
                <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Balance Estimée</span>
                    <div className={`text-2xl font-black ${valGive - valReceive >= 0 ? 'text-success' : 'text-danger'}`}>{valGive - valReceive > 0 ? '+' : ''}{(valGive - valReceive).toFixed(2)} €</div>
                </div>
                <div className="flex-1 flex justify-end">
                    <button onClick={handleValidate} disabled={isPending || (toGive.length === 0 && toReceive.length === 0)} className="btn-primary px-6 py-3 disabled:opacity-50 text-sm">{isPending ? 'Validation...' : 'Valider'}</button>
                </div>
            </div>

            {/* MODALES */}
            <CardVersionPickerModal isOpen={!!cardToPick} baseCard={cardToPick} onClose={() => setCardToPick(null)} onConfirm={handleConfirmReceive} />
            
            <CollectionPickerModal 
                isOpen={collectionPickOpen} 
                onClose={() => setCollectionPickOpen(false)} 
                cardName={selectedCollectionName} 
                matchingCards={matchingCollectionCards} 
                onConfirm={confirmAddFromCollection}
            />

            {/* MODALE DE PREVISUALISATION */}
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
                            {/* AJOUT DE HIDEFOOTER ICI */}
                            <MagicCard {...previewCard} readOnly={true} quantity={previewCard.quantity} hideFooter={true} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}