// app/card/[id]/page.tsx
'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection'; 
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils'; 
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Imports des composants séparés
import CardMainDetails from '@/components/card-page/CardMainDetails';
import CardVersionsGrid from '@/components/card-page/CardVersionsGrid';
import DualQuantityManager from '@/components/card-page/DualQuantityManager'; // <--- IMPORT DU NOUVEAU COMPOSANT

type CardDetailPageProps = {
    params: Promise<{ id: string }>;
};

export default function CardDetailPage({ params }: CardDetailPageProps) {
    const { user } = useAuth();
    const unwrappedParams = use(params);
    const cardId = unwrappedParams.id;
    const searchParams = useSearchParams();
    
    const returnTo = searchParams.get('returnTo');
    const backLink = returnTo ? decodeURIComponent(returnTo) : '/collection';
    const backLabel = returnTo ? (returnTo.includes('user') ? 'Retour au profil' : 'Retour') : 'Retour à la collection';

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
                            } else {
                                console.error("Carte introuvable sur Scryfall");
                            }
                        } catch (errScry) { console.error("Erreur Scryfall fallback", errScry); }
                    }
                } catch (e) { console.error("Erreur chargement carte fallback", e); } 
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

    if (!user) return <div className="p-10 text-center text-muted">Connectez-vous pour voir les détails.</div>;
    if (loading) return <div className="p-10 text-center text-muted animate-pulse">Chargement des détails de la carte...</div>;
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
    
    const isOwner = (!!card.uid && user.uid === card.uid) || collectionMap.has(card.id); 
    
    return (
        <main className="container mx-auto p-4 max-w-6xl min-h-[80vh]">
            <div className="mb-6 flex justify-between items-center">
                <Link href={backLink} className="text-sm text-primary hover:underline">← {backLabel}</Link>
                {oracleId && (
                     <button
                        onClick={() => setShowAllVersions(!showAllVersions)}
                        className="bg-secondary hover:bg-border text-foreground px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2"
                     >
                        {showAllVersions ? 'Afficher les Détails' : 'Voir toutes les Éditions'}
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
                    {/* GAUCHE : IMAGE */}
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

                    {/* DROITE : DÉTAILS & ACTIONS */}
                    <div className="md:col-span-2 space-y-6">
                        {isOwner && (
                            // Utilisation du nouveau composant
                            <DualQuantityManager card={card} />
                        )}
                        <CardMainDetails cardData={card} />
                    </div>
                </div>
            )}
        </main>
    );
}