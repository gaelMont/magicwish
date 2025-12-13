// app/card/[id]/page.tsx
'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection'; 
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils'; 
import Link from 'next/link';
import toast from 'react-hot-toast';

type CardDetailPageProps = {
    params: Promise<{ id: string }>;
};

// --- Composant de gestion de quantité ---
const QuantityManager = ({ card }: { card: CardType }) => {
    const { 
        updateQuantity, 
        removeCard, 
        setTradeQuantity 
    } = useCardCollection('collection'); 
    const maxStock = card.quantity;

    const [tradeQtyInput, setTradeQtyInput] = useState(card.quantityForTrade ?? 0);
    const [isUpdatingTrade, setIsUpdatingTrade] = useState(false);

    useEffect(() => {
        setTradeQtyInput(card.quantityForTrade ?? 0);
    }, [card.quantityForTrade]);
    
    useEffect(() => {
        if (tradeQtyInput > maxStock) {
            setTradeQtyInput(maxStock);
        }
    }, [maxStock, tradeQtyInput]);

    const handleSaveTradeQty = async () => {
        if (!card.id || tradeQtyInput > maxStock || tradeQtyInput < 0) return;
        setIsUpdatingTrade(true);
        await setTradeQuantity(card.id, tradeQtyInput);
        setIsUpdatingTrade(false);
        toast.success(`Statut d'échange mis à jour.`);
    };

    const handleUpdateStock = async (amount: 1 | -1) => {
        const result = await updateQuantity(card.id, amount, card.quantity);
        
        if (result === 'shouldDelete') {
            if (confirm("La quantité est à zéro. Supprimer la carte de la collection ?")) {
                removeCard(card.id);
            }
        }
    };

    return (
        <div className="bg-surface p-6 rounded-xl border border-border shadow-md space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-3">Gestion du Stock</h2>

            {/* 1. QUANTITÉ TOTALE */}
            <div className="flex justify-between items-center bg-background p-3 rounded-lg border border-border">
                <p className="font-medium text-sm">Quantité Totale:</p>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handleUpdateStock(-1)} 
                        className="p-1 w-8 h-8 rounded-full bg-secondary hover:bg-border text-muted font-bold transition"
                    > - </button>
                    <span className="text-lg font-bold text-primary w-8 text-center">{card.quantity}</span>
                    <button 
                        onClick={() => handleUpdateStock(1)} 
                        className="p-1 w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-bold transition"
                    > + </button>
                </div>
            </div>

            {/* 2. QUANTITÉ À L'ÉCHANGE */}
            <div className="flex flex-col bg-background p-3 rounded-lg border border-border">
                <label className="font-medium text-sm mb-2">Quantité à l&apos;échange (max {maxStock}) :</label>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        min="0"
                        max={maxStock}
                        value={tradeQtyInput}
                        onChange={(e) => setTradeQtyInput(Math.min(maxStock, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-20 p-2 border border-border rounded-lg text-center bg-surface font-bold text-foreground"
                    />
                    <button
                        onClick={handleSaveTradeQty}
                        disabled={isUpdatingTrade || tradeQtyInput === (card.quantityForTrade ?? 0) || tradeQtyInput > maxStock}
                        className="bg-success hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex-grow"
                    >
                        {isUpdatingTrade ? 'Sauvegarde...' : 'Définir l\'échange'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Composant pour afficher les versions/prix des sets (DÉTAILS) ---
const CardDetailsClient = ({ cardData }: { cardData: CardType }) => {
    const currentPrice = cardData.customPrice ?? cardData.price ?? 0;
    const currentPriceType = cardData.customPrice !== undefined ? "Personnalisé" : "Scryfall";
    
    const scryfallRaw = cardData.scryfallData as ScryfallRawData | undefined;
    const prices = scryfallRaw?.prices;

    if (!scryfallRaw) {
        return <p className="text-muted">Détails supplémentaires (prix, versions) non disponibles.</p>;
    }

    return (
        <div className="space-y-8">
            {/* Prix Actuels */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-md">
                <h2 className="text-xl font-bold text-primary mb-4">Prix et Statut</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted">Prix Stocké (EUR)</p>
                        <p className={`text-2xl font-black ${cardData.customPrice ? 'text-orange-600' : 'text-success'}`}>{currentPrice.toFixed(2)} €</p>
                        <p className="text-xs text-muted mt-1">Source: {currentPriceType}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted">Version</p>
                        <p className="text-lg font-bold text-foreground">
                            {cardData.isFoil ? 'Foil' : 'Non-Foil'} {cardData.isSpecificVersion ? ' (Spécifique)' : ' (Générique)'}
                        </p>
                        <p className="text-xs text-muted mt-1">Statut: {cardData.quantityForTrade ? `À l'échange (${cardData.quantityForTrade}) 🤝` : 'Privée'}</p>
                    </div>
                </div>
            </div>

            {/* Prix Scryfall (brut) */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-xl font-bold text-foreground mb-4">Prix de Référence Scryfall</h2>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-border text-muted">
                            <th className="py-2">Type</th>
                            <th className="py-2">EUR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {prices?.eur && (
                            <tr className="border-b border-border">
                                <td className="py-2 font-medium">Normal</td>
                                <td className="py-2 text-success font-bold">{parseFloat(prices.eur).toFixed(2)} €</td>
                            </tr>
                        )}
                        {prices?.eur_foil && (
                             <tr>
                                <td className="py-2 font-medium">Foil</td>
                                <td className="py-2 text-purple-600 font-bold">{parseFloat(prices.eur_foil).toFixed(2)} €</td>
                            </tr>
                        )}
                        {!prices?.eur && !prices?.eur_foil && (
                            <tr>
                                <td className="py-2 font-medium">Normal</td>
                                <td className="py-2 text-muted">0.00 €</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Liens externes */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-xl font-bold text-foreground mb-4">Outils</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <a href={`https://www.tcgplayer.com/search/all/product?q=${cardData.name}`} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs py-2 text-center">TCGPlayer</a>
                    <a href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${cardData.name}`} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs py-2 text-center">Cardmarket</a>
                    <a href={`https://scryfall.com/search?q=${cardData.id}`} target="_blank" rel="noopener noreferrer" className="bg-secondary text-primary border border-primary/30 hover:bg-secondary/80 text-xs py-2 rounded-lg font-bold text-center transition">Scryfall</a>
                </div>
            </div>
        </div>
    );
};


// --- Composant d'affichage de toutes les versions ---
const AllVersionsList = ({ oracleId, currentCardId, onVersionSelect, collectionMap }: 
    { 
        oracleId: string, 
        currentCardId: string, 
        onVersionSelect: (rawCard: ScryfallRawData) => void, 
        collectionMap: Map<string, CardType>
    }) => {
    
    // --- 1. TOUS LES HOOKS EN PREMIER ---
    const [allVersions, setAllVersions] = useState<ScryfallRawData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRawCard, setSelectedRawCard] = useState<ScryfallRawData | null>(null);
    const [isFlipped, setIsFlipped] = useState(false); 
    const [showOwnedOnly, setShowOwnedOnly] = useState(false); 

    // Fetch des données
    useEffect(() => {
        const fetchAllVersions = async () => {
            setLoading(true);
            try {
                const res = await fetch(`https://api.scryfall.com/cards/search?q=oracle_id:${oracleId}&unique=prints&order=released`);
                const data = await res.json();
                
                if (data.data && data.data.length > 0) {
                    setAllVersions(data.data);
                    const current = data.data.find((v: ScryfallRawData) => v.id === currentCardId);
                    if (current) setSelectedRawCard(current);
                    else setSelectedRawCard(data.data[0]); 
                } else {
                    toast.error("Aucune version trouvée sur Scryfall.");
                }
            } catch (e) {
                console.error("Erreur chargement versions Scryfall", e);
            } finally {
                setLoading(false);
            }
        };

        if (oracleId) {
            fetchAllVersions();
        }
    }, [oracleId, currentCardId]);

    const cardToDisplay = useMemo(() => {
        if (selectedRawCard) return normalizeCardData(selectedRawCard);
        if (allVersions.length > 0) return normalizeCardData(allVersions[0]);
        return null;
    }, [selectedRawCard, allVersions]);
    
    const filteredVersions = useMemo(() => {
        if (!showOwnedOnly) return allVersions;
        return allVersions.filter(v => collectionMap.has(v.id));
    }, [allVersions, showOwnedOnly, collectionMap]);

    // --- 2. CONDITIONS DE RETOUR ---
    if (loading) {
        return (
            <div className="p-10 text-center">
                 <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                 <p className="text-muted">Chargement de toutes les éditions...</p>
            </div>
        );
    }
    if (allVersions.length === 0 || !cardToDisplay) {
        return <p className="p-10 text-center text-danger">Liste des éditions non disponible.</p>;
    }
    
    // --- 3. LOGIQUE DE RENDU ---
    const isDoubleSided = !!cardToDisplay.imageBackUrl;
    const displayImage = isFlipped && cardToDisplay.imageBackUrl ? cardToDisplay.imageBackUrl : cardToDisplay.imageUrl;

    return (
        <div className="grid md:grid-cols-3 gap-8">
            
            {/* COLONNE GAUCHE */}
            <div className="md:col-span-1 flex flex-col items-center sticky top-24 self-start">
                 <div 
                    className="w-full max-w-sm aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-2xl ring-4 ring-primary/20 cursor-pointer"
                    onClick={() => isDoubleSided && setIsFlipped(!isFlipped)}
                >
                    <img src={displayImage} alt={cardToDisplay.name} className="w-full h-full object-cover" />
                </div>
                
                {isDoubleSided && (
                    <button 
                        onClick={() => setIsFlipped(!isFlipped)} 
                        className="mt-4 text-sm text-primary hover:underline font-medium"
                    >
                        {isFlipped ? 'Afficher le Recto' : 'Afficher le Verso'}
                    </button>
                )}
            </div>

            {/* COLONNE DROITE */}
            <div className="md:col-span-2 space-y-6">
                 
                 {/* EN-TÊTE AVEC FILTRE */}
                <div className="flex justify-between items-center bg-secondary p-3 rounded-xl border border-border">
                    <h2 className="text-xl font-bold text-foreground">
                        Impressions ({filteredVersions.length} / {allVersions.length})
                    </h2>
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-background px-3 py-1.5 rounded-lg border border-border hover:border-primary transition">
                        <input 
                            type="checkbox" 
                            checked={showOwnedOnly} 
                            onChange={(e) => setShowOwnedOnly(e.target.checked)} 
                            className="w-4 h-4 text-primary rounded border-border focus:ring-primary" 
                        />
                        <span className="text-sm font-medium text-foreground">Mes versions</span>
                    </label>
                </div>
                
                {/* Liste des versions */}
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-3 custom-scrollbar">
                    {filteredVersions.map(v => {
                        const normalized = normalizeCardData(v);
                        const isCurrentInCollection = v.id === currentCardId; 
                        const isSelectedInList = v.id === selectedRawCard?.id; 

                        const ownedCard = collectionMap.get(v.id);
                        const isOwned = !!ownedCard;
                        const ownedQty = ownedCard?.quantity || 0;

                        const priceNormal = parseFloat(v.prices?.eur || "0");
                        const priceFoil = parseFloat(v.prices?.eur_foil || "0");
                        const displayPrice = Math.max(priceNormal, priceFoil);
                        
                        return (
                            <div 
                                key={v.id} 
                                onClick={() => { setSelectedRawCard(v); setIsFlipped(false); }} 
                                onDoubleClick={() => onVersionSelect(v)} 
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    isSelectedInList
                                        ? 'bg-primary/10 border-primary shadow-lg ring-2 ring-primary/50' 
                                        : isOwned 
                                            ? 'bg-success/5 border-success/30 hover:bg-success/10' 
                                            : 'bg-surface border-border hover:bg-primary/5' 
                                }`}
                            >
                                <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0">
                                    <img src={normalized.imageUrl} alt={normalized.setName} className="w-full h-full object-cover" loading="lazy" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-bold text-foreground truncate flex items-center gap-2">
                                        {v.set_name} 
                                        {isOwned && <span className="text-xs bg-success text-white px-1.5 py-0.5 rounded font-bold">{ownedQty}x</span>} 
                                        {isCurrentInCollection && <span className="text-xs text-primary font-normal">(Affichée)</span>}
                                    </p>
                                    <p className="text-xs text-muted">Set: {v.set.toUpperCase()} | Num: {v.collector_number}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className={`font-bold text-sm ${isCurrentInCollection ? 'text-primary' : 'text-success'}`}>{displayPrice.toFixed(2)} €</span>
                                    {v.finishes?.includes('foil') && <p className="text-xs text-amber-600">Foil</p>}
                                    <button onClick={(e) => { e.stopPropagation(); onVersionSelect(v); }} className="text-xs text-primary hover:underline block mt-1 w-full text-right">
                                        Sélectionner
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="pt-4 border-t border-border">
                    <button 
                        onClick={() => selectedRawCard && onVersionSelect(selectedRawCard)}
                        disabled={!selectedRawCard}
                        className="btn-primary w-full py-3 text-lg disabled:opacity-50"
                    >
                        Afficher les Détails de cette Impression
                    </button>
                </div>
                
            </div>
        </div>
    );
};


// --- PAGE PRINCIPALE ---
export default function CardDetailPage({ params }: CardDetailPageProps) {
    const { user } = useAuth();
    const unwrappedParams = use(params);
    const cardId = unwrappedParams.id;
    
    // Chargement de TOUTE la collection pour le filtre "Mes versions"
    const { cards: collectionCards } = useCardCollection('collection'); 
    
    const collectionMap = useMemo(() => {
        const map = new Map<string, CardType>();
        collectionCards.forEach(c => map.set(c.id, c));
        return map;
    }, [collectionCards]);

    const [card, setCard] = useState<CardType | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFlipped, setIsFlipped] = useState(false); 
    const [showAllVersions, setShowAllVersions] = useState(false);

    // --- CHARGEMENT DES DONNÉES DE LA CARTE ---
    useEffect(() => {
        const fetchCard = async () => {
            if (!user) { setLoading(false); return; }
            
            setLoading(true);
            try {
                // 1. Tenter de lire dans MA collection (Propriétaire)
                let cardRef = doc(db, 'users', user.uid, 'collection', cardId);
                let snap = await getDoc(cardRef);

                if (!snap.exists()) {
                    // 2. Tenter de lire dans MA wishlist
                    cardRef = doc(db, 'users', user.uid, 'wishlist', cardId);
                    snap = await getDoc(cardRef);
                }

                if (snap.exists()) {
                    // CAS 1: Je possède la carte
                    setCard({ id: snap.id, ...snap.data(), uid: user.uid } as CardType); 
                } else {
                    // CAS 2: Je ne possède PAS la carte (ex: clic depuis profil ami)
                    // On va chercher les infos sur Scryfall pour afficher une vue "générique"
                    try {
                        const scryRes = await fetch(`https://api.scryfall.com/cards/${cardId}`);
                        if (scryRes.ok) {
                            const scryData = await scryRes.json();
                            const normalized = normalizeCardData(scryData);
                            
                            setCard({
                                ...normalized,
                                quantity: 0, 
                                uid: '', 
                                wishlistId: undefined, // CORRECTION : 'undefined' au lieu de 'null'
                                isFoil: false,
                                isSpecificVersion: false,
                                quantityForTrade: 0
                            } as CardType);
                        } else {
                            console.error("Carte introuvable sur Scryfall");
                        }
                    } catch (errScry) {
                        console.error("Erreur Scryfall fallback", errScry);
                    }
                }
            } catch (e) {
                console.error("Erreur chargement carte Firestore", e);
            } finally {
                setLoading(false);
            }
        };

        fetchCard();
    }, [user, cardId]);


    // --- ACTIONS ---
    const handleVersionSelect = (rawCard: ScryfallRawData) => {
        const normalized = normalizeCardData(rawCard);

        setCard(prev => {
            if (!prev) return null;
            return {
                ...prev,
                name: normalized.name,
                imageUrl: normalized.imageUrl,
                imageBackUrl: normalized.imageBackUrl,
                setName: normalized.setName,
                setCode: normalized.setCode,
                price: normalized.price,
                scryfallData: normalized.scryfallData as Record<string, unknown>, 
            };
        });
        
        setShowAllVersions(false); 
        setIsFlipped(false); 
    };


    // --- RENDU ---
    if (!user) return <div className="p-10 text-center text-muted">Connectez-vous pour voir les détails.</div>;
    if (loading) return <div className="p-10 text-center text-muted animate-pulse">Chargement des détails de la carte...</div>;
    
    if (!card) return <div className="p-10 text-center text-danger">Carte introuvable.</div>;

    const { name, imageUrl, imageBackUrl, setName } = normalizeCardData(card.scryfallData as ScryfallRawData);
    const isDoubleSided = !!imageBackUrl;
    const oracleId = (card.scryfallData as ScryfallRawData)?.oracle_id; 
    
    const displayImage = isFlipped && imageBackUrl ? imageBackUrl : imageUrl;
    
    const isOwner = !!card.uid && user.uid === card.uid; 
    
    return (
        <main className="container mx-auto p-4 max-w-6xl min-h-[80vh]">
            
            <div className="mb-6 flex justify-between items-center">
                <Link href="/collection" className="text-sm text-primary hover:underline">← Retour à la collection</Link>
                {oracleId && (
                     <button
                        onClick={() => setShowAllVersions(!showAllVersions)}
                        className="bg-secondary hover:bg-border text-foreground px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2"
                     >
                        {showAllVersions ? 'Afficher les Détails' : 'Voir toutes les Editions'}
                     </button>
                )}
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-8 border-b border-border pb-4">
                Détails : {name}
            </h1>

            {showAllVersions && oracleId ? (
                <AllVersionsList 
                    oracleId={oracleId} 
                    currentCardId={card.id} 
                    onVersionSelect={handleVersionSelect} 
                    collectionMap={collectionMap} 
                />
            ) : (
                <div className="grid md:grid-cols-3 gap-8">
                    
                    {/* COLONNE GAUCHE : IMAGE */}
                    <div className="md:col-span-1 flex flex-col items-center">
                        <div 
                            className="w-full max-w-sm aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-2xl ring-4 ring-primary/20 cursor-pointer"
                            onClick={() => isDoubleSided && setIsFlipped(!isFlipped)}
                        >
                            <img src={displayImage} alt={name} className="w-full h-full object-cover" />
                        </div>
                        
                        {isDoubleSided && (
                            <button 
                                onClick={() => setIsFlipped(!isFlipped)} 
                                className="mt-4 text-sm text-primary hover:underline font-medium"
                            >
                                {isFlipped ? 'Afficher le Recto' : 'Afficher le Verso'}
                            </button>
                        )}
                        
                        <div className="mt-4 text-center">
                            <p className="text-lg font-semibold text-foreground">{setName}</p>
                            {isOwner ? (
                                <p className="text-sm text-muted">
                                    Quantité totale : {card.quantity} | 
                                    Échange : <span className="font-bold text-success">{card.quantityForTrade ?? 0}</span>
                                </p>
                            ) : (
                                <p className="text-sm text-muted italic">Vous ne possédez pas cette carte.</p>
                            )}
                        </div>
                    </div>

                    {/* COLONNE DROITE : DÉTAILS ET PRIX + GESTION DU STOCK */}
                    <div className="md:col-span-2 space-y-6">
                        {isOwner && <QuantityManager card={card} />}
                        <CardDetailsClient cardData={card} />
                    </div>
                </div>
            )}
        </main>
    );
}