// components/ImportModal.tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [textInput, setTextInput] = useState('');
  
  const [data, setData] = useState<ManaboxRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success'>('upload');
  
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [importMode, setImportMode] = useState<'add' | 'sync'>('add'); 
  
  const [resultStats, setResultStats] = useState({ success: 0, ignored: 0 });

  // Map pour accès rapide (Hashmap)
  const existingMap = useMemo(() => {
    const map = new Map<string, ExistingCard>();
    currentCollection.forEach(card => {
        // On utilise l'ID Firestore (qui est l'ID Scryfall) comme clé
        const key = card.id; 
        map.set(key, card);
    });
    return map;
  }, [currentCollection]);

  // --- FERMETURE ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape' && step !== 'importing') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step]);

  const handleClose = () => {
    if (step === 'importing') return; 
    onClose();
    setTimeout(() => {
      setStep('upload');
      setData([]);
      setTextInput('');
      setProgress(0);
      setResultStats({ success: 0, ignored: 0 });
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && step !== 'importing') handleClose();
  };

  if (!isOpen) return null;

  // --- LOGIQUE PARSING ---
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
      error: (error) => toast.error("Erreur CSV : " + error.message)
    });
  };

  const handleTextParse = () => {
    if (!textInput.trim()) return;

    const rows: ManaboxRow[] = [];
    const lines = textInput.split('\n');
    const regex = /^(\d+)\s+(.+?)\s+\((\w+)\)\s+(\S+)(?:\s+\*(F)\*)?/;

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        const match = cleanLine.match(regex);
        if (match) {
            rows.push({
                "Quantity": match[1],
                "Name": match[2],
                "Set code": match[3].toLowerCase(),
                "Collector number": match[4],
                "Foil": match[5] === 'F' ? "true" : "false",
                "Scryfall ID": "", // Vide pour le moment
                "Binder Name": "Import Texte",
                "Set name": "",
                "Rarity": "",
                "ManaBox ID": "",
                "Purchase price": "0",
                "Language": "en",
                "Condition": "Near Mint"
            });
        }
    });

    if (rows.length === 0) {
        toast.error("Format non reconnu.");
        return;
    }
    setColumns(["Name", "Set code", "Quantity", "Foil", "Collector number"]);
    setData(rows);
    setStep('preview');
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

  // --- LOGIQUE IMPORTATION (CORRIGÉE) ---
  const startImport = async () => {
    if (!user) return;
    setStep('importing');
    setProgress(0);

    const rowsToFetch: ManaboxRow[] = [];
    const rowsToUpdateDirectly: ManaboxRow[] = [];
    let skippedCount = 0;

    // 1. TRI PRELIMINAIRE (Ceux qui ont déjà un ID Scryfall dans le CSV)
    data.forEach(row => {
        const scryfallId = row["Scryfall ID"];
        const csvQty = parseInt(row["Quantity"]) || 1;
        const csvFoil = row["Foil"] === "true";
        const existing = scryfallId ? existingMap.get(scryfallId) : undefined;

        if (existing) {
            // Cas CSV avec ID connu
            if (importMode === 'sync') {
                const existingFoil = existing.foil ?? false; // Gérer le cas undefined
                if (existing.quantity === csvQty && existingFoil === csvFoil) {
                    skippedCount++;
                } else {
                    rowsToUpdateDirectly.push(row);
                }
            } else {
                if (csvQty > 0) rowsToUpdateDirectly.push(row);
            }
        } else {
            // Cas Texte OU Nouvelle carte CSV -> On doit demander à Scryfall
            rowsToFetch.push(row);
        }
    });

    let processedCount = skippedCount; 
    let successCount = 0;

    // 2. TRAITEMENT DIRECT (Rapide)
    if (rowsToUpdateDirectly.length > 0) {
        setStatusMsg("Mise à jour rapide...");
        const updateChunks = chunkArray(rowsToUpdateDirectly, 400);

        for (const chunk of updateChunks) {
            const batch = writeBatch(db);
            chunk.forEach(row => {
                const cardRef = doc(db, 'users', user.uid, targetCollection, row["Scryfall ID"]);
                const qtyToAdd = parseInt(row["Quantity"]);
                
                if (importMode === 'sync') {
                    batch.update(cardRef, {
                        quantity: qtyToAdd,
                        foil: row["Foil"] === "true",
                        price: parseFloat(row["Purchase price"]) || 0,
                    });
                } else {
                    batch.update(cardRef, {
                        quantity: increment(qtyToAdd),
                        foil: row["Foil"] === "true",
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

    // 3. TRAITEMENT SCRYFALL (Lent) + CHECK SECONDAIRE
    if (rowsToFetch.length > 0) {
        setStatusMsg("Identification et vérification...");
        const fetchChunks = chunkArray(rowsToFetch, 75);

        for (const chunk of fetchChunks) {
            try {
                const identifiers = chunk.map(row => {
                    if (row["Scryfall ID"]) return { id: row["Scryfall ID"] };
                    return { name: row["Name"], set: row["Set code"], collector_number: row["Collector number"] };
                });
                
                const response = await fetch('https://api.scryfall.com/cards/collection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifiers })
                });

                const result = await response.json();
                const foundCards: ScryfallCard[] = result.data || [];
                const batch = writeBatch(db);
                let batchHasOps = false;
                
                foundCards.forEach(scryfallData => {
                    // Retrouver la ligne d'origine (Mapping approximatif par Nom/Set si ID manquant)
                    const matchingRow = chunk.find(r => 
                        r["Scryfall ID"] === scryfallData.id || 
                        (r["Set code"] === scryfallData.set && r["Name"].includes(scryfallData.name.split(" //")[0]))
                    );

                    if (matchingRow) {
                        const csvQty = parseInt(matchingRow["Quantity"]);
                        const csvFoil = matchingRow["Foil"] === "true";
                        
                        // --- LA CORRECTION EST ICI ---
                        // Maintenant qu'on a l'ID Scryfall, on vérifie SI ON L'A DÉJÀ EN BASE
                        const existing = existingMap.get(scryfallData.id);
                        let shouldWrite = true;

                        if (existing && importMode === 'sync') {
                            const existingFoil = existing.foil ?? false;
                            // Si c'est EXACTEMENT pareil, on ignore
                            if (existing.quantity === csvQty && existingFoil === csvFoil) {
                                shouldWrite = false;
                                skippedCount++; // On incrémente le compteur global d'ignorés
                            }
                        }

                        if (shouldWrite) {
                            const { name, imageUrl, imageBackUrl } = getCardInfo(scryfallData);
                            const cardRef = doc(db, 'users', user.uid, targetCollection, scryfallData.id);
                            
                            const cardData = {
                                name, imageUrl, imageBackUrl,
                                setName: scryfallData.set_name, setCode: scryfallData.set,
                                scryfallId: scryfallData.id,
                                price: parseFloat(scryfallData.prices?.eur || "0"),
                                foil: csvFoil,
                                importedAt: new Date()
                            };

                            if (importMode === 'add') {
                                 batch.set(cardRef, { ...cardData, quantity: increment(csvQty) }, { merge: true });
                            } else {
                                 batch.set(cardRef, { ...cardData, quantity: csvQty }, { merge: true });
                            }
                            successCount++;
                            batchHasOps = true;
                        }
                    }
                });

                if (batchHasOps) {
                    await batch.commit();
                }
                
            } catch (error) {
                console.error("Erreur Scryfall", error);
            }
            processedCount += chunk.length;
            setProgress(Math.round((processedCount / data.length) * 100));
            // Petit délai pour API
            await new Promise(r => setTimeout(r, 100));
        }
    }

    setResultStats({ success: successCount, ignored: skippedCount });
    setStep('success');
    toast.success("Terminé !");
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex-none flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {step === 'success' ? 'Résultat' : 'Ajouter des cartes'}
          </h2>
          {step !== 'importing' && (
             <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 text-lg p-2">✕</button>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex-grow overflow-hidden flex flex-col min-h-0">
            
            {step === 'upload' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex-none flex border-b border-gray-200 dark:border-gray-700 mb-4">
                        <button onClick={() => setInputType('file')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📂 Fichier CSV</button>
                        <button onClick={() => setInputType('text')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'text' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>📝 Copier / Coller</button>
                    </div>
                    {inputType === 'file' ? (
                        <div className="flex-grow p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative cursor-pointer group flex flex-col items-center justify-center">
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" />
                            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📂</div>
                            <p className="font-bold text-lg">Déposer CSV Manabox</p>
                        </div>
                    ) : (
                        <div className="flex-grow flex flex-col min-h-0">
                            <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={15} placeholder="Collez votre liste ici..." className="flex-grow w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            <button onClick={handleTextParse} disabled={!textInput.trim()} className="flex-none mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition">Analyser le texte</button>
                        </div>
                    )}
                </div>
            )}

            {step === 'preview' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex-none grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div onClick={() => setImportMode('add')} className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col gap-1 ${importMode === 'add' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300 text-sm">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'add' ? 'border-blue-600 bg-blue-600' : 'border-gray-400'}`}>{importMode === 'add' && <span className="w-2 h-2 rounded-full bg-white"></span>}</span> Ajouter
                            </div>
                            <p className="text-[10px] text-gray-500 ml-6">Ajoute (+1) aux quantités existantes.</p>
                        </div>
                        <div onClick={() => setImportMode('sync')} className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col gap-1 ${importMode === 'sync' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}>
                            <div className="flex items-center gap-2 font-bold text-purple-700 dark:text-purple-300 text-sm">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'sync' ? 'border-purple-600 bg-purple-600' : 'border-gray-400'}`}>{importMode === 'sync' && <span className="w-2 h-2 rounded-full bg-white"></span>}</span> Synchroniser
                            </div>
                            <p className="text-[10px] text-gray-500 ml-6">Remplace (=1) la quantité en base.</p>
                        </div>
                    </div>
                    <div className="flex-none flex justify-between items-center mb-2 px-1">
                        <span className="text-sm font-semibold">{data.length} cartes détectées</span>
                        <button onClick={() => { setData([]); setStep('upload'); }} className="text-red-500 text-xs hover:underline">Retour</button>
                    </div>
                    <div className="flex-grow overflow-auto min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                        <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-gray-700 bg-gray-200 dark:bg-gray-800 sticky top-0 z-10">
                                <tr>{columns.slice(0,6).map((col, i) => <th key={i} className="px-4 py-2">{col}</th>)}</tr>
                            </thead>
                            <tbody>
                                {data.map((row, i) => (
                                    <tr key={i} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                        {columns.slice(0,6).map((col, j) => <td key={j} className="px-4 py-1 truncate max-w-[150px]">{row[col as keyof ManaboxRow]}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex-none pt-4">
                        <button onClick={startImport} className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:-translate-y-0.5 ${importMode === 'add' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                            {importMode === 'add' ? '➕ Valider l\'Ajout' : '🔄 Valider la Synchronisation'}
                        </button>
                    </div>
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

            {step === 'success' && (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6">✅</div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Opération Terminée !</h3>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8 mt-4">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
                            <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">Traitées</p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{resultStats.success}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Ignorées</p>
                            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{resultStats.ignored}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold shadow-lg transition transform hover:-translate-y-0.5">Fermer</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}