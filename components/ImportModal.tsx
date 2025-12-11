// components/ImportModal.tsx
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
  const [inputType, setInputType] = useState<'file' | 'text'>('file'); // Onglets
  const [textInput, setTextInput] = useState(''); // Contenu du textarea
  
  const [data, setData] = useState<ManaboxRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  
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

  // --- GESTION FICHIER CSV ---
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

  // --- GESTION TEXTE (Archidekt style) ---
  const handleTextParse = () => {
    if (!textInput.trim()) return;

    const rows: ManaboxRow[] = [];
    const lines = textInput.split('\n');

    // Regex pour : "1 Name (SET) 123 *F*"
    // Group 1: Qty, Group 2: Name, Group 3: Set, Group 4: CollectorNum, Group 5: Foil (*F*)
    const regex = /^(\d+)\s+(.+?)\s+\((\w+)\)\s+(\S+)(?:\s+\*(F)\*)?/;

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        const match = cleanLine.match(regex);
        if (match) {
            rows.push({
                "Quantity": match[1],
                "Name": match[2], // "The Legend of Yangchen // Avatar Yangchen"
                "Set code": match[3].toLowerCase(), // "TLA" -> "tla"
                "Collector number": match[4],
                "Foil": match[5] === 'F' ? "true" : "false",
                // Champs vides (seront récupérés par Scryfall ou ignorés)
                "Scryfall ID": "", 
                "Binder Name": "Import Texte",
                "Set name": "",
                "Rarity": "",
                "ManaBox ID": "",
                "Purchase price": "0",
                "Language": "en", // Défaut anglais pour import texte
                "Condition": "Near Mint"
            });
        }
    });

    if (rows.length === 0) {
        toast.error("Aucune carte reconnue. Vérifiez le format.");
        return;
    }

    setColumns(["Name", "Set code", "Quantity", "Foil", "Collector number"]); // Colonnes pertinentes
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

  const startImport = async () => {
    if (!user) return;
    setStep('importing');
    setProgress(0);

    const rowsToFetch: ManaboxRow[] = [];
    const rowsToUpdateDirectly: ManaboxRow[] = [];
    let skippedCount = 0;

    data.forEach(row => {
        const scryfallId = row["Scryfall ID"];
        // Pour le texte, scryfallId est vide, donc on ira toujours dans "rowsToFetch"
        // C'est normal : on doit demander à l'API de trouver l'ID.
        
        const csvQty = parseInt(row["Quantity"]) || 1;
        const csvFoil = row["Foil"] === "true";
        const existing = scryfallId ? existingMap.get(scryfallId) : undefined;

        if (existing) {
            if (importMode === 'sync') {
                if (existing.quantity === csvQty && existing.foil === csvFoil) {
                    skippedCount++;
                } else {
                    rowsToUpdateDirectly.push(row);
                }
            } else {
                if (csvQty > 0) rowsToUpdateDirectly.push(row);
            }
        } else {
            rowsToFetch.push(row);
        }
    });

    let processedCount = skippedCount; 
    let successCount = 0;

    // 1. UPDATES RAPIDES (Seulement si ID connu -> CSV)
    if (rowsToUpdateDirectly.length > 0) {
        setStatusMsg("Mise à jour directe...");
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

    // 2. RECUPERATION SCRYFALL (Pour Texte ET Nouvelles cartes CSV)
    if (rowsToFetch.length > 0) {
        setStatusMsg("Identification des cartes...");
        const fetchChunks = chunkArray(rowsToFetch, 75);

        for (const chunk of fetchChunks) {
            try {
                // Si pas d'ID (Import Texte), on envoie Nom + Set
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
                
                // On doit faire correspondre la réponse Scryfall à nos lignes
                // Scryfall renvoie les cartes trouvées, mais pas forcément dans l'ordre exact si échec.
                // Stratégie : On map par ID ou par Nom+Set
                
                const batch = writeBatch(db);
                
                // Pour chaque carte trouvée par Scryfall, on cherche la ligne correspondante dans notre chunk
                // (Note: C'est une simplification, Scryfall /collection renvoie 'found' et 'not_found', 
                // mais ici on itère sur les résultats trouvés)
                
                foundCards.forEach(scryfallData => {
                    // On cherche la ligne qui correspond à cette carte trouvée
                    // On cherche d'abord par ID si présent, sinon par set+collector number
                    const matchingRow = chunk.find(r => 
                        r["Scryfall ID"] === scryfallData.id || 
                        (r["Set code"] === scryfallData.set && (r["Name"] === scryfallData.name || r["Name"].startsWith(scryfallData.name.split(" //")[0])))
                    );

                    if (matchingRow) {
                        const { name, imageUrl, imageBackUrl } = getCardInfo(scryfallData);
                        const cardRef = doc(db, 'users', user.uid, targetCollection, scryfallData.id);
                        
                        // Logique d'ajout/Sync pour les "nouvelles" cartes (ou celles identifiées via texte)
                        // Si la carte existe DÉJÀ en base (mais qu'on l'a pas vue car pas d'ID dans le texte), 
                        // Firebase merge ou écrase selon nos souhaits.
                        // Pour faire simple : le texte agit comme un "Add" ou un "Sync" via le merge.
                        
                        const qty = parseInt(matchingRow["Quantity"]);

                        if (importMode === 'add') {
                             batch.set(cardRef, {
                                name, imageUrl, imageBackUrl,
                                setName: scryfallData.set_name, setCode: scryfallData.set,
                                scryfallId: scryfallData.id,
                                price: parseFloat(scryfallData.prices?.eur || "0"),
                                quantity: increment(qty), // On incrémente si existe déjà
                                foil: matchingRow["Foil"] === "true",
                                importedAt: new Date()
                            }, { merge: true });
                        } else {
                             // Sync : On force la valeur
                             batch.set(cardRef, {
                                name, imageUrl, imageBackUrl,
                                setName: scryfallData.set_name, setCode: scryfallData.set,
                                scryfallId: scryfallData.id,
                                price: parseFloat(scryfallData.prices?.eur || "0"),
                                quantity: qty, // On écrase
                                foil: matchingRow["Foil"] === "true",
                                importedAt: new Date()
                            }, { merge: true });
                        }
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

    toast.success(`${successCount} cartes traitées !`);
    onClose();
    setData([]);
    setTextInput('');
    setStep('upload');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ajouter des cartes</h2>
          {!step.includes('importing') && (
             <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          )}
        </div>

        <div className="flex-grow overflow-hidden flex flex-col">
            
            {/* ETAPE 1 : CHOIX INPUT */}
            {step === 'upload' && (
                <div className="flex flex-col h-full">
                    
                    {/* ONGLETS */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                        <button 
                            onClick={() => setInputType('file')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            📂 Fichier CSV
                        </button>
                        <button 
                            onClick={() => setInputType('text')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'text' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            📝 Copier / Coller
                        </button>
                    </div>

                    {inputType === 'file' ? (
                        <div className="flex-grow p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative cursor-pointer group">
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" />
                            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📂</div>
                            <p className="font-bold text-lg">Déposer CSV Manabox</p>
                        </div>
                    ) : (
                        <div className="flex-grow flex flex-col">
                            <textarea 
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder={`Collez votre liste ici (Format Archidekt/Arena). Exemple :\n\n1 The Legend of Yangchen // Avatar Yangchen (TLA) 27\n1 Sol Ring (CMM) 410\n1 Suki, Courageous Rescuer (TLA) 37 *F*`}
                                className="flex-grow w-full p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                            <button 
                                onClick={handleTextParse}
                                disabled={!textInput.trim()}
                                className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition"
                            >
                                Analyser le texte
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ETAPE 2 : PREVIEW & MODE (inchangé) */}
            {step === 'preview' && (
                <div className="flex flex-col h-full">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div 
                            onClick={() => setImportMode('add')}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col gap-2
                                ${importMode === 'add' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                        >
                            <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-300">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'add' ? 'border-blue-600 bg-blue-600' : 'border-gray-400'}`}>
                                    {importMode === 'add' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                                </span>
                                Ajouter (Cumuler)
                            </div>
                            <p className="text-xs text-gray-500 ml-6">Ajoute les quantités (+1).</p>
                        </div>

                        <div 
                            onClick={() => setImportMode('sync')}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col gap-2
                                ${importMode === 'sync' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}
                        >
                            <div className="flex items-center gap-2 font-bold text-purple-700 dark:text-purple-300">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'sync' ? 'border-purple-600 bg-purple-600' : 'border-gray-400'}`}>
                                    {importMode === 'sync' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                                </span>
                                Synchroniser (Remplacer)
                            </div>
                            <p className="text-xs text-gray-500 ml-6">Remplace la quantité (=1).</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-sm font-semibold">{data.length} cartes détectées</span>
                        <button onClick={() => { setData([]); setStep('upload'); }} className="text-red-500 text-xs hover:underline">Retour</button>
                    </div>

                    <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg flex-grow bg-gray-50 dark:bg-gray-900 mb-4">
                        <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-gray-700 bg-gray-200 dark:bg-gray-800 sticky top-0">
                                <tr>{columns.slice(0,6).map((col, i) => <th key={i} className="px-4 py-2">{col}</th>)}</tr>
                            </thead>
                            <tbody>
                                {data.slice(0, 50).map((row, i) => (
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

            {/* ETAPE 3 : CHARGEMENT (inchangé) */}
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