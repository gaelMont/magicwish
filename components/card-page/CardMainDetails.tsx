// components/card-page/CardMainDetails.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CardType } from '@/hooks/useCardCollection';
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

type Props = {
    card: CardType;
    showAllVersions: boolean;
    setShowAllVersions: (val: boolean) => void;
    backLink: string;
};

// Interface locale pour typer le champ finishes
interface ScryfallWithFinishes {
    finishes?: string[];
    purchase_uris?: { cardmarket?: string };
    oracle_id?: string;
    type_line?: string;
    oracle_text?: string;
    flavor_text?: string;
    collector_number?: string;
}

export default function CardMainDetails({ 
    card, 
    showAllVersions, 
    setShowAllVersions, 
    backLink 
}: Props) {
    const { user } = useAuth();
    
    // --- ETATS LOCAUX ---
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEditingPurchase, setIsEditingPurchase] = useState(false);
    const [purchaseValue, setPurchaseValue] = useState<string>(card.purchasePrice?.toString() || "");
    const [isSaving, setIsSaving] = useState(false);

    // --- PREPARATION DONNEES AFFICHAGE ---
    const rawScryData = card.scryfallData as ScryfallRawData | null;
    // Conversion sécurisée pour accéder aux champs optionnels
    const detailedData = rawScryData as unknown as ScryfallWithFinishes | null;
    
    const displayData = rawScryData 
        ? normalizeCardData(rawScryData) 
        : {
            name: card.name,
            imageUrl: card.imageUrl,
            imageBackUrl: card.imageBackUrl,
            setName: card.setName,
            setCode: card.setCode,
            price: card.customPrice ?? card.price ?? 0,
            scryfallData: null
        };

    const displayName = displayData.name;
    const currentImage = (isFlipped && displayData.imageBackUrl) ? displayData.imageBackUrl : displayData.imageUrl;
    const isDoubleSided = !!displayData.imageBackUrl;
    
    // --- VERIFICATION DES FINITIONS ---
    const finishes = detailedData?.finishes || [];
    // Si pas d'info (carte manuelle), on suppose que tout existe par défaut
    const hasNonFoil = finishes.length === 0 || finishes.includes('nonfoil');
    const hasFoil = finishes.length === 0 || finishes.includes('foil') || finishes.includes('etched');

    // --- ACCÈS SÉCURISÉ AUX CHAMPS ---
    const oracleId = detailedData?.oracle_id;
    const typeLine = detailedData?.type_line;
    const oracleText = detailedData?.oracle_text;
    const flavorText = detailedData?.flavor_text;
    const collectorNumber = detailedData?.collector_number; 

    // --- CALCULS FINANCIERS ---
    const currentPrice = displayData.price;
    const purchasePrice = card.purchasePrice;
    let profitLoss = null;
    let profitLossPercent = null;
    
    if (purchasePrice !== undefined && purchasePrice > 0 && currentPrice > 0) {
        profitLoss = currentPrice - purchasePrice;
        profitLossPercent = (profitLoss / purchasePrice) * 100;
    }

    // --- LOGIQUE SAUVEGARDE PRIX ---
    const handleSavePurchasePrice = async () => {
        if (!user) return;
        const val = parseFloat(purchaseValue);
        const finalVal = isNaN(val) ? 0 : val;

        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid, 'collection', card.id), { 
                purchasePrice: finalVal > 0 ? finalVal : 0 
            });
            toast.success("Historique mis à jour !");
            setIsEditingPurchase(false);
        } catch (error) {
            console.error(error);
            toast.error("Erreur sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- LIENS CARDMARKET ---
    const baseCardmarketUrl = detailedData?.purchase_uris?.cardmarket 
        || `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(displayName)}`;

    const getPreciseUrl = (isFoilVersion: boolean) => {
        const separator = baseCardmarketUrl.includes('?') ? '&' : '?';
        return `${baseCardmarketUrl}${separator}isFoil=${isFoilVersion ? 'Y' : 'N'}`;
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* --- COLONNE GAUCHE : VISUEL --- */}
            <div className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-4">
                <div className="relative aspect-[2.5/3.5] w-full max-w-sm mx-auto bg-secondary rounded-xl shadow-2xl overflow-hidden group">
                    <Image
                        src={currentImage}
                        alt={displayName}
                        fill
                        priority
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 300px"
                    />
                    
                    {card.isFoil && (
                        <div className="absolute top-4 right-4 bg-amber-500/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm border border-amber-400/50 z-10">
                            FOIL
                        </div>
                    )}

                    {isDoubleSided && (
                        <button
                            type="button"
                            onClick={() => setIsFlipped(!isFlipped)}
                            className="absolute bottom-4 right-4 bg-black/60 text-white p-3 rounded-full hover:bg-black/80 transition backdrop-blur-md border border-white/10 z-20"
                            title="Retourner la carte"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* --- COLONNE DROITE : DETAILS & GESTION --- */}
            <div className="flex-1 space-y-6">
                
                {/* 1. EN-TÊTE */}
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-3xl md:text-4xl font-black text-foreground leading-tight">{displayName}</h2>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <Link href={backLink} className="text-sm font-medium text-muted hover:text-primary transition flex items-center gap-1">
                                ← Retour
                            </Link>
                            {oracleId && (
                                <button 
                                    type="button"
                                    onClick={() => setShowAllVersions(!showAllVersions)}
                                    className="text-primary hover:text-primary/80 font-semibold text-sm underline-offset-4 hover:underline transition-colors"
                                >
                                    {showAllVersions ? 'Masquer versions' : 'Autres versions'}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-lg text-muted-foreground">
                        <span className="bg-secondary dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono border border-border uppercase">
                            {displayData.setCode}
                        </span>
                        <span>{displayData.setName}</span>
                        {collectorNumber && <span className="text-sm opacity-60">#{collectorNumber}</span>}
                    </div>
                </div>

                {/* 2. BLOC FINANCIER (PRIX & ACHAT) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bloc Prix Actuel */}
                    <div className="bg-surface dark:bg-gray-800 p-5 rounded-xl border border-border dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Valeur Marché</p>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-3xl font-bold text-success">{currentPrice.toFixed(2)} €</span>
                            {card.isFoil && <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-800">FOIL</span>}
                        </div>
                        
                        {/* LIENS CARDMARKET CONDITIONNELS */}
                        <div className="flex gap-2 mt-auto pt-2">
                            {hasNonFoil && (
                                <a href={getPreciseUrl(false)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                    Acheter Normal ↗
                                </a>
                            )}
                            
                            {hasNonFoil && hasFoil && (
                                <div className="w-px bg-border dark:bg-gray-700 h-4"></div>
                            )}
                            
                            {hasFoil && (
                                <a href={getPreciseUrl(true)} target="_blank" rel="noreferrer" className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                                    Acheter Foil ↗
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Bloc Historique Achat */}
                    <div className="bg-surface dark:bg-gray-800 p-5 rounded-xl border border-border dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-muted uppercase tracking-wider">Mon Achat</p>
                            {!isEditingPurchase && (
                                <button onClick={() => setIsEditingPurchase(true)} className="text-xs font-bold text-primary hover:underline">
                                    {purchasePrice ? "Modifier" : "Définir"}
                                </button>
                            )}
                        </div>

                        {isEditingPurchase ? (
                            <div className="flex items-center gap-2 mt-1">
                                <input 
                                    type="number" step="0.01" placeholder="0.00" autoFocus
                                    value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)}
                                    className="w-24 p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                                <button onClick={handleSavePurchasePrice} disabled={isSaving} className="bg-primary text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-primary/90">OK</button>
                                <button onClick={() => setIsEditingPurchase(false)} className="text-muted text-xs hover:text-foreground">X</button>
                            </div>
                        ) : (
                            <div>
                                {purchasePrice ? (
                                    <>
                                        <p className="text-xl font-bold text-foreground mb-1">{purchasePrice.toFixed(2)} €</p>
                                        {profitLoss !== null && (
                                            <p className={`text-xs font-bold ${profitLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                                                {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} € ({profitLoss >= 0 ? '+' : ''}{profitLossPercent?.toFixed(0)}%)
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-muted italic mt-1">Non renseigné</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. DETAILS TECHNIQUES (Oracle) */}
                {rawScryData && (
                    <div className="space-y-4 text-foreground/90 pt-2">
                        {typeLine && (
                            <div className="border-l-4 border-primary/50 pl-4 py-1">
                                <p className="font-bold text-lg text-foreground">{typeLine}</p>
                            </div>
                        )}
                        {oracleText && (
                            <div className="bg-secondary/30 dark:bg-gray-800/50 p-4 rounded-lg border border-border dark:border-gray-700 font-serif text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                                {oracleText}
                            </div>
                        )}
                        {flavorText && (
                            <p className="text-sm italic text-muted-foreground border-l-2 border-border dark:border-gray-700 pl-4">
                                {flavorText}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}