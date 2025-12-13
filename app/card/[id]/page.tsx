// app/card/[id]/page.tsx
'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection'; 
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils'; 
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation'; // <--- IMPORT

// Imports des composants séparés
import CardMainDetails from '@/components/card-page/CardMainDetails';
import CardVersionsGrid from '@/components/card-page/CardVersionsGrid';

type CardDetailPageProps = {
    params: Promise<{ id: string }>;
};

// Composant local simple pour la gestion du stock
const QuantityManager = ({ card }: { card: CardType }) => {
    const { updateQuantity, removeCard, setTradeQuantity } = useCardCollection('collection'); 
    const maxStock = card.quantity;
    const [tradeQtyInput, setTradeQtyInput] = useState(card.quantityForTrade ?? 0);
    const [isUpdatingTrade, setIsUpdatingTrade] = useState(false);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setTradeQtyInput(card.quantityForTrade ?? 0), [card.quantityForTrade]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { if (tradeQtyInput > maxStock) setTradeQtyInput(maxStock); }, [maxStock, tradeQtyInput]);

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
            if (confirm("Supprimer la carte de la collection ?")) removeCard(card.id);
        }
    };

    return (
        <div className="bg-surface p-6 rounded-xl border border-border shadow-md space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-3">Gestion du Stock</h2>
            <div className="flex justify-between items-center bg-background p-3 rounded-lg border border-border">
                <p className="font-medium text-sm">Quantité Totale:</p>
                <div className="flex items-center gap-2">
                    <button onClick={() => handleUpdateStock(-1)} className="p-1 w-8 h-8 rounded-full bg-secondary hover:bg-border text-muted font-bold transition">-</button>
                    <span className="text-lg font-bold text-primary w-8 text-center">{card.quantity}</span>
                    <button onClick={() => handleUpdateStock(1)} className="p-1 w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-bold transition">+</button>
                </div>
            </div>
            <div className="flex flex-col bg-background p-3 rounded-lg border border-border">
                <label className="font-medium text-sm mb-2">Quantité à l&apos;échange (max {maxStock}) :</label>
                <div className="flex items-center gap-3">
                    <input type="number" min="0" max={maxStock} value={tradeQtyInput} onChange={(e) => setTradeQtyInput(Math.min(maxStock, Math.max(0, parseInt(e.target.value) || 0)))} className="w-20 p-2 border border-border rounded-lg text-center bg-surface font-bold text-foreground" />
                    <button onClick={handleSaveTradeQty} disabled={isUpdatingTrade || tradeQtyInput === (card.quantityForTrade ?? 0) || tradeQtyInput > maxStock} className="bg-success hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex-grow">
                        {isUpdatingTrade ? 'Sauvegarde...' : 'Définir l\'échange'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function CardDetailPage({ params }: CardDetailPageProps) {
    const { user } = useAuth();
    const unwrappedParams = use(params);
    const cardId = unwrappedParams.id;
    const searchParams = useSearchParams();
    
    // Récupération de l'URL de retour (si présente)
    const returnTo = searchParams.get('returnTo');
    const backLink = returnTo ? decodeURIComponent(returnTo) : '/collection';
    const backLabel = returnTo ? (returnTo.includes('user') ? 'Retour au profil' : 'Retour') : 'Retour à la collection';

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

    useEffect(() => {
        const fetchCard = async () => {
            if (!user) { setLoading(false); return; }
            setLoading(true);
            try {
                let cardRef = doc(db, 'users', user.uid, 'collection', cardId);
                let snap = await getDoc(cardRef);
                if (!snap.exists()) {
                    cardRef = doc(db, 'users', user.uid, 'wishlist', cardId);
                    snap = await getDoc(cardRef);
                }

                if (snap.exists()) {
                    setCard({ id: snap.id, ...snap.data(), uid: user.uid } as CardType); 
                } else {
                    try {
                        const scryRes = await fetch(`https://api.scryfall.com/cards/${cardId}`);
                        if (scryRes.ok) {
                            const scryData = await scryRes.json();
                            const normalized = normalizeCardData(scryData);
                            setCard({ ...normalized, quantity: 0, uid: '', wishlistId: undefined, isFoil: false, isSpecificVersion: false, quantityForTrade: 0 } as CardType);
                        } else {
                            console.error("Carte introuvable sur Scryfall");
                        }
                    } catch (errScry) { console.error("Erreur Scryfall fallback", errScry); }
                }
            } catch (e) { console.error("Erreur chargement carte", e); } 
            finally { setLoading(false); }
        };
        fetchCard();
    }, [user, cardId]);

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

    if (!user) return <div className="p-10 text-center text-muted">Connectez-vous pour voir les détails.</div>;
    if (loading) return <div className="p-10 text-center text-muted animate-pulse">Chargement des détails de la carte...</div>;
    if (!card) return <div className="p-10 text-center text-danger">Carte introuvable.</div>;

    const { name, imageUrl, imageBackUrl, setName } = normalizeCardData(card.scryfallData as ScryfallRawData);
    const isDoubleSided = !!imageBackUrl;
    const oracleId = (card.scryfallData as ScryfallRawData)?.oracle_id as string | undefined;
    const displayImage = isFlipped && imageBackUrl ? imageBackUrl : imageUrl;
    const isOwner = !!card.uid && user.uid === card.uid; 
    
    return (
        <main className="container mx-auto p-4 max-w-6xl min-h-[80vh]">
            <div className="mb-6 flex justify-between items-center">
                <Link href={backLink} className="text-sm text-primary hover:underline">← {backLabel}</Link>
                {oracleId && (
                     <button
                        onClick={() => setShowAllVersions(!showAllVersions)}
                        className="bg-secondary hover:bg-border text-foreground px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2"
                     >
                        {showAllVersions ? 'Afficher les Détails' : 'Voir toutes les Editions'}
                     </button>
                )}
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-8 border-b border-border pb-4">Détails : {name}</h1>

            {showAllVersions && oracleId ? (
                <CardVersionsGrid 
                    oracleId={oracleId} 
                    currentCardId={card.id} 
                    onVersionSelect={handleVersionSelect} 
                    collectionMap={collectionMap} 
                />
            ) : (
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 flex flex-col items-center">
                        <div 
                            className="w-full max-w-sm aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-2xl ring-4 ring-primary/20 cursor-pointer"
                            onClick={() => isDoubleSided && setIsFlipped(!isFlipped)}
                        >
                            <img src={displayImage} alt={name} className="w-full h-full object-cover" />
                        </div>
                        {isDoubleSided && (
                            <button onClick={() => setIsFlipped(!isFlipped)} className="mt-4 text-sm text-primary hover:underline font-medium">
                                {isFlipped ? 'Afficher le Recto' : 'Afficher le Verso'}
                            </button>
                        )}
                        <div className="mt-4 text-center">
                            <p className="text-lg font-semibold text-foreground">{setName}</p>
                            {isOwner ? (
                                <p className="text-sm text-muted">Quantité totale : {card.quantity} | Échange : <span className="font-bold text-success">{card.quantityForTrade ?? 0}</span></p>
                            ) : (
                                <p className="text-sm text-muted italic">Vous ne possédez pas cette carte.</p>
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-6">
                        {isOwner && <QuantityManager card={card} />}
                        <CardMainDetails cardData={card} />
                    </div>
                </div>
            )}
        </main>
    );
}