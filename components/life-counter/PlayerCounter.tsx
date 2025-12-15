// components/life-counter/PlayerCounter.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { GameFormat } from '@/app/actions/game'; 
// Note: Le type GameFormat est importé de app/actions/game.ts

// Définitions de type déplacées ici pour la portabilité du composant
export interface PlayerState {
    life: number;
    poison: number;
    commanderDamage: Record<string, number>; 
    commanderNames: string; 
    deckName: string;
    isWinner: boolean;
}

export interface GameSetup {
    format: GameFormat;
    initialLife: number;
    playerCount: number;
}

const PLAYER_COLORS = [
    { bg: 'bg-danger/10', text: 'text-danger', primary: '#ef4444' }, 
    { bg: 'bg-primary/10', text: 'text-primary', primary: '#6275b3' }, 
];

const PlayerCounter = ({
    playerIndex,
    playerState,
    updateLife,
    updateAttribute, 
    initialLife,
    isRotated = false,
    updateCommanderDamage,
    updatePoison,
    gameSetup
}: {
    playerIndex: number;
    playerState: PlayerState;
    updateLife: (index: number, delta: number) => void;
    updateAttribute: (index: number, key: keyof PlayerState, value: string | number) => void;
    initialLife: number;
    isRotated?: boolean;
    updateCommanderDamage: (index: number, delta: number) => void;
    updatePoison: (index: number, delta: number) => void;
    opponentIndices: number[];
    gameSetup: GameSetup;
}) => {
    const { bg, text } = PLAYER_COLORS[playerIndex];
    const { life, poison } = playerState;
    const isCommander = initialLife >= 30; 

    // Calcul simplifié du CMD reçu (pour l'affichage en mode 2 joueurs)
    const commanderDamageTotal = playerState.commanderDamage['p_opponent'] || 0;

    const lifeDisplay = life <= 0 ? 0 : life;
    const isKo = life <= 0 || poison >= 10 || (isCommander && commanderDamageTotal >= 21);
    
    // --- GESTION DU TAP/HOLD ---
    const [mode, setMode] = useState<'life' | 'poison' | 'cmd'>('life');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopCount = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        timerRef.current = null;
        intervalRef.current = null;
    };
    
    const startCount = (delta: number) => {
        if (isKo && delta < 0) return;

        // 1. Mise à jour immédiate (+/- 1)
        if (mode === 'life') {
            updateLife(playerIndex, delta);
        } else if (mode === 'poison') {
            updatePoison(playerIndex, delta);
        } else if (mode === 'cmd' && isCommander) {
            updateCommanderDamage(playerIndex, delta);
        }
        
        // 2. Démarre le timer pour l'augmentation rapide
        const rapidDelta = (mode === 'life') ? delta * 10 : delta;
        const maxLimit = (mode === 'cmd' ? 21 : 1000); 

        timerRef.current = setTimeout(() => {
            intervalRef.current = setInterval(() => {
                 // Vérification des limites pour arrêter l'intervalle
                if (mode === 'life') {
                    if ((delta < 0 && playerState.life <= 0) || (delta > 0 && playerState.life >= maxLimit)) {
                        stopCount();
                        return;
                    }
                } else if (mode === 'poison' && ((delta < 0 && playerState.poison <= 0) || (delta > 0 && playerState.poison >= 10))) {
                    stopCount();
                    return;
                } else if (mode === 'cmd' && ((delta < 0 && commanderDamageTotal <= 0) || (delta > 0 && commanderDamageTotal >= 21))) {
                    stopCount();
                    return;
                }
                
                // Mettre à jour l'état
                if (mode === 'life') {
                    updateLife(playerIndex, rapidDelta);
                } else if (mode === 'poison') {
                    updatePoison(playerIndex, rapidDelta);
                } else if (mode === 'cmd' && isCommander) {
                    updateCommanderDamage(playerIndex, rapidDelta);
                }
            }, 100); 
        }, 500); 
    };

    
    useEffect(() => {
        return () => {
            stopCount();
        };
    }, []);

    const handleStartEvent = (e: React.MouseEvent | React.TouchEvent, delta: number) => {
        e.preventDefault(); 
        stopCount();
        startCount(delta);
    };

    const handleEndEvent = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        stopCount();
    };


    const getInteractionTitle = (delta: number) => {
        const sign = delta > 0 ? '+' : '-';
        if (mode === 'life') return `${sign} PV`;
        if (mode === 'poison') return `${sign} Poison`;
        if (mode === 'cmd') return `${sign} CMD`;
        return '';
    };

    const isCurrentMode = (checkMode: 'life' | 'poison' | 'cmd') => mode === checkMode;


    return (
        <div 
            className={`relative w-full h-1/2 flex flex-col items-center justify-center transition-all duration-300 select-none ${bg} ${isRotated ? 'rotate-180' : ''}`}
            style={{ transformOrigin: 'center' }}
        >
            
            {/* Affichage des PV */}
            <div className={`text-[120px] font-black leading-none ${text} ${isKo ? 'opacity-40' : ''}`}>
                {lifeDisplay}
            </div>
            
            {/* Overlay d'interaction (pour montrer le mode actif) */}
            {(mode !== 'life') && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20 transition-opacity">
                    <span className="text-4xl font-black text-white uppercase opacity-80">
                         {mode === 'poison' ? 'POISON' : 'CMD'}
                    </span>
                </div>
            )}
            
            {/* LIGNES D'INTERACTION PRINCIPALES (TAP/HOLD) */}
            <div className="absolute inset-0 flex z-10">
                {/* GAUCHE (DECREMENT) */}
                <div 
                    className="w-1/2 h-full absolute left-0 cursor-pointer flex items-center justify-start p-4 opacity-0 hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleStartEvent(e, -1)}
                    onMouseUp={handleEndEvent}
                    onTouchStart={(e) => handleStartEvent(e, -1)}
                    onTouchEnd={handleEndEvent}
                    onContextMenu={(e) => e.preventDefault()} 
                >
                     <span className={`text-8xl font-thin ${isCurrentMode('life') ? 'text-danger' : isCurrentMode('poison') ? 'text-purple-500' : 'text-orange-500'}`}>{getInteractionTitle(-1)}</span>
                </div>
                
                {/* DROITE (INCREMENT) */}
                <div 
                    className="w-1/2 h-full absolute right-0 cursor-pointer flex items-center justify-end p-4 opacity-0 hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleStartEvent(e, 1)}
                    onMouseUp={handleEndEvent}
                    onTouchStart={(e) => handleStartEvent(e, 1)}
                    onTouchEnd={handleEndEvent}
                    onContextMenu={(e) => e.preventDefault()}
                >
                     <span className={`text-8xl font-thin ${isCurrentMode('life') ? 'text-success' : isCurrentMode('poison') ? 'text-purple-500' : 'text-orange-500'}`}>{getInteractionTitle(1)}</span>
                </div>
            </div>
            
            {/* BOUTONS DE MODE DANS LES COINS (Z-30 pour être au-dessus de tout) */}
            <div className="absolute top-2 left-2 z-30">
                 <button onClick={() => updateLife(playerIndex, initialLife - life)} className="text-sm text-muted hover:text-foreground p-1 rounded transition" title="Reset Life">↻</button>
            </div>

            <div className="absolute top-2 right-2 z-30 flex items-center gap-2" style={{ transform: isRotated ? 'rotate(180deg)' : 'none' }}>
                <button 
                    onClick={() => setMode(isCurrentMode('poison') ? 'life' : 'poison')}
                    className={`p-1 rounded-full text-sm font-bold transition ${isCurrentMode('poison') ? 'bg-purple-600 text-white shadow-lg' : 'bg-secondary text-muted hover:bg-border'}`}
                    title="Ajuster Poison"
                >
                    Poison
                </button>
                {isCommander && gameSetup.playerCount === 2 && (
                    <button 
                        onClick={() => setMode(isCurrentMode('cmd') ? 'life' : 'cmd')}
                        className={`p-1 rounded-full text-sm font-bold transition ${isCurrentMode('cmd') ? 'bg-orange-600 text-white shadow-lg' : 'bg-secondary text-muted hover:bg-border'}`}
                        title="Ajuster Dégâts de Commandement"
                    >
                        CMD
                    </button>
                )}
            </div>

            {/* Statuts Affichés discrètement */}
            <div className="absolute bottom-1 right-2 z-30 flex items-center gap-2" style={{ transform: isRotated ? 'rotate(180deg)' : 'none' }}>
                {commanderDamageTotal > 0 && (
                    <span className="text-sm font-bold text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded-full">
                        {commanderDamageTotal} CMD
                    </span>
                )}
                 {poison > 0 && (
                    <span className="text-sm font-bold text-purple-600 bg-purple-100/50 px-2 py-0.5 rounded-full">
                        {poison} Poison
                    </span>
                )}
            </div>
            
            {/* Message KO */}
            {isKo && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40">
                     <span className="text-4xl font-black text-white uppercase">KO !</span>
                 </div>
            )}
        </div>
    );
};

export default PlayerCounter;