// components/magic-card/CardTags.tsx
'use client';

type Props = {
    isWishlist?: boolean;
    readOnly?: boolean;
    isSelectMode?: boolean;
    isFoil?: boolean;
    isSpecificVersion?: boolean;
    onToggleAttribute?: (field: 'isFoil' | 'isSpecificVersion', val: boolean) => void;
    onMove?: () => void;
};

export default function CardTags({
    isWishlist, readOnly, isSelectMode, isFoil = false, isSpecificVersion = false,
    onToggleAttribute, onMove
}: Props) {
    
    // Helper pour gérer le clic proprement
    const handleToggle = (e: React.MouseEvent, field: 'isFoil' | 'isSpecificVersion', currentValue: boolean) => {
        e.stopPropagation();
        if (onToggleAttribute) {
            // CORRECTION ICI : On passe la valeur ACTUELLE (currentValue).
            // Votre hook useCardCollection fait `!value`, donc on lui donne la valeur brute.
            onToggleAttribute(field, currentValue); 
        }
    };

    return (
        <div className={`flex flex-wrap gap-1 mb-auto ${isSelectMode ? 'pointer-events-none opacity-50' : ''}`}>
            
            {/* CAS 1: COLLECTION (Badge non cliquable) */}
            {!isWishlist && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-1 text-center ${
                    isFoil 
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' 
                    : 'bg-secondary text-muted border-transparent'
                }`}>
                    {isFoil ? 'Foil' : 'Normal'}
                </span>
            )}

            {/* CAS 2: WISHLIST (Boutons cliquables) */}
            {isWishlist && onToggleAttribute && (
                <>
                    <button 
                        type="button"
                        onClick={(e) => handleToggle(e, 'isFoil', isFoil)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors font-medium flex-1 text-center ${
                            isFoil ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'bg-secondary text-muted border-transparent hover:bg-border'
                        }`}
                    >
                        {isFoil ? 'Foil' : 'Normal'}
                    </button>
                    
                    <button 
                        type="button"
                        onClick={(e) => handleToggle(e, 'isSpecificVersion', isSpecificVersion)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors font-medium flex-1 text-center ${
                            isSpecificVersion ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary text-muted border-transparent'
                        }`}
                    >
                        {isSpecificVersion ? 'Exact' : 'Auto'}
                    </button>
                </>
            )}
            
            {/* BOUTON MOVE (Acheter) */}
            {isWishlist && !readOnly && !isSelectMode && onMove && (
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onMove(); }}
                    className="text-[9px] px-1.5 py-0.5 rounded border transition-colors font-bold flex-1 text-center bg-surface text-success border-success/30 hover:bg-success/5"
                    title="J'ai reçu cette carte"
                >
                    Acheté
                </button>
            )}
        </div>
    );
}