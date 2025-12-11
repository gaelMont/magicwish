// components/ImportModal.tsx
'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';

// ... (Les types ManaboxRow restent identiques) ...
type ManaboxRow = {
  "Binder Name": string;
  "Name": string;
  "Set code": string;
  "Set name": string;
  "Collector number": string;
  "Foil": string;
  "Rarity": string;
  "Quantity": string;
  "ManaBox ID": string;
  "Scryfall ID": string; 
  "Purchase price": string;
  "Language": string;
  "Condition": string;
};

// Mise à jour du type ScryfallCard pour bien typer le dos
type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  prices?: { eur?: string; usd?: string };
  image_uris?: { normal?: string };
  card_faces?: Array<{ 
    name: string;
    image_uris?: { normal?: string } 
  }>;
};

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetCollection?: string; 
};

export default function ImportModal({ isOpen, onClose, targetCollection = 'collection' }: ImportModalProps) {
  const { user } = useAuth();
  const [data, setData] = useState<ManaboxRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ",", 
      encoding: "UTF-8",
      complete: (results) => {
        setColumns(results.meta.fields || []);
        setData(results.data as ManaboxRow[]);
        setStep('preview');
      },
      error: (error) => toast.error("Erreur lecture CSV : " + error.message)
    });
  };

  const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // --- NOUVELLE LOGIQUE POUR RECUPERER LE DOS ---
  const getCardInfo = (scryfallCard: ScryfallCard) => {
    let name = scryfallCard.name;
    let imageUrl = scryfallCard.image_uris?.normal;
    let imageBackUrl = null; // Par défaut pas de dos

    // Gestion Double Face
    if (scryfallCard.card_faces && scryfallCard.card_faces.length > 1) {
      name = scryfallCard.card_faces[0].name;
      
      // Face avant
      if (!imageUrl && scryfallCard.card_faces[0].image_uris) {
        imageUrl = scryfallCard.card_faces[0].image_uris.normal;
      }
      // Face arrière (On récupère l'image de la 2ème face)
      if (scryfallCard.card_faces[1].image_uris) {
        imageBackUrl = scryfallCard.card_faces[1].image_uris.normal;
      }
    }

    if (!imageUrl) {
        imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
    }

    return { name, imageUrl, imageBackUrl };
  };

  const startImport = async () => {
    if (!user) return;
    setStep('importing');
    setProgress(0);

    const chunks = chunkArray(data, 75);
    let processedCount = 0;
    let successCount = 0;

    for (const chunk of chunks) {
      try {
        const identifiers = chunk.map(row => {
            if (row["Scryfall ID"]) return { id: row["Scryfall ID"] };
            return { name: row["Name"], set: row["Set code"] };
        });

        const response = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers })
        });

        const result = await response.json();
        const foundCards: ScryfallCard[] = result.data || [];
        const scryfallMap = new Map<string, ScryfallCard>();
        foundCards.forEach(c => scryfallMap.set(c.id, c));

        const batch = writeBatch(db);
        
        chunk.forEach(row => {
          const scryfallData = scryfallMap.get(row["Scryfall ID"]);
          
          if (scryfallData) {
            const { name, imageUrl, imageBackUrl } = getCardInfo(scryfallData);
            const quantity = parseInt(row["Quantity"]) || 1;
            const price = parseFloat(scryfallData.prices?.eur || "0");
            
            const cardRef = doc(db, 'users', user.uid, targetCollection, scryfallData.id);

            batch.set(cardRef, {
              name: name,
              imageUrl: imageUrl,
              imageBackUrl: imageBackUrl, // <--- ON SAUVEGARDE LE DOS ICI
              setName: scryfallData.set_name,
              setCode: scryfallData.set,
              quantity: increment(quantity),
              price: price,
              scryfallId: scryfallData.id,
              foil: row["Foil"] === "true",
              condition: row["Condition"],
              language: row["Language"],
              importedAt: new Date()
            }, { merge: true });
            
            successCount++;
          }
        });

        await batch.commit();

      } catch (error) {
        console.error("Erreur sur un lot :", error);
      }

      processedCount += chunk.length;
      setProgress(Math.round((processedCount / data.length) * 100));
      setStatusMsg(`${processedCount} / ${data.length} cartes traitées...`);
      await new Promise(r => setTimeout(r, 100));
    }

    toast.success(`Import terminé ! ${successCount} cartes ajoutées.`);
    onClose();
    setData([]);
    setStep('upload');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Importer depuis Manabox</h2>
          {!step.includes('importing') && (
             <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          )}
        </div>

        <div className="flex-grow overflow-hidden flex flex-col">
            {step === 'upload' && (
                <div className="p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative cursor-pointer group">
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" />
                    <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📂</div>
                    <p className="font-bold text-lg">Déposer CSV Manabox</p>
                </div>
            )}

            {step === 'preview' && (
                <div className="flex flex-col h-full">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-blue-800 dark:text-blue-200">{data.length} cartes détectées</p>
                            <p className="text-sm text-blue-600 dark:text-blue-300">Prêt à importer dans "Ma {targetCollection === 'wishlist' ? 'Wishlist' : 'Collection'}"</p>
                        </div>
                        <button onClick={() => { setData([]); setStep('upload'); }} className="text-red-500 text-sm hover:underline">Annuler</button>
                    </div>
                    <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg flex-grow bg-gray-50 dark:bg-gray-900 mb-4">
                        <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-gray-700 bg-gray-200 dark:bg-gray-800 sticky top-0">
                                <tr>{columns.slice(0,6).map((col, i) => <th key={i} className="px-4 py-2">{col}</th>)}</tr>
                            </thead>
                            <tbody>
                                {data.slice(0, 20).map((row, i) => (
                                    <tr key={i} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                        {columns.slice(0,6).map((col, j) => (
                                            <td key={j} className="px-4 py-1 truncate max-w-[150px]">{row[col as keyof ManaboxRow]}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={startImport} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:-translate-y-0.5">
                        🚀 Lancer l'importation
                    </button>
                </div>
            )}

            {step === 'importing' && (
                <div className="flex flex-col items-center justify-center h-full py-10">
                    <div className="text-5xl font-bold text-blue-600 mb-2">{progress}%</div>
                    <p className="text-gray-500 animate-pulse mb-6">{statusMsg}</p>
                    <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 overflow-hidden max-w-md">
                        <div className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Merci de ne pas fermer cette fenêtre.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}