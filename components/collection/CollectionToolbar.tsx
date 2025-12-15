// components/collection/CollectionToolbar.tsx
'use client';

import DeleteAllButton from '@/components/DeleteAllButton';

interface CollectionToolbarProps {
    isSelectMode: boolean;
    setIsSelectMode: (val: boolean) => void;
    onOpenTools: () => void;
    onOpenHub: () => void;
}

export default function CollectionToolbar({
    isSelectMode,
    setIsSelectMode,
    onOpenTools,
    onOpenHub,
}: CollectionToolbarProps) {

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
                        <button 
                            onClick={onOpenTools}
                            className="shrink-0 bg-surface hover:bg-secondary text-foreground px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm border border-border flex items-center gap-2 whitespace-nowrap"
                        >
                            Gérer
                        </button>

                        <div className="shrink-0">
                            <DeleteAllButton targetCollection="collection" />
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