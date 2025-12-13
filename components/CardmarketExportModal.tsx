// components/CardmarketExportModal.tsx
'use client';

import { CardType } from '@/hooks/useCardCollection';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    cards: CardType[];
    listName: string;
};

// Fonction de formatage au standard Cardmarket (Plain Text Import)
const formatForCardmarket = (cards: CardType[]): string => {
    return cards
        .map(card => {
            // Le format requis est généralement : Qty Name (Set Code) [Foil]
            const qty = card.quantity;
            const name = card.name.split(' // ')[0].trim(); // Retire la double face si présente
            const setCode = card.setCode?.toUpperCase() || '';
            const foilTag = card.isFoil ? ' Foil' : '';

            // Format standard avec code d'édition entre parenthèses
            return `${qty} ${name} (${setCode})${foilTag}`;
        })
        .join('\n');
};

export default function CardmarketExportModal({ isOpen, onClose, cards, listName }: Props) {
    
    // Le texte formaté est calculé une seule fois
    const exportText = useMemo(() => formatForCardmarket(cards), [cards]);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(exportText);
        setCopied(true);
        toast.success("Texte copié ! Vous pouvez coller dans Cardmarket.");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-surface rounded-xl p-6 max-w-lg w-full shadow-2xl border border-border flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <h2 className="text-xl font-bold text-foreground mb-4">
                    Exporter : {listName}
                </h2>
                
                <p className="text-sm text-muted mb-4">
                    Copiez le texte ci-dessous et collez-le dans l&apos;outil **Plain Text Import** de Cardmarket pour ajouter vos cartes.
                </p>

                {/* Champ de texte avec le contenu exporté */}
                <textarea
                    readOnly
                    value={exportText}
                    rows={10}
                    className="w-full p-3 mb-4 rounded-lg border border-border bg-background text-foreground font-mono text-xs resize-none"
                />

                <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">{cards.length} cartes préparées.</span>
                    <button
                        onClick={handleCopy}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition shadow-md ${
                            copied ? 'bg-success text-white' : 'btn-primary'
                        }`}
                    >
                        {copied ? '✅ Copié !' : '📋 Copier le texte'}
                    </button>
                </div>
            </div>
        </div>
    );
}