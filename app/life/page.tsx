// app/life/page.tsx
'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { recordGameAction, GameFormat } from '@/app/actions/game'; 
import toast from 'react-hot-toast';
// IMPORT DU COMPOSANT DÉCOUPÉ ET DE SES TYPES
import PlayerCounter, { PlayerState, GameSetup } from '@/components/life-counter/PlayerCounter';


// Couleurs utilisées pour N=2 (Split Screen)
const PLAYER_COLORS = [
    { bg: 'bg-danger/10', text: 'text-danger', primary: '#ef4444' }, // Player 1
    { bg: 'bg-primary/10', text: 'text-primary', primary: '#6275b3' }, // Player 2
];

// Couleurs utilisées pour N > 2 (Vue Liste)
const LIST_COLORS = [
    { bg: 'bg-red-50/70', text: 'text-red-700', border: 'border-red-300' }, 
    { bg: 'bg-blue-50/70', text: 'text-blue-700', border: 'border-blue-300' },
    { bg: 'bg-green-50/70', text: 'text-green-700', border: 'border-green-300' },
    { bg: 'bg-yellow-50/70', text: 'text-yellow-700', border: 'border-yellow-300' },
    { bg: 'bg-purple-50/70', text: 'text-purple-700', border: 'border-purple-300' },
    { bg: 'bg-pink-50/70', text: 'text-pink-700', border: 'border-pink-300' },
];


