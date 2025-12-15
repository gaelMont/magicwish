'use client';

import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';
import toast from 'react-hot-toast';
import axios, { AxiosError } from 'axios';
import { useAuth } from '@/lib/AuthContext';
import { importCardsAction } from '@/app/actions/import';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWishlists } from '@/hooks/useWishlists';

// --- TYPES POUR L'IA (Types stricts) ---
type RoboflowPrediction = {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    class: string;
};

type RoboflowResponse = {
    predictions: RoboflowPrediction[];
};

// --- CONFIGURATION ROBOFLOW ---
const ROBOFLOW_MODEL_ID = "mtg-card-scanner/2"; 
const ROBOFLOW_API_KEY = "PZfOfzlDY9nLXVzVHRcJ"; 

type ScannedItem = {
    id: string;
    text: string;
};

export default function ScanPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { lists } = useWishlists();

    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const [cameraReady, setCameraReady] = useState(false);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("Prêt à scanner");
    const [debugMode, setDebugMode] = useState(false);

    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    
    // TYPAGE STRICT DE L'ÉTAT
    const [destination, setDestination] = useState<'collection' | 'wishlist'>('collection');
    
    const [targetListId, setTargetListId] = useState('default');
    const [isImporting, setIsImporting] = useState(false);

    const videoConstraints = {
        width: 1920,
        height: 1080,
        facingMode: "environment"
    };

    const captureAndProcess = useCallback(async () => {
        if (!webcamRef.current || isProcessing) return;
        
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setIsProcessing(true);
        setStatusText("Analyse IA (Roboflow)...");
        setProgress(10);

        try {
            const roboflowUrl = `https://detect.roboflow.com/${ROBOFLOW_MODEL_ID}?api_key=${ROBOFLOW_API_KEY}`;
            
            const response = await axios.post<RoboflowResponse>(roboflowUrl, imageSrc, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const predictions = response.data.predictions;
            if (!predictions || predictions.length === 0) {
                throw new Error("Aucune carte détectée. Essayez un fond uni.");
            }

            const cardBox = predictions[0];

            if (cardBox.confidence < 0.4) {
                throw new Error("Détection incertaine. Rapprochez-vous.");
            }

            // --- DÉCOUPE ---
            setStatusText("Découpe du titre...");
            setProgress(30);

            const image = new Image();
            image.src = imageSrc;
            await new Promise((resolve) => { image.onload = resolve; });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const boxX = cardBox.x - (cardBox.width / 2);
            const boxY = cardBox.y - (cardBox.height / 2);
            
            const marginX = cardBox.width * 0.05;
            
            const cropX = boxX + marginX;
            const cropY = boxY + (cardBox.height * 0.035); 
            const cropW = cardBox.width - (marginX * 2);
            const cropH = cardBox.height * 0.11; 

            canvas.width = cropW;
            canvas.height = cropH;

            ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const val = gray > 110 ? 255 : 0; 
                data[i] = data[i+1] = data[i+2] = val;
            }
            ctx.putImageData(imageData, 0, 0);

            if (debugMode && canvasRef.current) {
                const debugCtx = canvasRef.current.getContext('2d');
                if (debugCtx) {
                    canvasRef.current.width = cropW;
                    canvasRef.current.height = cropH;
                    debugCtx.putImageData(imageData, 0, 0);
                }
            }

            // --- OCR ---
            setStatusText("Lecture du texte...");
            setProgress(60);
            
            const processedImage = canvas.toDataURL('image/jpeg');
            const ocrResult = await Tesseract.recognize(
                processedImage,
                'eng',
                { logger: m => { if (m.status === 'recognizing text') setProgress(60 + Math.round(m.progress * 40)); } }
            );

            const rawText = ocrResult.data.text;
            const cleanText = rawText.replace(/[^a-zA-Z0-9',\s-]/g, '').trim();

            if (cleanText.length > 2) {
                const isDuplicate = scannedItems.length > 0 && scannedItems[0].text === cleanText;
                
                if (!isDuplicate) {
                    setScannedItems(prev => [{ id: Date.now().toString(), text: cleanText }, ...prev]);
                    toast.success(`Trouvé : ${cleanText}`);
                } else {
                    toast("Déjà scanné !", { icon: '⚠️' });
                }
            } else {
                toast.error("Texte illisible. Vérifiez l'éclairage.");
            }

        } catch (error: unknown) {
            console.error(error);
            
            if (axios.isAxiosError(error)) {
                const axiosErr = error as AxiosError;
                if (axiosErr.response?.status === 401) toast.error("Clé API Roboflow invalide.");
                else if (axiosErr.response?.status === 403) toast.error("Accès Roboflow refusé (Vérifiez votre plan).");
                else toast.error("Erreur réseau Roboflow");
            } else if (error instanceof Error) {
                toast.error(error.message);
            } else {
                toast.error("Erreur technique inconnue");
            }
        } finally {
            setIsProcessing(false);
            setStatusText("Prêt à scanner");
            setProgress(0);
        }
    }, [isProcessing, debugMode, scannedItems, lists]); 

    const updateItem = (id: string, newVal: string) => {
        setScannedItems(prev => prev.map(item => item.id === id ? { ...item, text: newVal } : item));
    };
    
    const removeItem = (id: string) => {
        setScannedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleFinalImport = async () => {
        if (!user || scannedItems.length === 0) return;
        
        setIsImporting(true);
        const toastId = toast.loading("Importation vers Scryfall...");

        try {
            const payload = scannedItems.map(item => ({
                name: item.text,
                set: '', 
                collectorNumber: '',
                quantity: 1,
                isFoil: false
            }));

            const res = await importCardsAction(
                user.uid,
                destination,
                'add',
                payload,
                targetListId
            );

            if (res.success) {
                toast.success(`${res.count} cartes importées !`, { id: toastId });
                setScannedItems([]); 
                router.push(destination === 'collection' ? '/collection' : '/wishlist');
            } else {
                toast.error(res.error || "Erreur partielle", { id: toastId });
            }

        } catch (e) {
            console.error(e);
            toast.error("Erreur serveur", { id: toastId });
        } finally {
            setIsImporting(false);
        }
    };

    if (!user) return <div className="p-10 text-center">Connexion requise.</div>;

    return (
        <main className="flex flex-col h-[calc(100vh-64px)] bg-black md:bg-zinc-900">
            
            <div className="relative w-full h-[45vh] md:h-[500px] bg-black overflow-hidden flex-shrink-0 md:max-w-3xl md:mx-auto md:mt-4 md:rounded-2xl shadow-2xl border-b border-zinc-800">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    onUserMedia={() => setCameraReady(true)}
                />

                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {isProcessing ? (
                        <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full flex flex-col items-center gap-2 border border-blue-500/50">
                            <div className="text-blue-400 font-bold text-sm animate-pulse">{statusText}</div>
                            <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-black/40 px-4 py-2 rounded-full text-white/70 text-xs border border-white/10">
                            Prenez la carte en photo (même de travers)
                        </div>
                    )}
                </div>

                <Link href="/" className="absolute top-4 left-4 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 backdrop-blur-sm z-20">✕</Link>
                
                <div className="absolute top-4 right-4 z-20 pointer-events-auto">
                    <button 
                        onClick={() => setDebugMode(!debugMode)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition ${debugMode ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-black/40 text-gray-400 border-gray-600'}`}
                    >
                        DEBUG: {debugMode ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-auto">
                    <button
                        onClick={captureAndProcess}
                        disabled={isProcessing || !cameraReady}
                        className="w-20 h-20 rounded-full border-4 border-white/80 bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition disabled:opacity-50 disabled:scale-100"
                    >
                        <div className="w-16 h-16 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                    </button>
                </div>

                {debugMode && (
                    <div className="absolute bottom-4 left-4 bg-black/80 border border-green-500 p-1 rounded z-30 pointer-events-none">
                        <p className="text-[9px] text-green-500 mb-1 font-mono">VISION ROBOT (TITRE)</p>
                        <canvas ref={canvasRef} className="h-12 w-auto bg-white/10" />
                    </div>
                )}
            </div>

            <div className="flex-1 bg-zinc-900 flex flex-col overflow-hidden md:max-w-3xl md:mx-auto md:w-full">
                
                <div className="p-3 bg-zinc-800 border-b border-zinc-700 flex flex-wrap gap-2 justify-between items-center shadow-lg z-10">
                    <span className="font-bold text-white text-sm flex items-center gap-2">
                        <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">{scannedItems.length}</span> Cartes
                    </span>
                    <div className="flex gap-2">
                        <select 
                            value={destination} 
                            // CORRECTION ICI : CAST EXPLICITE AU LIEU DE ANY
                            onChange={(e) => setDestination(e.target.value as 'collection' | 'wishlist')}
                            className="bg-zinc-700 text-white text-xs p-2 rounded outline-none border border-zinc-600 focus:border-blue-500"
                        >
                            <option value="collection">Collection</option>
                            <option value="wishlist">Wishlist</option>
                        </select>
                        {destination === 'wishlist' && (
                            <select
                                value={targetListId}
                                onChange={(e) => setTargetListId(e.target.value)}
                                className="bg-zinc-700 text-white text-xs p-2 rounded outline-none border border-zinc-600 max-w-[100px]"
                            >
                                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-zinc-950/50">
                    {scannedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2 opacity-50">
                            <span className="text-4xl">🎴</span>
                            <p className="text-sm font-medium">La liste est vide.</p>
                        </div>
                    ) : (
                        scannedItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700 animate-in slide-in-from-top-2">
                                <span className="text-green-500 text-xs">✓</span>
                                <input 
                                    type="text" 
                                    value={item.text} 
                                    onChange={(e) => updateItem(item.id, e.target.value)}
                                    className="flex-1 bg-transparent text-white text-sm font-bold outline-none border-b border-transparent focus:border-blue-500 focus:bg-zinc-900/50 px-1 py-1"
                                />
                                <button 
                                    onClick={() => removeItem(item.id)}
                                    className="text-zinc-500 hover:text-red-400 p-2 transition"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                    <button 
                        onClick={handleFinalImport}
                        disabled={isImporting || scannedItems.length === 0}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isImporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Recherche Scryfall...
                            </>
                        ) : (
                            `Valider et Ajouter (${scannedItems.length})`
                        )}
                    </button>
                </div>
            </div>
        </main>
    );
}