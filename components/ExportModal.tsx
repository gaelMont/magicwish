// components/ExportModal.tsx
'use client';

import { CardType } from '@/hooks/useCardCollection';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import Papa from 'papaparse'; 

type ExportType = 'text' | 'csv';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    cards: CardType[];
    listName: string;
    targetType: 'collection' | 'wishlist';
    onGoBack: () => void; 
    onCloseAll: () => void; 
};

// Fonction de formatage TXT (Plain Text Import Cardmarket compatible)
const formatToText = (cards: CardType[]): string => {
    return cards
        .map(card => {
            const qty = card.quantity;
            const name = card.name.split(' // ')[0].trim();
            const setCode = card.setCode?.toUpperCase() || '';
            const foilTag = card.isFoil ? ' Foil' : '';

            // Format: Qty Name (Set Code) [Foil]
            return `${qty} ${name} (${setCode})${foilTag}`;
        })
        .join('\n');
};

// Fonction de formatage CSV (avec plus de détails)
const formatToCsvData = (cards: CardType[]) => {
    const rows = cards.map(card => ({
        "Quantity": card.quantity.toString(),
        "Name": card.name.split(' // ')[0].trim(),
        "Set Code": card.setCode?.toUpperCase() || '',
        "Foil": card.isFoil ? 'True' : 'False',
        "Price (€)": (card.customPrice ?? card.price ?? 0).toFixed(2),
        "Tradeable": (card.quantityForTrade ?? 0).toString(),
        "Last Price Update": card.lastPriceUpdate ? new Date(card.lastPriceUpdate).toISOString() : '',
        "Scryfall ID": card.id
    }));

    return { rows };
}


export default function ExportModal({ isOpen, cards, listName, targetType, onGoBack, onCloseAll }: Props) {
    
    const [exportFormat, setExportFormat] = useState<ExportType>('text');
    const [copied, setCopied] = useState(false);

    const exportText = useMemo(() => {
        if (exportFormat === 'text') {
            return formatToText(cards);
        }
        return '';
    }, [cards, exportFormat]);

    if (!isOpen) return null;

    const handleCopyOrDownload = () => {
        if (cards.length === 0) {
            toast.error("La liste est vide !");
            return;
        }

        if (exportFormat === 'text') {
            navigator.clipboard.writeText(exportText);
            setCopied(true);
            toast.success("Texte copié ! Vous pouvez coller dans Cardmarket.");
            setTimeout(() => setCopied(false), 2000);
        } else {
            const { rows } = formatToCsvData(cards);
            const csv = Papa.unparse(rows, { header: true, delimiter: ',' });
            
            const filename = `${listName.replace(/\s/g, '_')}_export.csv`;
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            link.click();
            
            toast.success("Fichier CSV téléchargé !");
        }
    };
    
    const instructions = exportFormat === 'text'
        ? "Copiez le texte ci-dessous pour le coller dans l'outil 'Plain Text Import' de Cardmarket."
        : "Le fichier CSV est plus détaillé, idéal pour Excel ou la sauvegarde.";

    const targetLabel = targetType === 'collection' ? 'Collection' : 'Wishlist';

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onGoBack}>
            <div className="bg-surface rounded-xl p-6 max-w-lg w-full shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                        <button onClick={onGoBack} className="text-muted hover:text-foreground text-xl p-1 rounded transition">←</button>
                        <h2 className="text-xl font-bold text-foreground">
                            📤 Exporter : {targetLabel}
                        </h2>
                    </div>
                    <button onClick={onCloseAll} className="text-muted hover:text-danger text-lg p-2">✕</button>
                </div>
                
                <p className="text-sm text-muted mb-4">{instructions}</p>
                
                {/* Sélecteur de format */}
                <div className="flex justify-center p-1 mb-4 bg-background rounded-lg border border-border">
                    <button 
                        onClick={() => setExportFormat('text')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${exportFormat === 'text' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-secondary'}`}
                    >
                        Texte (Copier/Coller)
                    </button>
                    <button 
                        onClick={() => setExportFormat('csv')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${exportFormat === 'csv' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-secondary'}`}
                    >
                        CSV (Fichier)
                    </button>
                </div>

                {/* Prévisualisation ou confirmation de téléchargement */}
                {exportFormat === 'text' && (
                    <textarea
                        readOnly
                        value={exportText}
                        rows={10}
                        className="w-full p-3 mb-4 rounded-lg border border-border bg-background text-foreground font-mono text-xs resize-none grow"
                    />
                )}
                {exportFormat === 'csv' && (
                    <div className="bg-secondary p-4 mb-4 rounded-lg text-center text-sm font-medium border border-border grow flex items-center justify-center">
                        Prêt à télécharger **{cards.length} cartes** au format CSV.
                    </div>
                )}


                <div className="flex justify-between items-center flex-none">
                    <span className="text-xs text-muted">{cards.length} cartes préparées.</span>
                    <button
                        onClick={handleCopyOrDownload}
                        disabled={cards.length === 0}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition shadow-md disabled:opacity-50 ${
                            exportFormat === 'text' 
                                ? (copied ? 'bg-success text-white' : 'btn-primary')
                                : 'bg-primary text-primary-foreground hover:opacity-90'
                        }`}
                    >
                        {exportFormat === 'text' ? (copied ? '✅ Copié !' : '📋 Copier le texte') : '⬇️ Télécharger CSV'}
                    </button>
                </div>
            </div>
        </div>
    );
}