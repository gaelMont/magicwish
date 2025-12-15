'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '@/lib/AuthContext';
import { importCardsAction } from '@/app/actions/import';

// --- CONFIGURATION ---
const ROBOFLOW_MODEL_ID = "mtg-card-scanner/2";
const ROBOFLOW_API_KEY = "PZfOfzlDY9nLXVzVHRcJ";

// --- TYPES ---
type CardHash = {
    h: string;  
    n: string;  
    s: string;  
    cn: string; 
    id: string; 
};

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

// Fonction pour calculer la distance de Hamming (Différence entre 2 hashes)
const hammingDistance = (hash1: string, hash2: string) => {
    // CORRECTION : Utilisation de const
    const val1 = BigInt('0x' + hash1);
    const val2 = BigInt('0x' + hash2);
    let xor = val1 ^ val2;
    let distance = 0;
    while (xor > 0n) {
        distance += Number(xor & 1n);
        xor >>= 1n;
    }
    return distance;
};

// Algorithme dHash
const computeBrowserDHash = (imgData: ImageData): string => {
    const size = 9; 
    let hash = '';
    const data = imgData.data;

    for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
            const i = (y * size + x) * 4;
            const j = (y * size + (x + 1)) * 4;
            const left = (data[i] + data[i+1] + data[i+2]) / 3;
            const right = (data[j] + data[j+1] + data[j+2]) / 3;
            hash += (left > right ? '1' : '0');
        }
    }
    return BigInt('0b' + hash).toString(16);
};

export default function ScanPage() {
    const { user } = useAuth();
    const webcamRef = useRef<Webcam>(null);
    
    // États
    const [dbHashes, setDbHashes] = useState<CardHash[]>([]);
    const [dbLoading, setDbLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState("Chargement DB...");
    const [scannedCards, setScannedCards] = useState<CardHash[]>([]);
    const [debugImage, setDebugImage] = useState<string | null>(null);

    useEffect(() => {
        fetch('/card-hashes.json')
            .then(res => res.json())
            .then(data => {
                setDbHashes(data);
                setDbLoading(false);
                setStatusText("Prêt à scanner");
            })
            .catch(err => {
                console.error("Erreur chargement DB:", err);
                setStatusText("Erreur chargement base de données");
            });
    }, []);

    const captureAndIdentify = useCallback(async () => {
        if (!webcamRef.current || isProcessing || dbHashes.length === 0) return;
        
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setIsProcessing(true);
        setStatusText("Détection IA...");

        try {
            // A. ROBOFLOW
            const roboflowUrl = `https://detect.roboflow.com/${ROBOFLOW_MODEL_ID}?api_key=${ROBOFLOW_API_KEY}`;
            // CORRECTION : Typage de la réponse Axios
            const response = await axios.post<RoboflowResponse>(roboflowUrl, imageSrc, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const predictions = response.data.predictions;
            if (!predictions || predictions.length === 0) throw new Error("Aucune carte vue.");
            
            const box = predictions[0];

            // B. EXTRACTION
            const image = new Image();
            image.src = imageSrc;
            await new Promise((resolve) => { image.onload = resolve; });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = 9; 
            canvas.height = 8;

            const x = box.x - box.width / 2;
            const y = box.y - box.height / 2;

            ctx.drawImage(image, x, y, box.width, box.height, 0, 0, 9, 8);
            
            setDebugImage(canvas.toDataURL());

            // C. CALCUL DU HASH
            const imgData = ctx.getImageData(0, 0, 9, 8);
            const currentHash = computeBrowserDHash(imgData);

            // D. RECHERCHE
            setStatusText("Identification...");
            
            let bestMatch: CardHash | null = null;
            let minDistance = 100; 

            for (const item of dbHashes) {
                const dist = hammingDistance(currentHash, item.h);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestMatch = item;
                }
                if (dist === 0) break;
            }

            if (bestMatch && minDistance <= 12) {
                toast.success(`Trouvé : ${bestMatch.n} (${minDistance})`);
                // CORRECTION : bestMatch est typé, TypeScript est content
                setScannedCards(prev => [bestMatch!, ...prev]);
            } else {
                toast.error(`Carte inconnue (Dist: ${minDistance})`);
            }

        // CORRECTION : Typage de l'erreur catch
        } catch (e: unknown) {
            console.error(e);
            let message = "Erreur technique";
            if (e instanceof Error) message = e.message;
            toast.error(message);
        } finally {
            setIsProcessing(false);
            setStatusText("Prêt");
        }
    }, [dbHashes, isProcessing]);

    const handleImport = async () => {
        if(!user || scannedCards.length === 0) return;
        const toastId = toast.loading("Ajout...");
        
        const payload = scannedCards.map(c => ({
            scryfallId: c.id,
            name: c.n,
            set: c.s,
            collectorNumber: c.cn,
            quantity: 1,
            isFoil: false
        }));

        await importCardsAction(user.uid, 'collection', 'add', payload);
        toast.success("Terminé !", { id: toastId });
        setScannedCards([]);
    };

    if (!user) return <div className="p-10 text-center">Connexion requise.</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-black">
            {/* CAMÉRA */}
            <div className="relative h-1/2 bg-zinc-900">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment" }}
                    className="w-full h-full object-cover opacity-80"
                    onUserMedia={() => setDbLoading(false)}
                />
                
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-white font-bold bg-black/50 px-4 py-2 rounded-full mb-4 backdrop-blur-sm">
                        {statusText}
                    </div>
                    {dbLoading && <div className="text-xs text-yellow-400">Téléchargement base de données...</div>}
                </div>

                {debugImage && (
                    <div className="absolute bottom-4 left-4 border border-green-500 bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={debugImage} alt="debug" className="w-16 h-16 object-contain" style={{imageRendering: 'pixelated'}} />
                        <div className="text-[8px] text-green-500 bg-black px-1">HASH VIEW</div>
                    </div>
                )}

                <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-auto">
                    <button
                        onClick={captureAndIdentify}
                        disabled={isProcessing || dbLoading}
                        className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-95 transition disabled:opacity-50"
                    >
                        <div className="w-16 h-16 bg-white rounded-full"></div>
                    </button>
                </div>
            </div>

            {/* LISTE */}
            <div className="flex-1 bg-zinc-900 p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-white font-bold">Cartes détectées ({scannedCards.length})</h2>
                    {scannedCards.length > 0 && (
                        <button onClick={handleImport} className="bg-blue-600 text-white px-4 py-1 rounded text-sm font-bold">
                            Valider tout
                        </button>
                    )}
                </div>
                
                <div className="space-y-2">
                    {scannedCards.map((card, i) => (
                        <div key={i} className="bg-zinc-800 p-3 rounded flex justify-between items-center animate-in slide-in-from-left-2">
                            <div>
                                <div className="text-white font-bold">{card.n}</div>
                                <div className="text-xs text-zinc-400">{card.s.toUpperCase()} #{card.cn}</div>
                            </div>
                            <button onClick={() => setScannedCards(p => p.filter((_, idx) => idx !== i))} className="text-red-500 px-2">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}