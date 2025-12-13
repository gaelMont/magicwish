// components/card-page/CardMainDetails.tsx
'use client';

import { CardType } from '@/hooks/useCardCollection';
import { ScryfallRawData } from '@/lib/cardUtils';

export default function CardMainDetails({ cardData }: { cardData: CardType }) {
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

            {/* Liens externes - NETTOYÉ */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
                <h2 className="text-xl font-bold text-foreground mb-4">Outils</h2>
                <div className="flex flex-col gap-3">
                    <a 
                        href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${cardData.name}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn-primary text-xs py-3 text-center w-full"
                    >
                        Voir sur Cardmarket
                    </a>
                </div>
            </div>
        </div>
    );
}