'use client';

import Image from 'next/image';

const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

type Props = {
    imageUrl: string;
    imageBackUrl?: string | null;
    name: string;
    isFoil?: boolean;
    isSelectMode?: boolean;
    isSelected?: boolean;
    isFlipped: boolean;
    onFlip: () => void;
};

export default function CardImage({ 
    imageUrl, imageBackUrl, name, isFoil, 
    isSelectMode, isSelected, isFlipped, onFlip 
}: Props) {
    
    // Logique d'affichage : Si retourné et image dispo, on affiche le dos, sinon la face
    const currentImage = (isFlipped && imageBackUrl) ? imageBackUrl : imageUrl;

    return (
        <div className="relative w-full aspect-[2.5/3.5] bg-secondary rounded-lg overflow-hidden shrink-0 group/image shadow-sm border border-border/50">
            
            {/* IMAGE PRINCIPALE */}
            <Image
                src={currentImage || CARD_BACK_URL}
                alt={name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-105"
                onError={(e) => { e.currentTarget.src = CARD_BACK_URL; }}
            />
            
            {/* OVERLAY DE SÉLECTION (Prioritaire) */}
            {isSelectMode && (
                <div className="absolute inset-0 z-30 bg-black/10 flex items-start justify-end p-2 pointer-events-none">
                     <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-md ${isSelected ? 'bg-primary border-primary scale-110' : 'bg-black/40 border-white/70'}`}>
                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                </div>
            )}

            {/* BADGE FOIL */}
            {isFoil && !isSelectMode && (
                <div className="absolute bottom-0 right-0 z-20">
                    <span className="bg-linear-to-br from-amber-400 to-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-tl-lg shadow-sm block tracking-wide">
                        FOIL
                    </span>
                </div>
            )}

            {/* BOUTON FLIP (Seulement si recto-verso et pas en mode sélection) */}
            {imageBackUrl && !isSelectMode && (
                <button 
                    onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        onFlip(); 
                    }} 
                    // Visible par défaut sur mobile, au survol sur desktop
                    className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-md transition-all active:scale-95 shadow-md border border-white/20 opacity-100 lg:opacity-0 lg:group-hover/image:opacity-100"
                    title="Retourner la carte"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </button>
            )}
        </div>
    );
}