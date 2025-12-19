'use client';

import { use, useEffect, useState, useMemo, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection'; 
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils'; 
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';

// Imports des composants séparés
import CardVersionsGrid from '@/components/card-page/CardVersionsGrid';
import DualQuantityManager from '@/components/card-page/DualQuantityManager'; 

// --- INTERFACES ---
interface ScryfallDataExtended extends ScryfallRawData {
    purchase_uris?: {
        cardmarket?: string;
        tcgplayer?: string;
        cardhoarder?: string;
    };
}

type CardDetailPageProps = {
    params: Promise<{ id: string }>;
};

// --- COMPOSANT DE DÉTAILS PRINCIPAUX ---
function CardMainDetails({ cardData }: { cardData: CardType | null }) {
    const { user } = useAuth();
    
    const [isEditingPurchase, setIsEditingPurchase] = useState(false);
    const [purchaseValue, setPurchaseValue] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (cardData?.purchasePrice !== undefined && cardData?.purchasePrice !== null) {
            setPurchaseValue(cardData.purchasePrice.toString());
        } else {
            setPurchaseValue("");
        }
    }, [cardData]);

    if (!cardData) return null;

    const currentPrice = cardData.price ?? 0;
    const hasPrice = currentPrice > 0;
    const purchasePrice = cardData.purchasePrice;
    
    let profitLoss = null;
    let profitLossPercent = null;
    
    if (purchasePrice !== undefined && purchasePrice !== null && purchasePrice > 0 && hasPrice) {
        profitLoss = currentPrice - purchasePrice;
        profitLossPercent = (profitLoss / purchasePrice) * 100;
    }

    const scryfallRaw = cardData.scryfallData as ScryfallDataExtended | undefined;
    const finishes = scryfallRaw?.finishes || [];
    const prices = scryfallRaw?.prices;

    const hasNonFoilVersion = finishes.includes('nonfoil');
    const hasFoilVersion = finishes.includes('foil');

    const baseCardmarketUrl = scryfallRaw?.purchase_uris?.cardmarket 
        || `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(cardData.name)}`;

    const getPreciseUrl = (isFoilVersion: boolean) => {
        const separator = baseCardmarketUrl.includes('?') ? '&' : '?';
        const param = isFoilVersion ? 'isFoil=Y' : 'isFoil=N';
        return `${baseCardmarketUrl}${separator}${param}`;
    };

    const handleSavePurchasePrice = async () => {
        if (!user || !cardData.id) return;
        const val = parseFloat(purchaseValue);
        const finalVal = isNaN(val) ? 0 : val;

        setIsSaving(true);
        try {
            const cardRef = doc(db, 'users', user.uid, 'collection', cardData.id);
            await updateDoc(cardRef, { 
                purchasePrice: finalVal > 0 ? finalVal : 0 
            });
            toast.success("Historique mis à jour");
            setIsEditingPurchase(false);
        } catch (error) {
            console.error(error);
            toast.error("Erreur sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    const formatPrice = (val?: string) => {
        if (!val) return null;
        const num = parseFloat(val);
        return num > 0 ? `${num.toFixed(2)} EUR` : null;
    };

    const priceNormal = formatPrice(prices?.eur);
    const priceFoil = formatPrice(prices?.eur_foil);

    return (
        <div className="space-y-6">
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <span className="bg-primary/10 text-primary p-1 rounded">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                        Historique d&apos;Acquisition
                    </h2>
                    {!isEditingPurchase && (
                        <button 
                            onClick={() => setIsEditingPurchase(true)}
                            className="text-xs font-bold text-primary hover:underline"
                        >
                            {purchasePrice ? "Modifier" : "Ajouter un prix"}
                        </button>
                    )}
                </div>

                {isEditingPurchase ? (
                    <div className="flex items-center gap-3 animate-in fade-in">
                        <div className="relative">
                            <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                placeholder="0.00"
                                value={purchaseValue}
                                onChange={(e) => setPurchaseValue(e.target.value)}
                                className="w-32 p-2 pl-3 rounded border border-border bg-background font-bold focus:ring-2 focus:ring-primary outline-none"
                                autoFocus
                            />
                            <span className="absolute right-3 top-2 text-muted font-bold">EUR</span>
                        </div>
                        <button 
                            onClick={handleSavePurchasePrice} 
                            disabled={isSaving} 
                            className="bg-primary text-primary-foreground py-2 px-4 rounded-lg text-sm font-bold"
                        >
                            {isSaving ? '...' : 'OK'}
                        </button>
                        <button 
                            onClick={() => setIsEditingPurchase(false)} 
                            className="text-muted hover:text-foreground text-sm px-2"
                        >
                            Annuler
                        </button>
                    </div>
                ) : (
                    <div>
                        {purchasePrice ? (
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-xs text-muted uppercase tracking-wider">Acquis pour</p>
                                    <p className="text-xl font-bold text-foreground">{purchasePrice.toFixed(2)} EUR</p>
                                </div>
                                {profitLoss !== null && (
                                    <div className={`px-3 py-1 rounded-lg border ${profitLoss >= 0 ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'}`}>
                                        <p className="text-xs font-bold uppercase">{profitLoss >= 0 ? 'Plus-value' : 'Moins-value'}</p>
                                        <p className="font-bold">
                                            {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} EUR 
                                            <span className="opacity-70 ml-1">
                                                ({profitLoss >= 0 ? '+' : ''}{profitLossPercent?.toFixed(1)}%)
                                            </span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-muted italic text-sm">Aucune donnée d&apos;achat enregistrée.</p>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-secondary/10">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <span className="bg-secondary text-muted p-1 rounded">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </span>
                        Données du Marché (Scryfall)
                    </h2>
                </div>

                <div className="divide-y divide-border">
                    {hasNonFoilVersion && (
                        <div className="px-6 py-4 grid grid-cols-3 items-center hover:bg-secondary/5 transition-colors">
                            <div className="justify-self-start">
                                <span className="text-sm font-bold text-foreground bg-secondary/50 px-2 py-1 rounded">Normal</span>
                            </div>
                            <div className={`justify-self-center text-lg font-bold ${priceNormal ? 'text-success' : 'text-muted italic'}`}>
                                {priceNormal || 'N/A'}
                            </div>
                            <div className="justify-self-end">
                                <a 
                                    href={getPreciseUrl(false)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 font-bold"
                                >
                                    Acheter
                                </a>
                            </div>
                        </div>
                    )}

                    {hasFoilVersion && (
                        <div className="px-6 py-4 grid grid-cols-3 items-center hover:bg-secondary/5 transition-colors">
                            <div className="justify-self-start">
                                <span className="text-sm font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 flex items-center gap-1">
                                    Foil
                                </span>
                            </div>
                            <div className={`justify-self-center text-lg font-bold ${priceFoil ? 'text-purple-600' : 'text-muted italic'}`}>
                                {priceFoil || 'N/A'}
                            </div>
                            <div className="justify-self-end">
                                <a 
                                    href={getPreciseUrl(true)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-amber-700 hover:text-amber-900 font-bold"
                                >
                                    Acheter
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- CONTENU DE LA PAGE ---
function CardDetailContent({ params }: CardDetailPageProps) {
    const { user } = useAuth();
    const router = useRouter();
    const unwrappedParams = use(params);
    const cardId = unwrappedParams.id;
    const searchParams = useSearchParams();
    
    // GESTION RETOUR INTELLIGENTE
    const returnTo = searchParams.get('returnTo');
    const handleBack = () => {
        if (returnTo) {
            router.push(decodeURIComponent(returnTo));
        } else {
            router.back();
        }
    };

    const { cards: collectionCards, loading: collectionLoading } = useCardCollection('collection'); 
    
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
        if (!user) { setLoading(false); return; }

        const liveCard = collectionCards.find(c => c.id === cardId);

        if (liveCard) {
            setCard(liveCard);
            setLoading(false);
        } else if (!collectionLoading) {
            const fetchFallback = async () => {
                setLoading(true);
                try {
                    const snap = await getDoc(doc(db, 'users', user.uid, 'wishlist', cardId));
                    
                    if (snap.exists()) {
                        setCard({ id: snap.id, ...snap.data(), uid: user.uid } as CardType); 
                    } else {
                        try {
                            const scryRes = await fetch(`https://api.scryfall.com/cards/${cardId}`);
                            if (scryRes.ok) {
                                const scryData = await scryRes.json();
                                const normalized = normalizeCardData(scryData);
                                setCard({ ...normalized, quantity: 0, uid: '', wishlistId: undefined, isFoil: false, isSpecificVersion: false, quantityForTrade: 0 } as CardType);
                            }
                        } catch (errScry) { console.error(errScry); }
                    }
                } catch (e) { console.error(e); } 
                finally { setLoading(false); }
            };
            fetchFallback();
        }
    }, [user, cardId, collectionCards, collectionLoading]);

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

    const scryfallId = card ? ((card.scryfallData as ScryfallRawData)?.id || card.id) : null;
    const isOwner = useMemo(() => {
        if (!user || !card) return false;
        if (!!card.uid && user.uid === card.uid) return true;
        if (collectionMap.has(card.id)) return true;
        if (scryfallId) {
            return Array.from(collectionMap.values()).some(c => {
                const cScryId = (c.scryfallData as ScryfallRawData)?.id;
                return cScryId === scryfallId;
            });
        }
        return false;
    }, [user, card, collectionMap, scryfallId]);

    if (!user) return <div className="p-10 text-center text-muted">Connectez-vous pour voir les détails.</div>;
    if (loading) return <div className="p-10 text-center text-muted animate-pulse">Chargement des détails...</div>;
    if (!card) return <div className="p-10 text-center text-danger">Carte introuvable.</div>;

    const displayData = card.scryfallData 
        ? normalizeCardData(card.scryfallData as ScryfallRawData)
        : { 
            name: card.name, 
            imageUrl: card.imageUrl, 
            imageBackUrl: card.imageBackUrl, 
            setName: card.setName, 
            setCode: card.setCode,
            price: card.price
        };

    const { name, imageUrl, imageBackUrl, setName } = displayData;
    const isDoubleSided = !!imageBackUrl;
    const oracleId = (card.scryfallData as ScryfallRawData)?.oracle_id as string | undefined;
    const displayImage = isFlipped && imageBackUrl ? imageBackUrl : imageUrl;
    
    return (
        <main className="container mx-auto p-4 max-w-6xl min-h-[80vh]">
            <div className="mb-6 flex justify-between items-center">
                <button 
                    onClick={handleBack} 
                    className="text-sm text-primary hover:underline font-bold flex items-center gap-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Retour
                </button>
                {oracleId && (
                     <button
                        onClick={() => setShowAllVersions(!showAllVersions)}
                        className="bg-secondary hover:bg-border text-foreground px-4 py-2 rounded-lg text-sm font-bold transition"
                     >
                        {showAllVersions ? 'Afficher les Détails' : 'Voir toutes les Éditions'}
                     </button>
                )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8 border-b border-border pb-4">
                {name}
            </h1>

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
                            className="w-full max-w-sm aspect-[2.5/3.5] rounded-[4.5%] overflow-hidden shadow-2xl ring-4 ring-primary/20 cursor-pointer relative"
                            onClick={() => isDoubleSided && setIsFlipped(!isFlipped)}
                        >
                            <Image 
                                src={displayImage} 
                                alt={name} 
                                fill 
                                className="object-cover" 
                                sizes="(max-width: 768px) 100vw, 400px" 
                                priority 
                            />
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
                                <p className="text-xs text-success font-bold mt-1 uppercase tracking-widest">
                                    ✓ En Collection
                                </p>
                            ) : (
                                <p className="text-sm text-muted italic mt-1">Non possédée</p>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-6">
                        {isOwner && <DualQuantityManager card={card} />}
                        <CardMainDetails cardData={card} />
                    </div>
                </div>
            )}
        </main>
    );
}

// --- PAGE EXPORT ---
export default function CardDetailPage(props: CardDetailPageProps) {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted">Chargement...</div>}>
            <CardDetailContent {...props} />
        </Suspense>
    );
}