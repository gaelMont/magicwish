'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';

// --- TYPES ---
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

type ExistingCard = {
  scryfallId?: string; 
  id: string;
  quantity: number;
  foil?: boolean;
};

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetCollection?: string;
  currentCollection?: ExistingCard[];
};

export default function ImportModal({ isOpen, onClose, targetCollection = 'collection', currentCollection = [] }: ImportModalProps) {
  const { user } = useAuth();
  
  // États
  const [data, setData] = useState<ManaboxRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  
  // NOUVEAU : Mode d'importation
  const [importMode, setImportMode] = useState<'add' | 'sync'>('add'); 

  // Map pour accès rapide aux cartes existantes
  const existingMap = useMemo(() => {
    const map = new Map<string, ExistingCard>();
    currentCollection.forEach(card => {
        const key = card.scryfallId || card.id; 
        map.set(key, card);
    });
    return map;
  }, [currentCollection]);

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

  const getCardInfo = (scryfallCard: ScryfallCard) => {
    let name = scryfallCard.name;
    let imageUrl = scryfallCard.image_uris?.normal;
    let imageBackUrl = null;

    if (scryfallCard.card_faces && scryfallCard.card_faces.length > 1) {
      name = scryfallCard.card_faces[0].name;
      if (!imageUrl && scryfallCard.card_faces[0].image_uris) {
        imageUrl = scryfallCard.card_faces[0].image_uris.normal;
      }
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

    const rowsToFetch: ManaboxRow[] = [];
    const rowsToUpdateDirectly: ManaboxRow[] = [];
    let skippedCount = 0;

    // --- LOGIQUE DE TRI SELON LE MODE ---
    data.forEach(row => {
        const scryfallId = row["Scryfall ID"];
        const csvQty = parseInt(row["Quantity"]) || 1;
        const csvFoil = row["Foil"] === "true";
        const existing = existingMap.get(scryfallId);

        if (existing) {
            // La carte existe déjà
            if (importMode === 'sync') {
                // MODE SYNC : On écrase. Si c'est pareil, on saute.
                if (existing.quantity === csvQty && existing.foil === csvFoil) {
                    skippedCount++;
                } else {
                    rowsToUpdateDirectly.push(row);
                }
            } else {
                // MODE ADD : On ajoute (Cumul). On ne saute jamais sauf si csvQty est 0.
                if (csvQty > 0) {
                    rowsToUpdateDirectly.push(row);
                }
            }
        } else {
            // Nouvelle carte (Besoin Scryfall dans les deux cas)
            rowsToFetch.push(row);
        }
    });

    console.log(`Mode: ${importMode.toUpperCase()} | Ignorées: ${skippedCount} | Update Rapide: ${rowsToUpdateDirectly.length} | Scryfall Fetch: ${rowsToFetch.length}`);

    let processedCount = skippedCount; 
    let successCount = 0;

    // 1. UPDATES RAPIDES (Sans Scryfall)
    if (rowsToUpdateDirectly.length > 0) {
        setStatusMsg("Mise à jour des quantités...");
        const updateChunks = chunkArray(rowsToUpdateDirectly, 400);

        for (const chunk of updateChunks) {
            const batch = writeBatch(db);
            chunk.forEach(row => {
                const cardRef = doc(db, 'users', user.uid, targetCollection, row["Scryfall ID"]);
                const qtyToAdd = parseInt(row["Quantity"]);
                
                // C'est ICI que tout se joue
                if (importMode === 'sync') {
                    // SYNC = On remplace la valeur
                    batch.update(cardRef, {
                        quantity: qtyToAdd, // REMPLACE
                        foil: row["Foil"] === "true",
                        price: parseFloat(row["Purchase price"]) || 0,
                        condition: row["Condition"],
                        language: row["Language"]
                    });
                } else {
                    // ADD = On additionne (incrément)
                    batch.update(cardRef, {
                        quantity: increment(qtyToAdd), // AJOUTE
                        // Note : Pour foil/condition en mode ajout, c'est complexe. 
                        // Ici on garde les infos du CSV pour la dernière version importée.
                        foil: row["Foil"] === "true",
                        price: parseFloat(row["Purchase price"]) || 0,
                        importedAt: new Date()
                    });
                }
                successCount++;
            });
            await batch.commit();
            processedCount += chunk.length;
            setProgress(Math.round((processedCount / data.length) * 100));
        }
    }

    // 2. NOUVELLES CARTES (Avec Scryfall)
    if (rowsToFetch.length > 0) {
        setStatusMsg("Récupération des nouvelles cartes...");
        const fetchChunks = chunkArray(rowsToFetch, 75);

        for (const chunk of fetchChunks) {
            try {
                const identifiers = chunk.map(row => ({ id: row["Scryfall ID"] }));
                
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
                        const cardRef = doc(db, 'users', user.uid, targetCollection, scryfallData.id);
                        
                        // Pour une nouvelle carte, Add ou Sync c'est pareil : on crée avec la quantité initiale
                        batch.set(cardRef, {
                            name: name,
                            imageUrl: imageUrl,
                            imageBackUrl: imageBackUrl,
                            setName: scryfallData.set_name,
                            setCode: scryfallData.set,
                            quantity: parseInt(row["Quantity"]), 
                            price: parseFloat(scryfallData.prices?.eur || "0"),
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
                console.error("Erreur lot Scryfall", error);
            }
            processedCount += chunk.length;
            setProgress(Math.round((processedCount / data.length) * 100));
            await new Promise(r => setTimeout(r, 100));
        }
    }

    toast.success(`${successCount} cartes traitées avec succès !`);
    onClose();
    setData([]);
    setStep('upload');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Importer / Synchroniser</h2>
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

            {/* ÉTAPE DE CHOIX DU MODE */}
            {step === 'preview' && (
                <div className="flex flex-col h-full">
                    
                    {/* SÉLECTEUR DE MODE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Option 1: Ajouter */}
                        <div 
                            onClick={() => setImportMode('add')}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col gap-2
                                ${importMode === 'add' 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                        >
                            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'add' ? 'border-blue-600 bg-blue-600' : 'border-gray-400'}`}>
                                    {importMode === 'add' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                                </span>
                                Ajouter (Cumuler)
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                                Idéal pour ajouter quelques nouvelles cartes.<br/>
                                <em>Ex: J'ai 4 "Sol Ring", j'importe un fichier avec 1 "Sol Ring" → Résultat : 5.</em>
                            </p>
                        </div>

                        {/* Option 2: Synchroniser */}
                        <div 
                            onClick={() => setImportMode('sync')}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col gap-2
                                ${importMode === 'sync' 
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}
                        >
                            <div className="flex items-center gap-2 font-bold text-purple-700 dark:text-purple-300">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'sync' ? 'border-purple-600 bg-purple-600' : 'border-gray-400'}`}>
                                    {importMode === 'sync' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                                </span>
                                Synchroniser (Remplacer)
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                                Idéal pour mettre à jour toute la collection.<br/>
                                <em>Ex: J'ai 4 "Sol Ring", j'importe un fichier avec 1 "Sol Ring" → Résultat : 1.</em>
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-sm font-semibold">{data.length} cartes détectées</span>
                        <button onClick={() => { setData([]); setStep('upload'); }} className="text-red-500 text-xs hover:underline">Changer de fichier</button>
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

                    <button 
                        onClick={startImport} 
                        className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:-translate-y-0.5
                            ${importMode === 'add' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                        {importMode === 'add' ? '➕ Lancer l\'Ajout' : '🔄 Lancer la Synchronisation'}
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
                </div>
            )}
        </div>
      </div>
    </div>
  );
}