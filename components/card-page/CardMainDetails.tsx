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

    // Valeur affichée (Scryfall est prioritaire dans la collection)
    const currentPrice = cardData.price ?? 0;
    const hasPrice = currentPrice > 0;
    
    // Calcul de la plus-value potentielle
    const purchasePrice = cardData.purchasePrice;
    let profitLoss = null;
    let profitLossPercent = null;
    
    if (purchasePrice !== undefined && purchasePrice > 0 && hasPrice) {
        profitLoss = currentPrice - purchasePrice;
        profitLossPercent = (profitLoss / purchasePrice) * 100;
    }

    const scryfallRaw = cardData.scryfallData as ScryfallRawData | undefined;
    const prices = scryfallRaw?.prices;

    // --- SAUVEGARDE PRIX D'ACHAT ---
    const handleSavePurchasePrice = async () => {
        if (!user) return;
        const val = parseFloat(purchaseValue);
        
        // On autorise 0 ou vide pour effacer
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

    const formatScryfallPrice = (val?: string) => {
        if (!val) return <span className="text-muted italic">N/A</span>;
        const num = parseFloat(val);
        return num > 0 ? `${num.toFixed(2)} €` : <span className="text-muted italic">N/A</span>;
    };

    if (!scryfallRaw) return <p className="text-muted">Détails non disponibles.</p>;

    return (
        <div className="space-y-6">
            
            {/* BLOC PRINCIPAL : VALEUR ACTUELLE */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-md">
                <h2 className="text-xl font-bold text-primary mb-4">Valeur Actuelle</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-muted font-bold uppercase mb-1">Prix du Marché (Scryfall)</p>
                        <p className={`text-4xl font-black ${hasPrice ? 'text-foreground' : 'text-muted'}`}>
                            {hasPrice ? `${currentPrice.toFixed(2)} €` : "N/A"}
                        </p>
                        <p className="text-xs text-muted mt-2">
                            Mise à jour : {cardData.lastPriceUpdate ? new Date(cardData.lastPriceUpdate).toLocaleDateString() : 'Inconnue'}
                        </p>
                    </div>

                    <div className="flex flex-col justify-center border-l border-border pl-6 border-dashed">
                        <p className="text-sm text-muted font-bold uppercase mb-1">Votre Version</p>
                        <p className="text-lg font-medium text-foreground">
                            {cardData.isFoil ? '✨ Foil' : 'Normal'} 
                        </p>
                        
                        <div className="mt-4">
                            <p className="text-sm text-muted font-bold uppercase mb-1">Disponibilité</p>
                            {cardData.quantityForTrade > 0 ? (
                                <p className="text-success font-bold flex items-center gap-2">
                                    ✅ {cardData.quantityForTrade} à l&apos;échange
                                </p>
                            ) : (
                                <p className="text-muted italic flex items-center gap-2">
                                    🔒 Collection Privée
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* BLOC HISTORIQUE (PRIX D'ACHAT) */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-foreground">Historique d&apos;Acquisition</h2>
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
                        <button onClick={handleSavePurchasePrice} className="btn-primary py-2 px-4 text-sm">OK</button>
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

            {/* TABLEAU PRIX SCRYFALL */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-lg font-bold text-foreground mb-4 opacity-80">Référence du marché (Scryfall)</h2>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-border text-muted">
                            <th className="py-2 font-normal">Finition</th>
                            <th className="py-2 font-normal">Prix Moyen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-border/50">
                            <td className="py-3 font-medium">Non-Foil</td>
                            <td className="py-3 text-success font-bold tracking-wide">{formatScryfallPrice(prices?.eur)}</td>
                        </tr>
                        <tr>
                            <td className="py-3 font-medium">Foil</td>
                            <td className="py-3 text-purple-600 font-bold tracking-wide">{formatScryfallPrice(prices?.eur_foil)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* LIENS */}
            <div className="flex flex-col gap-3">
                <a 
                    href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(cardData.name)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-center gap-2 bg-[#0b2f4f] hover:bg-[#164e80] text-white py-3 px-4 rounded-lg font-bold transition shadow-sm"
                >
                    🔍 Voir sur Cardmarket
                </a>
            </div>
        </div>
    );
}