// --- COMPOSANT DE CONFIGURATION INITIALE ---
const SetupScreen = ({ onStartGame }: { onStartGame: (setup: GameSetup) => void }) => {
    
    const [setup, setSetup] = useState<GameSetup>({
        format: 'Standard',
        initialLife: 20,
        playerCount: 2, 
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [tempLife, setTempLife] = useState('20');


    const handleFormatSelect = (format: GameFormat, life: number) => {
        let defaultPlayers = (format === 'Commander') ? 4 : 2;
        defaultPlayers = (format === 'DuelCommander') ? 2 : defaultPlayers;

        setSetup({ 
            ...setup, 
            format, 
            initialLife: life, 
            playerCount: defaultPlayers 
        });
        setTempLife(life.toString());
    };

    const handleSetLife = () => {
        const life = parseInt(tempLife);
        if (isNaN(life) || life < 1) {
            toast.error("Vie de départ invalide.");
            return;
        }
        setSetup({ ...setup, initialLife: life });
    };

    const isCommander = setup.format === 'Commander';
    const isDuelCommander = setup.format === 'DuelCommander';

    return (
        <div className="bg-surface p-8 rounded-2xl shadow-xl max-w-lg w-full border border-border animate-in fade-in zoom-in">
            <h2 className="text-2xl font-bold text-primary mb-4">Créer une partie</h2>
            <p className="text-muted mb-6">Choisissez votre format et vos options de jeu.</p>

            <div className="space-y-6">
                {/* CHOIX DU FORMAT */}
                <div>
                    <p className="text-xs font-bold text-muted uppercase mb-2">Format de jeu</p>
                    <div className="grid grid-cols-3 gap-3">
                        <button 
                            onClick={() => handleFormatSelect('Commander', 40)} 
                            className={`px-3 py-3 rounded-lg font-bold transition text-sm ${isCommander ? 'bg-orange-600 text-white' : 'bg-secondary hover:bg-border text-foreground'}`}
                        >
                            CMD (40 PV)
                        </button>
                        <button 
                            onClick={() => handleFormatSelect('Standard', 20)} 
                            className={`px-3 py-3 rounded-lg font-bold transition text-sm ${setup.format === 'Standard' ? 'bg-primary text-white' : 'bg-secondary hover:bg-border text-foreground'}`}
                        >
                            Standard (20 PV)
                        </button>
                         <button 
                            onClick={() => handleFormatSelect('DuelCommander', 30)} 
                            className={`px-3 py-3 rounded-lg font-bold transition text-sm ${isDuelCommander ? 'bg-blue-600 text-white' : 'bg-secondary hover:bg-border text-foreground'}`}
                        >
                            Duel CMD (30 PV)
                        </button>
                        
                        <button 
                            onClick={() => handleFormatSelect('Modern', 20)} 
                            className={`px-3 py-3 rounded-lg font-bold transition text-sm ${setup.format === 'Modern' ? 'bg-purple-600 text-white' : 'bg-secondary hover:bg-border text-foreground'}`}
                        >
                            Modern
                        </button>
                         <button 
                            onClick={() => handleFormatSelect('Pauper', 20)} 
                            className={`px-3 py-3 rounded-lg font-bold transition text-sm ${setup.format === 'Pauper' ? 'bg-red-600 text-white' : 'bg-secondary hover:bg-border text-foreground'}`}
                        >
                            Pauper
                        </button>
                        <button 
                            onClick={() => handleFormatSelect('Other', setup.initialLife)} 
                            className={`px-3 py-3 rounded-lg font-bold transition text-sm ${setup.format === 'Other' ? 'bg-gray-600 text-white' : 'bg-secondary hover:bg-border text-foreground'}`}
                        >
                            Autre...
                        </button>
                    </div>
                </div>

                {/* NOMBRE DE JOUEURS */}
                <div className="animate-in fade-in">
                    <p className="text-xs font-bold text-muted uppercase mb-2">Nombre de joueurs</p>
                    <div className="flex gap-2 items-center justify-start">
                        {[2, 3, 4, 5, 6].map(count => (
                            <button 
                                key={count}
                                onClick={() => setSetup({ ...setup, playerCount: count })}
                                className={`w-10 h-10 rounded-full font-bold transition border ${setup.playerCount === count ? 'bg-primary text-white border-primary' : 'bg-secondary border-border text-foreground hover:bg-border'}`}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                     {setup.playerCount > 2 && (
                        <p className="text-xs text-muted pt-2">L&apos;enregistrement supportera {setup.playerCount} joueurs.</p>
                     )}
                </div>
                
                {/* VIE DE DÉPART PERSONNALISÉE */}
                <div className="border-t border-border pt-4">
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)} 
                        className="text-xs text-muted hover:text-primary underline"
                    >
                        {showAdvanced ? 'Masquer les options avancées' : 'Afficher les options avancées (Vie de départ)'}
                    </button>

                    {showAdvanced && (
                        <div className="flex items-center gap-2 mt-3 p-3 bg-secondary rounded-lg animate-in fade-in">
                            <span className="text-sm font-medium text-foreground">Vie de départ :</span>
                            <input 
                                type="number" 
                                placeholder="Vie de départ"
                                min="1"
                                value={tempLife}
                                onChange={(e) => setTempLife(e.target.value)}
                                className="w-24 p-2 rounded border border-border bg-background text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                            />
                            <button onClick={handleSetLife} className="bg-primary text-white px-3 py-2 rounded-lg text-sm font-bold">
                                Appliquer
                            </button>
                            <span className="text-xs text-muted ml-2">Format: {setup.format}</span>
                        </div>
                    )}
                </div>

                {/* BOUTON DE DÉMARRAGE */}
                <button 
                    onClick={() => onStartGame(setup)} 
                    className="w-full btn-primary py-3 text-lg mt-6"
                >
                    Démarrer le Compteur ({setup.playerCount} Joueurs)
                </button>
            </div>
        </div>
    );
};


// --- COMPOSANT PRINCIPAL ---
export default function LifeCounterPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [gameSetup, setGameSetup] = useState<GameSetup | null>(null); 
    const [players, setPlayers] = useState<PlayerState[]>([]);
    const [showGameEnd, setShowGameEnd] = useState(false);
    const [durationStart, setDurationStart] = useState<number | null>(null);
    
    // Fonction d'initialisation pour N joueurs
    const startNewGame = useCallback((setup: GameSetup) => {
        const newPlayers: PlayerState[] = [];
        
        // CORRECTION DE LA SYNTAXE DE BOUCLE FOR
        for (let i = 0; i < setup.playerCount; i++) {
            const newPlayerState: PlayerState = { 
                life: setup.initialLife, 
                poison: 0, 
                // Pour N>2, commanderDamage sera géré dans la partie "Score" (pas dans l'UI split-screen)
                commanderDamage: setup.initialLife >= 30 && setup.playerCount === 2 ? { 'p_opponent': 0 } : {},
                commanderNames: '', 
                deckName: '', 
                isWinner: false 
            };
            newPlayers.push(newPlayerState);
        }
        
        setGameSetup(setup);
        setPlayers(newPlayers);
        setShowGameEnd(false);
        setDurationStart(Date.now());
    }, []);
    
    // Effet de réinitialisation lors du changement de format/joueurs
    useEffect(() => {
        if (!gameSetup) return;
        startNewGame(gameSetup); 
        
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameSetup?.initialLife, gameSetup?.format, gameSetup?.playerCount]); 

    // --- ACTIONS DU COMPTEUR ---
    const updateLife = useCallback((index: number, delta: number) => {
        setPlayers(prev => prev.map((p, i) => i === index ? { ...p, life: Math.max(0, p.life + delta) } : p));
    }, []);
    
    const updatePoison = useCallback((index: number, delta: number) => {
        setPlayers(prev => prev.map((p, i) => i === index ? { ...p, poison: Math.max(0, p.poison + delta) } : p));
    }, []);
    
    const updateCommanderDamage = useCallback((index: number, delta: number) => {
        setPlayers(prev => prev.map((p, i) => {
            if (!gameSetup || gameSetup.playerCount !== 2 || gameSetup.initialLife < 30) return p; 

            if (i === index) {
                const currentDamage = p.commanderDamage['p_opponent'] || 0;
                const newDamage = Math.max(0, currentDamage + delta);
                return { ...p, commanderDamage: { ...p.commanderDamage, 'p_opponent': newDamage } };
            }
            return p;
        }));
    }, [gameSetup]);

    const updatePlayerAttr = useCallback((index: number, key: keyof PlayerState, value: string | number) => {
        setPlayers(prev => prev.map((p, i) => i === index ? { ...p, [key]: value } : p));
    }, []);

    // Détection de fin de partie
    const gameOverInfo = useMemo(() => {
        if (!gameSetup || players.length < 2) return { isOver: false, winnerIndex: -1, isMultiplayerKO: false };
        
        const isPlayerKO = (p: PlayerState) => {
            const isCommanderGame = gameSetup.initialLife >= 30;
            const commanderDamageTotal = isCommanderGame && gameSetup.playerCount === 2 ? p.commanderDamage['p_opponent'] || 0 : 0;
            
            return p.life <= 0 || p.poison >= 10 || (isCommanderGame && commanderDamageTotal >= 21);
        };
        
        const kos = players.filter(isPlayerKO).length;
        const remainingPlayers = players.length - kos;

        const isMultiplayerKO = players.length - kos <= 1 && kos > 0;

        if (isMultiplayerKO) {
             const winnerIndex = players.findIndex(p => !isPlayerKO(p));
             
             if (winnerIndex === -1) return { isOver: true, winnerIndex: -1, isMultiplayerKO: false };

             return { isOver: true, winnerIndex: winnerIndex, isMultiplayerKO: players.length > 2 };
        }
        
        return { isOver: false, winnerIndex: -1, isMultiplayerKO: false };
    }, [players, gameSetup]);
    
    // Mettre à jour l'état du jeu si la partie est terminée
    useEffect(() => {
        if (gameOverInfo.isOver && !showGameEnd) {
            if (gameOverInfo.winnerIndex !== -1) {
                setPlayers(prev => prev.map((p, i) => ({ ...p, isWinner: i === gameOverInfo.winnerIndex })));
            }
            setShowGameEnd(true);
        }
    }, [gameOverInfo, showGameEnd]);

    // --- ENREGISTREMENT DE PARTIE ---
    const handleRecordGame = async () => {
        if (!gameSetup || !user || gameOverInfo.winnerIndex === -1) {
            if (gameOverInfo.isOver && gameOverInfo.winnerIndex === -1) {
                 toast.error("Partie nulle (Draw). Non enregistré.");
                 if (gameSetup) startNewGame(gameSetup); 
                 return;
            }
            toast.error("Fin de partie non valide.");
            return;
        }

        const winner = players.find(p => p.isWinner);
        const durationMinutes = durationStart ? Math.round((Date.now() - durationStart) / 60000) : 0;
        const formatType: GameFormat = gameSetup.format; 
        
        const gameData = {
            format: formatType,
            winnerUid: winner === players[0] ? user.uid : 'opponent_unknown', 
            durationMinutes,
            players: players.map((p, index) => ({
                uid: index === 0 ? user.uid : 'opponent_unknown', 
                displayName: index === 0 ? user.displayName || 'Moi' : p.deckName || `Joueur ${index + 1}`,
                finalLife: p.life,
                isWinner: p.isWinner,
                commanderNames: p.commanderNames.split(',').map(s => s.trim()).filter(Boolean),
                deckName: p.deckName || 'Inconnu',
                startLife: gameSetup.initialLife,
            }))
        };

        const toastId = toast.loading("Enregistrement de la partie...");
        const result = await recordGameAction(gameData); 

        if (result.success) {
            toast.success("Partie enregistrée et stats mises à jour !", { id: toastId });
            startNewGame(gameSetup); 
        } else {
            toast.error(result.error || "Erreur enregistrement", { id: toastId });
        }
    };
    
    // --- GESTION DES VUES ---
    
    if (!user) {
        return (
            <main className="w-full h-screen flex flex-col items-center justify-center bg-background p-4">
                <p className="text-xl text-muted mb-4">Fonctionnalité réservée aux membres.</p>
                <button onClick={() => router.push('/login')} className="btn-primary">Connexion</button>
            </main>
        );
    }

    if (!gameSetup || players.length === 0) {
        return (
            <main className="w-full h-screen flex flex-col items-center justify-center bg-background p-4">
                <SetupScreen onStartGame={startNewGame} />
                <Link href="/" className="absolute bottom-4 right-4 text-sm text-muted hover:text-foreground">← Retour</Link>
            </main>
        );
    }
    
    // MODALE DE FIN DE PARTIE
    if (showGameEnd) {
        const isDraw = gameOverInfo.winnerIndex === -1;
        
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-surface rounded-xl p-8 max-w-lg w-full shadow-2xl border border-border space-y-6">
                    <h2 className="text-3xl font-black text-foreground">{isDraw ? "Partie Nulle" : "Partie Terminée !"}</h2>
                    
                    {!isDraw && (
                        <p className="text-lg text-success font-semibold">Le joueur {gameOverInfo.winnerIndex + 1} a gagné.</p>
                    )}
                    
                    {/* Formulaire de saisie Deck/Commandant */}
                    {!isDraw && players.map((p, index) => (
                        <div key={index} className={`p-4 rounded-lg border ${p.isWinner ? 'bg-success/10 border-success/30' : 'bg-secondary border-border'}`}>
                            <p className="font-bold mb-2">Joueur {index + 1} ({p.isWinner ? 'GAGNANT' : 'PERDANT'})</p>
                            
                            <input type="text" placeholder="Nom du Deck (ex: Urza Combo)" 
                                value={p.deckName}
                                onChange={(e) => updatePlayerAttr(index, 'deckName', e.target.value)}
                                className="w-full p-2 mb-2 rounded border border-border bg-background text-sm"
                            />
                            
                            {gameSetup.initialLife >= 30 && (
                                <input type="text" placeholder="Commandant(s) (séparés par virgule)"
                                    value={p.commanderNames}
                                    onChange={(e) => updatePlayerAttr(index, 'commanderNames', e.target.value)}
                                    className="w-full p-2 rounded border border-border bg-background text-sm"
                                />
                            )}
                        </div>
                    ))}
                    
                    <div className="flex justify-between gap-4 pt-4 border-t border-border">
                        <button onClick={() => startNewGame(gameSetup)} className="text-muted hover:text-danger text-sm px-4 py-2 rounded">
                            Nouvelle Partie (Ne pas {isDraw ? "réenregistrer" : "enregistrer"})
                        </button>
                        {!isDraw && (
                            <button onClick={handleRecordGame} className="btn-primary">
                                Enregistrer et Continuer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    // FIN MODALE

    // VUE COMPTEUR (N=2, Split Screen)
    if (players.length === 2) {
        return (
             <main className="w-full h-screen flex flex-col justify-center items-center bg-background">
                {/* Options de Jeu */}
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-3">
                    <span className={`px-3 py-1 text-sm font-bold rounded transition text-white ${gameSetup.initialLife >= 30 ? 'bg-orange-600' : 'bg-primary'}`}>
                        {gameSetup.format} ({gameSetup.initialLife} PV)
                    </span>
                    <button onClick={() => setGameSetup(null)} className="px-3 py-1 text-sm bg-secondary text-muted hover:bg-border rounded font-bold">
                        Changer Format
                    </button>
                </div>

                {/* PLAYER 1 (Bas, ROTATÉ) */}
                <PlayerCounter 
                    playerIndex={0}
                    playerState={players[0]}
                    updateLife={updateLife}
                    updateAttribute={updatePlayerAttr}
                    initialLife={gameSetup.initialLife}
                    isRotated={true} 
                    updatePoison={updatePoison}
                    updateCommanderDamage={updateCommanderDamage}
                    opponentIndices={[1]} 
                    gameSetup={gameSetup}
                />
                
                <div className="w-full h-px bg-border/50"></div>

                {/* PLAYER 2 (Haut, NON ROTATÉ) */}
                <PlayerCounter 
                    playerIndex={1}
                    playerState={players[1]}
                    updateLife={updateLife}
                    updateAttribute={updatePlayerAttr}
                    initialLife={gameSetup.initialLife}
                    isRotated={false} 
                    updatePoison={updatePoison}
                    updateCommanderDamage={updateCommanderDamage}
                    opponentIndices={[0]} 
                    gameSetup={gameSetup}
                />
                
                <Link href="/" className="fixed bottom-4 right-4 bg-surface border border-border text-muted hover:text-foreground px-3 py-1 rounded-lg text-sm shadow-md z-10">
                    ← Retour
                </Link>
            </main>
        );
    }
    
    // VUE LISTE (N > 2)
    return (
        <main className="w-full h-screen p-4 flex flex-col items-center justify-center bg-background">
             <div className="mb-4 text-center">
                 <span className={`px-3 py-1 text-sm font-bold rounded transition text-white ${gameSetup.initialLife >= 30 ? 'bg-orange-600' : 'bg-primary'}`}>
                    {gameSetup.format} ({gameSetup.initialLife} PV) - {players.length} J.
                </span>
                <button onClick={() => setGameSetup(null)} className="ml-3 px-2 py-1 text-xs bg-secondary text-muted hover:bg-border rounded font-bold">
                    Changer Format
                </button>
                <p className="text-xs text-danger mt-2">Mode liste actif. Retournez au mode 2 joueurs pour une interaction complète.</p>
            </div>
            
            <div className="flex flex-col gap-2 w-full max-w-lg overflow-y-auto p-2">
                {players.map((pState, index) => {
                    const { bg, text } = LIST_COLORS[index % LIST_COLORS.length];
                    const isKo = gameOverInfo.isOver && gameOverInfo.winnerIndex !== index;
                    
                    const isCommanderGame = gameSetup.initialLife >= 30;
                    // Assurez-vous que le résultat de reduce est un nombre pour l'affichage
                    const maxCmdReceived = isCommanderGame 
                        ? Object.values(pState.commanderDamage).reduce((max: number, current: number) => Math.max(max, current), 0)
                        : 0;

                    return (
                        <div 
                            key={index}
                            className={`p-4 rounded-xl shadow-md flex justify-between items-center ${bg} border border-border hover:border-primary/50`}
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground">Joueur {index + 1}</span>
                                {pState.deckName && <span className="text-xs text-muted italic">{pState.deckName}</span>}
                            </div>
                            
                            <div className="flex items-center gap-4">
                                {pState.poison > 0 && <span className="text-md text-purple-600 font-bold">{pState.poison} Poison</span>}
                                {maxCmdReceived > 0 && <span className="text-md text-orange-600 font-bold">{maxCmdReceived} CMD</span>}
                                
                                <span className={`${text} text-3xl font-black ${isKo ? 'opacity-40' : ''}`}>
                                    {Math.max(0, pState.life)}
                                </span>
                                
                            </div>
                        </div>
                    );
                })}
            </div>

            <Link href="/" className="fixed bottom-4 right-4 bg-surface border border-border text-muted hover:text-foreground px-3 py-1 rounded-lg text-sm shadow-md z-10">
                ← Retour
            </Link>
        </main>
    );
}