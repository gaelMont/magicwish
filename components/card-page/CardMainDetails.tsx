// components/card-page/CardMainDetails.tsx
'use client';

import { useState } from 'react';
import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function CardMainDetails({ cardData }: { cardData: CardType }) {
    const { user } = useAuth();
    
    // État pour l'édition du prix d'achat
    const [isEditingPurchase, setIsEditingPurchase] = useState(false);
    const [purchaseValue, setPurchaseValue] = useState<string>(
        cardData.purchasePrice?.toString() || ""
    );
    const [isSaving, setIsSaving] = useState(false);

    // Données pour le calcul de plus-value
    const currentPrice = cardData.price ?? 0;
    const hasPrice = currentPrice > 0;
    
    const purchasePrice = cardData.purchasePrice;
    let profitLoss = null;
    let profitLossPercent = null;
    
    if (purchasePrice !== undefined && purchasePrice > 0 && hasPrice) {
        profitLoss = currentPrice - purchasePrice;
        profitLossPercent = (profitLoss / purchasePrice) * 100;
    }

    const scryfallRaw = cardData.scryfallData as ScryfallRawData | undefined;
    const prices = scryfallRaw?.prices;

    // --- LOGIQUE DE LIEN PRÉCIS (CARDMARKET) ---
    // 1. On récupère le lien 'purchase_uris' qui pointe vers la page produit exacte (Singles/Set/Card)
    const purchaseUris = (scryfallRaw as unknown as { purchase_uris?: { cardmarket?: string } })?.purchase_uris;
    
    // 2. Si pas de lien Scryfall (rare), on construit un lien de recherche
    const baseCardmarketUrl = purchaseUris?.cardmarket 
        || `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(cardData.name)}`;

    // 3. Fonction pour ajouter proprement ?isFoil=Y ou &isFoil=Y
    const getPreciseUrl = (isFoilVersion: boolean) => {
        // On vérifie si l'URL contient déjà un '?' (ce qui est le cas des liens Scryfall qui ont des UTM)
        const separator = baseCardmarketUrl.includes('?') ? '&' : '?';
        const param = isFoilVersion ? 'isFoil=Y' : 'isFoil=N';
        return `${baseCardmarketUrl}${separator}${param}`;
    };

    // --- SAUVEGARDE PRIX D'ACHAT ---
    const handleSavePurchasePrice = async () => {
        if (!user) return;
        const val = parseFloat(purchaseValue);
        const finalVal = isNaN(val) ? 0 : val;

        setIsSaving(true);
        try {
            const cardRef = doc(db, 'users', user.uid, 'collection', cardData.id);
            await updateDoc(cardRef, { 
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

    const formatPrice = (val?: string) => {
        if (!val) return null;
        const num = parseFloat(val);
        return num > 0 ? `${num.toFixed(2)} €` : null;
    };

    if (!scryfallRaw) return <p className="text-muted">Détails non disponibles.</p>;

    const priceNormal = formatPrice(prices?.eur);
    const priceFoil = formatPrice(prices?.eur_foil);

    return (
        <div className="space-y-6">
            
            {/* BLOC 1 : HISTORIQUE (PRIX D'ACHAT) */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <span className="bg-primary/10 text-primary p-1 rounded">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                        Historique d&apos;Acquisition
                    </h2>
                    {!isEditingPurchase && (
                        <button 
                            onClick={() => {
                                setPurchaseValue(cardData.purchasePrice?.toString() || "");
                                setIsEditingPurchase(true);
                            }}
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
                            <span className="absolute right-3 top-2 text-muted font-bold">€</span>
                        </div>
                        <button onClick={handleSavePurchasePrice} disabled={isSaving} className="btn-primary py-2 px-4 text-sm">
                            {isSaving ? '...' : 'OK'}
                        </button>
                        <button onClick={() => setIsEditingPurchase(false)} className="text-muted hover:text-foreground text-sm px-2">Annuler</button>
                    </div>
                ) : (
                    <div>
                        {purchasePrice ? (
                            <div className="flex items-center gap-6">
                                <div>
                                    <p className="text-xs text-muted uppercase">Acquis pour</p>
                                    <p className="text-xl font-bold text-foreground">{purchasePrice.toFixed(2)} €</p>
                                </div>
                                {profitLoss !== null && (
                                    <div className={`px-3 py-1 rounded-lg border ${profitLoss >= 0 ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'}`}>
                                        <p className="text-xs font-bold uppercase">{profitLoss >= 0 ? 'Plus-value' : 'Moins-value'}</p>
                                        <p className="font-bold">
                                            {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} € 
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

            {/* BLOC 2 : MARCHÉ ET LIENS (FUSIONNÉ ET ALIGNÉ SUR 3 COLONNES) */}
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-secondary/10">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <span className="bg-secondary text-muted p-1 rounded">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        </span>
                        Données du Marché (Scryfall)
                    </h2>
                </div>

                <div className="divide-y divide-border">
                    
                    {/* LIGNE NORMALE (GRILLE 3 COLONNES) */}
                    <div className="px-6 py-4 grid grid-cols-3 items-center hover:bg-secondary/5 transition-colors">
                        {/* 1. TYPE */}
                        <div className="justify-self-start">
                            <span className="text-sm font-bold text-foreground bg-secondary/50 px-2 py-1 rounded">Normal</span>
                        </div>

                        {/* 2. PRIX (Centré) */}
                        <div className={`justify-self-center text-lg font-bold ${priceNormal ? 'text-success' : 'text-muted italic'}`}>
                            {priceNormal || 'N/A'}
                        </div>
                        
                        {/* 3. LIEN (Aligné Droite avec lien précis isFoil=N) */}
                        <div className="justify-self-end">
                            <a 
                                href={getPreciseUrl(false)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition font-medium border border-transparent hover:border-blue-100"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Acheter Normal
                            </a>
                        </div>
                    </div>

                    {/* LIGNE FOIL (GRILLE 3 COLONNES) */}
                    <div className="px-6 py-4 grid grid-cols-3 items-center hover:bg-secondary/5 transition-colors">
                        {/* 1. TYPE */}
                        <div className="justify-self-start">
                            <span className="text-sm font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100">✨ Foil</span>
                        </div>

                        {/* 2. PRIX (Centré) */}
                        <div className={`justify-self-center text-lg font-bold ${priceFoil ? 'text-purple-600' : 'text-muted italic'}`}>
                            {priceFoil || 'N/A'}
                        </div>
                        
                        {/* 3. LIEN (Aligné Droite avec lien précis isFoil=Y) */}
                        <div className="justify-self-end">
                            <a 
                                href={getPreciseUrl(true)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition font-medium border border-transparent hover:border-amber-100"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Acheter Foil
                            </a>
                        </div>
                    </div>

                </div>
                
                <div className="px-6 py-2 bg-secondary/10 border-t border-border flex justify-end">
                    <p className="text-[10px] text-muted italic">
                        Mise à jour : {cardData.lastPriceUpdate ? new Date(cardData.lastPriceUpdate).toLocaleDateString() : 'Inconnue'}
                    </p>
                </div>
            </div>

        </div>
    );
}