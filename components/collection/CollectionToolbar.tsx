// components/collection/CollectionToolbar.tsx
'use client';

import { useState } from 'react';
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
    // État pour afficher les options supplémentaires sur mobile
    const [showOptions, setShowOptions] = useState(false);

    return (
        <div className="flex flex-col gap-3 mb-6 w-full">
            {/* BARRE PRINCIPALE */}
            <div className="flex items-center gap-2 w-full">
                
                {/* Mode Sélection : Toujours visible */}
                <button 
                    onClick={() => { 
                        setIsSelectMode(!isSelectMode);
                        if (!isSelectMode) setShowOptions(false); // Ferme les options si on entre en sélection
                    }}
                    className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border flex items-center justify-center gap-2 ${
                        isSelectMode 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-surface hover:bg-secondary text-foreground border-border'
                    }`}
                >
                    <span>{isSelectMode ? '✕' : '✓'}</span>
                    {isSelectMode ? 'Annuler' : 'Sélectionner'}
                </button>

                {/* Bouton Toggle Options : Uniquement sur Mobile et hors mode sélection */}
                {!isSelectMode && (
                    <button 
                        onClick={() => setShowOptions(!showOptions)}
                        className={`md:hidden p-2.5 rounded-xl border transition-all ${
                            showOptions ? 'bg-primary text-white border-primary' : 'bg-surface text-foreground border-border'
                        }`}
                        title="Plus d'options"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 12h9.75M10.5 18h9.75M3 6h.008v.008H3V6Zm0 6h.008v.008H3V12Zm0 6h.008v.008H3V18Z" />
                        </svg>
                    </button>
                )}

                {/* VERSION DESKTOP : Boutons normaux */}
                {!isSelectMode && (
                    <div className="hidden md:flex items-center gap-2">
                        <button 
                            onClick={onOpenTools}
                            className="bg-surface hover:bg-secondary text-foreground px-4 py-2 rounded-xl text-sm font-bold border border-border flex items-center gap-2 transition-all"
                        >
                            Gérer
                        </button>
                        <DeleteAllButton targetCollection="collection" />
                        <button 
                            onClick={onOpenHub}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all"
                        >
                            Importer / Exporter
                        </button>
                    </div>
                )}
            </div>

            {/* VERSION MOBILE : Menu d'options escamotable */}
            {!isSelectMode && showOptions && (
                <div className="md:hidden grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                        onClick={() => { onOpenTools(); setShowOptions(false); }}
                        className="flex items-center justify-center gap-2 bg-surface border border-border p-3 rounded-xl text-xs font-bold text-foreground active:bg-secondary transition-colors"
                    >
                        Gérer la liste
                    </button>

                    <button 
                        onClick={() => { onOpenHub(); setShowOptions(false); }}
                        className="flex items-center justify-center gap-2 bg-surface border border-border p-3 rounded-xl text-xs font-bold text-foreground active:bg-secondary transition-colors"
                    >
                        Import / Export
                    </button>

                    <div className="col-span-2">
                        {/* On wrap le bouton de suppression pour qu'il prenne toute la largeur sur mobile */}
                        <div className="w-full" onClick={() => setShowOptions(false)}>
                            <DeleteAllButton targetCollection="collection" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}