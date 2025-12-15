// components/search/SearchToolbar.tsx
'use client';

interface SearchToolbarProps {
    isSelectMode: boolean;
    setIsSelectMode: (val: boolean) => void;
    totalResults: number;
}

export default function SearchToolbar({
    isSelectMode,
    setIsSelectMode,
    totalResults
}: SearchToolbarProps) {
    if (totalResults === 0) return null;

    return (
        <div className="flex flex-col gap-4 mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
                
                <button 
                    onClick={() => setIsSelectMode(!isSelectMode)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm border flex items-center gap-2 whitespace-nowrap ${isSelectMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface hover:bg-secondary text-foreground border-border'}`}
                >
                    {isSelectMode ? 'Annuler la sélection' : 'Sélectionner'}
                </button>

                {!isSelectMode && (
                    <span className="text-xs text-muted ml-auto">
                        {totalResults} résultat(s)
                    </span>
                )}
            </div>
        </div>
    );
}