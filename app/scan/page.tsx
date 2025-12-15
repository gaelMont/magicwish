// app/scan/page.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';
import { importCardsAction } from '@/app/actions/import';
import Link from 'next/link';
import { useWishlists } from '@/hooks/useWishlists';

type ScannedItem = {
    id: string; // ID temporaire pour la liste
    text: string;
};

export default function ScanPage() {
    const { user } = useAuth();
    const { lists } = useWishlists(); // Pour choisir la wishlist cible si besoin

    // --- ÉTATS CAMÉRA & OCR ---
    const webcamRef = useRef<Webcam>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [cameraReady, setCameraReady] = useState(false);

    // --- ÉTATS LISTE ---
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [destination, setDestination] = useState<'collection' | 'wishlist'>('collection');
    const [targetListId, setTargetListId] = useState('default');
    
    // --- ÉTATS IMPORT ---
    const [isImporting, setIsImporting] = useState(false);

    // Configuration Caméra (Optimisée Mobile)
    const videoConstraints = {
        width: 1280,
        height: 720,
        facingMode: "environment"
    };

    // --- LOGIQUE OCR (Similaire à la modale, mais adaptée) ---
    const captureAndProcess = useCallback(async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setIsProcessing(true);
        setProgress(0);

        try {
            const image = new Image();
            image.src = imageSrc;
            await new Promise((resolve) => { image.onload = resolve; });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Rognage (Focus zone centrale horizontale)
            const cropWidth = image.width * 0.8;
            const cropHeight = image.height * 0.15;
            const cropX = (image.width - cropWidth) / 2;
            const cropY = (image.height - cropHeight) / 2;

            canvas.width = cropWidth;
            canvas.height = cropHeight;
            ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Filtres (Noir & Blanc)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
                const contrast = brightness > 100 ? 255 : 0;
                data[i] = contrast; data[i + 1] = contrast; data[i + 2] = contrast;
            }
            ctx.putImageData(imageData, 0, 0);

            const result = await Tesseract.recognize(
                canvas.toDataURL('image/jpeg'),
                'eng',
                { logger: m => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); } }
            );

            const cleanText = result.data.text.replace(/[^a-zA-Z0-9\s]/g, '').trim();

            if (cleanText.length > 2) {
                // Ajout à la liste
                const newItem: ScannedItem = {
                    id: Date.now().toString(),
                    text: cleanText
                };
                setScannedItems(prev => [newItem, ...prev]); // Le plus récent en haut
                toast.success(`Detecté : ${cleanText}`);
            } else {
                toast.error("Texte illisible. Rapprochez-vous ou stabilisez.");
            }

        } catch (error) {
            console.error(error);
            toast.error("Erreur d'analyse.");
        } finally {
            setIsProcessing(false);
        }
    }, []);

    // --- GESTION LISTE ---
    const removeItem = (id: string) => {
        setScannedItems(prev => prev.filter(item => item.id !== id));
    };

    const editItem = (id: string, newText: string) => {
        setScannedItems(prev => prev.map(item => item.id === id ? { ...item, text: newText } : item));
    };

    // --- VALIDATION FINALE ---
    const handleFinalImport = async () => {
        if (!user || scannedItems.length === 0) return;
        
        setIsImporting(true);
        const toastId = toast.loading("Identification et import en cours...");

        try {
            // On transforme nos strings brutes en format attendu par importCardsAction
            // Note: On ne connait pas encore l'édition précise, l'action serveur prendra la plus récente par défaut
            // ou fera un matching intelligent si on avait scanné le code set (complexe en OCR).
            const importPayload = scannedItems.map(item => ({
                name: item.text,
                set: '', // On laisse vide, le serveur cherchera par nom
                collectorNumber: '',
                quantity: 1,
                isFoil: false, // Par défaut non foil en scan rapide
            }));

            const result = await importCardsAction(
                user.uid,
                destination,
                'add', // Mode ajout
                importPayload,
                targetListId
            );

            if (result.success) {
                toast.success(`${result.count} cartes importées avec succès !`, { id: toastId });
                setScannedItems([]); // Reset
            } else {
                toast.error("Erreur partielle lors de l'import.", { id: toastId });
            }

        } catch (error) {
            console.error(error);
            toast.error("Erreur serveur.", { id: toastId });
        } finally {
            setIsImporting(false);
        }
    };

    if (!user) return <div className="p-10 text-center">Connectez-vous pour accéder au scanner.</div>;

    return (
        <main className="flex flex-col h-[calc(100vh-64px)] bg-black md:bg-background">
            
            {/* ZONE CAMÉRA (HAUT) - Prend 40% à 50% de l'écran sur mobile */}
            <div className="relative w-full h-[45vh] md:h-[500px] bg-black overflow-hidden flex-shrink-0 md:rounded-b-2xl md:max-w-4xl md:mx-auto md:mt-4 shadow-xl">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="w-full h-full object-cover"
                    onUserMedia={() => setCameraReady(true)}
                />
                
                {/* Overlay Interface Caméra */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                    {/* Cadre de visée */}
                    <div className="w-[85%] h-[15%] border-2 border-primary/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] relative animate-in zoom-in duration-500">
                        <div className="absolute -top-6 left-0 right-0 text-center">
                            <span className="text-white/90 text-xs font-bold bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
                                Visez le nom de la carte
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bouton Déclencheur Flottant */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-auto">
                    <button
                        onClick={captureAndProcess}
                        disabled={isProcessing || !cameraReady}
                        className="w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center hover:bg-white/30 transition active:scale-95 disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <div className="w-12 h-12 bg-white rounded-full" />
                        )}
                    </button>
                </div>

                {/* Bouton Retour */}
                <Link href="/" className="absolute top-4 left-4 text-white bg-black/30 p-2 rounded-full backdrop-blur-md pointer-events-auto">
                    ←
                </Link>
            </div>

            {/* ZONE LISTE (BAS) - Scrollable */}
            <div className="flex-1 bg-background rounded-t-3xl -mt-6 relative z-10 flex flex-col overflow-hidden md:mt-4 md:max-w-4xl md:mx-auto md:w-full md:rounded-xl md:border md:border-border">
                
                {/* Header de la liste (Options) */}
                <div className="p-4 border-b border-border bg-surface flex flex-wrap gap-3 items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-foreground">Scannés ({scannedItems.length})</span>
                    </div>
                    
                    <div className="flex gap-2">
                        <select 
                            value={destination} 
                            onChange={(e) => setDestination(e.target.value as 'collection' | 'wishlist')}
                            className="bg-secondary text-foreground text-sm p-2 rounded-lg border border-border outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="collection">Vers Collection</option>
                            <option value="wishlist">Vers Wishlist</option>
                        </select>

                        {destination === 'wishlist' && lists.length > 0 && (
                            <select
                                value={targetListId}
                                onChange={(e) => setTargetListId(e.target.value)}
                                className="bg-secondary text-foreground text-sm p-2 rounded-lg border border-border outline-none focus:ring-1 focus:ring-primary max-w-[100px]"
                            >
                                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                {/* Liste des items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-background custom-scrollbar">
                    {scannedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted text-center opacity-60">
                            <span className="text-4xl mb-2">📷</span>
                            <p>Scannez votre première carte !</p>
                            <p className="text-xs mt-2">Le texte détecté apparaîtra ici.</p>
                        </div>
                    ) : (
                        scannedItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 bg-surface p-3 rounded-xl border border-border shadow-sm animate-in slide-in-from-bottom-2 fade-in">
                                <input 
                                    type="text" 
                                    value={item.text} 
                                    onChange={(e) => editItem(item.id, e.target.value)}
                                    className="flex-1 bg-transparent font-bold text-foreground outline-none border-b border-transparent focus:border-primary px-1"
                                />
                                <button 
                                    onClick={() => removeItem(item.id)}
                                    className="text-muted hover:text-danger p-2"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Validation */}
                <div className="p-4 border-t border-border bg-surface">
                    <button 
                        onClick={handleFinalImport}
                        disabled={isImporting || scannedItems.length === 0}
                        className="w-full btn-primary py-3.5 text-lg shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImporting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Traitement...
                            </>
                        ) : (
                            `Valider l'ajout (${scannedItems.length})`
                        )}
                    </button>
                </div>

            </div>
        </main>
    );
}