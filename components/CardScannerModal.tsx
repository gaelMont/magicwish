'use client';

import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';
import toast from 'react-hot-toast';

type CardScannerModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onScanComplete: (scannedText: string) => void;
};

export default function CardScannerModal({ isOpen, onClose, onScanComplete }: CardScannerModalProps) {
    const webcamRef = useRef<Webcam>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    // Configuration pour utiliser la caméra arrière sur mobile
    const videoConstraints = {
        width: 1280,
        height: 720,
        facingMode: "environment"
    };

    const captureAndProcess = useCallback(async () => {
        if (!webcamRef.current) return;
        
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setIsProcessing(true);
        setProgress(0);

        try {
            // 1. Charger l'image capturée
            const image = new Image();
            image.src = imageSrc;
            
            await new Promise((resolve) => { image.onload = resolve; });

            // 2. Préparer le Canvas pour le traitement
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) throw new Error("Impossible de créer le contexte Canvas");

            // Dimensions de la zone de rognage (doit correspondre visuellement à l'overlay vert)
            // On vise une bande horizontale au centre pour le titre
            const cropWidth = image.width * 0.8;  // 80% de la largeur
            const cropHeight = image.height * 0.15; // 15% de la hauteur
            const cropX = (image.width - cropWidth) / 2;
            const cropY = (image.height - cropHeight) / 2;

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            // Dessiner uniquement la portion "Titre"
            ctx.drawImage(
                image, 
                cropX, cropY, cropWidth, cropHeight, 
                0, 0, cropWidth, cropHeight
            );

            // 3. Traitement d'image (Binarisation) pour aider l'OCR
            // On transforme l'image en noir et blanc pur pour augmenter le contraste du texte
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Formule standard de luminosité
                const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
                // Seuil de contraste (100 est une valeur empirique moyenne pour les cartes Magic)
                const contrast = brightness > 100 ? 255 : 0; 
                
                data[i] = contrast;     // R
                data[i + 1] = contrast; // G
                data[i + 2] = contrast; // B
            }
            ctx.putImageData(imageData, 0, 0);

            // Export de l'image traitée
            const processedImage = canvas.toDataURL('image/jpeg');

            // 4. Reconnaissance de texte
            const result = await Tesseract.recognize(
                processedImage,
                'eng', // Le modèle anglais est le plus performant pour Magic
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            setProgress(Math.round(m.progress * 100));
                        }
                    }
                }
            );

            const rawText = result.data.text;
            // Nettoyage : on ne garde que les caractères alphanumériques et espaces
            // On évite les symboles bizarres que l'OCR peut inventer
            const cleanText = rawText.replace(/[^a-zA-Z0-9\s]/g, '').trim();

            if (cleanText.length > 2) {
                onScanComplete(cleanText);
                onClose();
            } else {
                toast.error("Texte non détecté. Essayez d'améliorer l'éclairage.");
            }

        } catch (error) {
            console.error("Erreur OCR:", error);
            toast.error("Erreur technique lors de l'analyse.");
        } finally {
            setIsProcessing(false);
        }

    }, [onScanComplete, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/70 to-transparent">
                <span className="text-white font-bold">Scanner le Titre</span>
                <button 
                    onClick={onClose} 
                    className="bg-white/20 text-white p-2 rounded-full backdrop-blur-md hover:bg-white/30 transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Vue Caméra */}
            <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Overlay Guide (Cadre vert pour viser le titre) */}
                <div className="relative z-10 w-[80%] h-[15%] border-2 border-green-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] flex items-center justify-center">
                    {!isProcessing && (
                        <span className="text-white/90 text-xs bg-black/60 px-3 py-1 rounded font-medium">
                            Placez le nom de la carte ici
                        </span>
                    )}
                </div>

                {/* État de chargement */}
                {isProcessing && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-white font-bold text-lg animate-pulse">Lecture... {progress}%</p>
                    </div>
                )}
            </div>

            {/* Footer / Bouton Déclencheur */}
            <div className="p-8 bg-black flex justify-center pb-12">
                <button
                    onClick={captureAndProcess}
                    disabled={isProcessing}
                    className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center hover:bg-white/30 transition active:scale-95 disabled:opacity-50"
                >
                    <div className="w-16 h-16 bg-white rounded-full"></div>
                </button>
            </div>
        </div>
    );
}