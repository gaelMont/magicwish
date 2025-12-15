// components/wishlist/WishlistToolbar.tsx
'use client';

import DeleteAllButton from '@/components/DeleteAllButton';

interface WishlistToolbarProps {
    isSelectMode: boolean;
    setIsSelectMode: (val: boolean) => void;
    onOpenHub: () => void;
    targetListId: string;
}

export default function WishlistToolbar({
    isSelectMode,
    setIsSelectMode,
    onOpenHub,
    targetListId
}: WishlistToolbarProps) {

    return (
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
                
                {/* Mode Sélection */}
                <button 
                    onClick={() => { setIsSelectMode(!isSelectMode); }}
                    className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm border flex items-center gap-2 whitespace-nowrap ${isSelectMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface hover:bg-secondary text-foreground border-border'}`}
                >
                    {isSelectMode ? 'Annuler' : 'Sélectionner'}
                </button>

                {/* Actions (cachées en mode sélection) */}
                {!isSelectMode && (
                    <>
                        <div className="shrink-0">
                            {/* Le bouton Vider ne s'affiche pas pour la vue globale */}
                            {targetListId !== 'GLOBAL_VIEW' && (
                                <DeleteAllButton targetCollection="wishlist" />
                            )}
                        </div>
                        
                        <button 
                            onClick={onOpenHub}
                            className="btn-primary text-sm whitespace-nowrap"
                        >
                            Importer/Exporter
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}