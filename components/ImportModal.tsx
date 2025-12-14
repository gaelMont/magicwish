'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';
import AdContainer from './AdContainer'; 
import { updateUserStats } from '@/app/actions/stats';
import { checkWishlistMatch } from '@/app/actions/matching'; // <--- IMPORT

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

interface ScryfallImageUris {
    normal?: string;
}
interface ScryfallCardFace {
    name: string;
    image_uris?: ScryfallImageUris;
}

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  prices?: { eur?: string; usd?: string };
  image_uris?: ScryfallImageUris; 
  card_faces?: ScryfallCardFace[];
  [key: string]: unknown;
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
  targetCollection?: 'collection' | 'wishlist'; 
  currentCollection?: ExistingCard[];
  onGoBack: () => void; 
  onCloseAll: () => void; 
};

// --- Fonctions utilitaires ---

const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

const getCardInfo = (scryfallCard: ScryfallCard) => {
    let name = scryfallCard.name as string;
    let imageUrl = scryfallCard.image_uris?.normal;
    let imageBackUrl: string | null = null;
    
    const cardFaces = scryfallCard.card_faces;

    if (cardFaces && cardFaces.length > 1) {
        name = cardFaces[0].name;
        if (!imageUrl && cardFaces[0].image_uris?.normal) {
            imageUrl = cardFaces[0].image_uris.normal;
        }
        if (cardFaces[1]?.image_uris?.normal) {
            imageBackUrl = cardFaces[1].image_uris.normal;
        }
    }
    
    if (!imageUrl) {
        imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
    }

    return { name, imageUrl, imageBackUrl };
};

export default function ImportModal({ 
    isOpen, 
    targetCollection = 'collection', 
    currentCollection = [],
    onGoBack,
    onCloseAll
}: ImportModalProps) {
  const { user } = useAuth();
  
  const [inputType, setInputType] = useState<'csv' | 'text'>('csv'); 
  const [textInput, setTextInput] = useState('');
  
  const [data, setData] = useState<ManaboxRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [importMode, setImportMode] = useState<'add' | 'sync'>('add'); 

  const existingMap = useMemo(() => {
    const map = new Map<string, ExistingCard>();
    currentCollection.forEach(card => {
        map.set(card.id, { id: card.id, quantity: card.quantity, foil: card.foil });
    });
    return map;
  }, [currentCollection]);

  useEffect(() => {
    if (isOpen) {
        setStep('upload');
        setData([]);
        setTextInput('');
        setProgress(0);
        setInputType('csv');
    }
  }, [isOpen]);

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
    const regex = /^(\d+)\s+(.+?)\s+\((\w+)\)(?:\s+(\S+))?(?:\s+\*(F)\*)?/;

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        const match = cleanLine.match(regex);
        if (match) {
            rows.push({
                "Quantity": match[1], "Name": match[2], "Set code": match[3].toLowerCase(),
                "Collector number": match[4] || '', "Foil": match[5] === 'F' ? "true" : "false",
                "Scryfall ID": "", "Binder Name": "Import Texte", "Set name": "", "Rarity": "", 
                "ManaBox ID": "", "Purchase price": "0", "Language": "en", "Condition": "Near Mint"
            });
        }
    });

    if (rows.length === 0) {
        toast.error("Format de texte non reconnu.");
        return;
    }
    setColumns(["Name", "Set code", "Quantity", "Foil", "Collector number"]);
    setData(rows);
    setStep('preview');
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
        const csvQty = parseInt(row["Quantity"]) || 1;
        const csvFoil = row["Foil"] === "true";
        const existing = scryfallId ? existingMap.get(scryfallId) : undefined;

        if (existing) {
            if (importMode === 'sync') {
                const existingFoil = !!existing.foil;
                if (existing.quantity === csvQty && existingFoil === csvFoil) {
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

    if (rowsToUpdateDirectly.length > 0) {
        setStatusMsg("Mise à jour rapide des cartes existantes...");
        const updateChunks = chunkArray(rowsToUpdateDirectly, 400);

        for (const chunk of updateChunks) {
            const batch = writeBatch(db);
            chunk.forEach(row => {
                if (!row["Scryfall ID"]) return; 
                
                const collectionPath = targetCollection === 'wishlist' ? 'wishlist' : 'collection'; 
                const cardRef = doc(db, 'users', user.uid, collectionPath, row["Scryfall ID"]);
                const qty = parseInt(row["Quantity"]);
                const isFoil = row["Foil"] === "true";
                
                if (importMode === 'sync') {
                    batch.update(cardRef, { quantity: qty, isFoil: isFoil });
                } else {
                    batch.update(cardRef, { quantity: increment(qty), isFoil: isFoil, importedAt: new Date() });
                }
                successCount++;
            });
            await batch.commit();
            processedCount += chunk.length;
            setProgress(Math.round((processedCount / data.length) * 100));
        }
    }

    if (rowsToFetch.length > 0) {
        setStatusMsg("Identification des cartes...");
        const fetchChunks = chunkArray(rowsToFetch, 75);

        for (const chunk of fetchChunks) {
            try {
                const identifiers = chunk.map(row => {
                    if (row["Scryfall ID"]) return { id: row["Scryfall ID"] };
                    if (row["Collector number"] && row["Set code"]) {
                         return { name: row["Name"], set: row["Set code"], collector_number: row["Collector number"] }; 
                    }
                    return { name: row["Name"], set: row["Set code"] || 'any' }; 
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
                    const scryfallName = (scryfallData.name as string).split(' // ')[0].trim().toLowerCase();
                    const scryfallSetCode = scryfallData.set ? (scryfallData.set as string).toLowerCase() : '';
                    
                    const matchingRow = chunk.find(r => 
                        r["Scryfall ID"] === scryfallData.id || 
                        (r["Name"].split(' // ')[0].trim().toLowerCase() === scryfallName && 
                         r["Set code"]?.toLowerCase() === scryfallSetCode)
                    );

                    if (matchingRow) {
                        const csvQty = parseInt(matchingRow["Quantity"]);
                        const csvFoil = matchingRow["Foil"] === "true";
                        
                        const existing = existingMap.get(scryfallData.id);
                        let shouldWrite = true;

                        if (existing && importMode === 'sync') {
                            const existingFoil = !!existing.foil;
                            if (existing.quantity === csvQty && existingFoil === csvFoil) {
                                shouldWrite = false;
                                skippedCount++;
                            }
                        }

                        if (shouldWrite) {
                            const { name: cardName, imageUrl, imageBackUrl } = getCardInfo(scryfallData);
                            
                            const collectionPath = targetCollection === 'wishlist' ? 'wishlist' : 'collection'; 
                            const cardRef = doc(db, 'users', user.uid, collectionPath, scryfallData.id);
                            
                            const cardData = {
                                name: cardName, imageUrl, imageBackUrl,
                                setName: scryfallData.set_name as string, setCode: scryfallData.set as string,
                                scryfallId: scryfallData.id,
                                price: parseFloat((scryfallData.prices as { eur?: string })?.eur || "0"),
                                isFoil: csvFoil,
                                importedAt: new Date(),
                                scryfallData: scryfallData,
                                wishlistId: targetCollection === 'wishlist' ? 'default' : null,
                                ...(targetCollection === 'collection' && { quantityForTrade: 0 })
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
            await new Promise(r => setTimeout(r, 100));
        }
    }

    toast.success(`${successCount} cartes synchronisée(s) !`, { duration: 4000 });
    
    // --- GESTION DES ACTIONS POST-IMPORT ---
    if (targetCollection === 'collection') {
        // Recalcul des stats si import en collection
        updateUserStats(user.uid).catch(e => console.error("Erreur update stats BG", e));
    } 
    else if (targetCollection === 'wishlist') {
        // NOUVEAU : Scan des matchs pour la Wishlist
        // On récupère les cartes ajoutées (simplifié via 'data')
        const cardsToCheck = data.map(row => ({
            id: row["Scryfall ID"] || '', // ID optionnel, le nom suffit pour la recherche
            name: row["Name"],
            isFoil: row["Foil"] === "true"
        })).filter(c => c.name); // Sécurité

        if (cardsToCheck.length > 0) {
            checkWishlistMatch(user.uid, cardsToCheck).then(res => {
                 if (res.matches && res.matches > 0) {
                     toast(`🎉 ${res.matches} cartes trouvées chez vos amis !`, { icon: '🔔', duration: 5000 });
                 }
            });
        }
    }

    onCloseAll();
  };

  if (!isOpen) return null;

  const targetLabel = targetCollection === 'collection' ? 'Collection' : 'Wishlist';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => step !== 'importing' && onGoBack()}>
      <div 
        className="bg-surface rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-border flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none flex justify-between items-center mb-4 border-b border-border pb-3">
            <div className="flex items-center gap-3">
                {step !== 'importing' && (
                    <button onClick={onGoBack} className="text-muted hover:text-foreground text-xl p-1 rounded transition">←</button>
                )}
                <h2 className="text-xl font-bold text-foreground">
                    📥 Importer : {targetLabel}
                </h2>
            </div>
            {step !== 'importing' && (
                <button onClick={onCloseAll} className="text-muted hover:text-danger text-lg p-2">✕</button>
            )}
        </div>

        <div className="grow overflow-hidden flex flex-col min-h-0">
            {step === 'upload' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <p className="text-sm text-muted mb-4 flex-none">
                        Collez vos données ou importez un fichier CSV (Manabox, Deckbox).
                    </p>
                    <div className="flex-none flex border-b border-border mb-4">
                        <button onClick={() => setInputType('csv')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'csv' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}>📄 Fichier CSV</button>
                        <button onClick={() => setInputType('text')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'text' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}>📝 Coller Texte</button>
                    </div>
                    
                    {inputType === 'csv' ? (
                        <div className="grow p-12 border-2 border-dashed border-border rounded-xl text-center hover:bg-secondary transition relative cursor-pointer group flex flex-col items-center justify-center">
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" />
                            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📂</div>
                            <p className="font-bold text-lg text-foreground">Déposer un fichier CSV</p>
                        </div>
                    ) : (
                        <div className="grow flex flex-col min-h-0">
                            <textarea 
                                value={textInput} 
                                onChange={(e) => setTextInput(e.target.value)} 
                                rows={15} 
                                placeholder="Collez votre liste ici..." 
                                className="grow w-full p-4 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary outline-none resize-none" 
                            />
                            <p className="text-xs text-muted my-2 text-center">Ex: 4 Sol Ring (CMD) 100</p>
                            <button 
                                onClick={handleTextParse} 
                                disabled={!textInput.trim()} 
                                className="flex-none mt-4 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-bold py-3 rounded-xl shadow-md transition"
                            >
                                Analyser le texte
                            </button>
                        </div>
                    )}
                </div>
            )}

            {step === 'preview' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <p className="text-sm text-muted mb-4 flex-none">
                        Vérifiez l&apos;aperçu et choisissez le mode d&apos;importation.
                    </p>
                    <div className="flex-none grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div onClick={() => setImportMode('add')} className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col gap-1 ${importMode === 'add' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'}`}>
                            <div className="flex items-center gap-2 font-bold text-primary text-sm">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'add' ? 'border-primary bg-primary' : 'border-muted'}`}>{importMode === 'add' && <span className="w-2 h-2 rounded-full bg-white"></span>}</span> Ajouter
                            </div>
                            <p className="text-[10px] text-muted ml-6">Ajoute (+1) aux quantités existantes.</p>
                        </div>
                        <div onClick={() => setImportMode('sync')} className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col gap-1 ${importMode === 'sync' ? 'border-purple-500 bg-purple-500/10' : 'border-border hover:border-purple-500'}`}>
                            <div className="flex items-center gap-2 font-bold text-purple-700 dark:text-purple-300 text-sm">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'sync' ? 'border-purple-600 bg-purple-600' : 'border-muted'}`}>{importMode === 'sync' && <span className="w-2 h-2 rounded-full bg-white"></span>}</span> Synchroniser
                            </div>
                            <p className="text-[10px] text-muted ml-6">Remplace (=1) la quantité en base.</p>
                        </div>
                    </div>
                    
                    <div className="flex-none flex justify-between items-center mb-2 px-1">
                        <span className="text-sm font-semibold text-foreground">{data.length} cartes détectées</span>
                        <button onClick={() => { setData([]); setStep('upload'); }} className="text-danger text-xs hover:underline">Retour</button>
                    </div>
                    <div className="grow overflow-auto min-h-0 border border-border rounded-lg bg-background">
                        <table className="w-full text-xs text-left text-muted">
                            <thead className="text-foreground bg-secondary sticky top-0 z-10">
                                <tr>{columns.slice(0,6).map((col, i) => <th key={i} className="px-4 py-2">{col}</th>)}</tr>
                            </thead>
                            <tbody>
                                {data.map((row, i) => (
                                    <tr key={i} className="bg-surface border-b border-border">
                                        {columns.slice(0,6).map((col, j) => <td key={j} className="px-4 py-1 truncate max-w-[150px] text-foreground">{row[col as keyof ManaboxRow]}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex-none pt-4">
                        <button onClick={startImport} className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:scale-[1.005] ${importMode === 'add' ? 'bg-primary hover:opacity-90' : 'bg-purple-600 hover:opacity-90'}`}>
                            {importMode === 'add' ? '➕ Valider l\'Ajout' : '🔄 Valider la Synchronisation'}
                        </button>
                    </div>
                </div>
            )}

           {step === 'importing' && (
                <div className="flex flex-col items-center justify-center h-full py-10">
                    <div className="text-5xl font-bold text-primary mb-2">{progress}%</div>
                    <p className="text-muted animate-pulse mb-6">{statusMsg}</p>
                    
                    <div className="w-full bg-secondary rounded-full h-4 overflow-hidden max-w-md mb-8">
                        <div className="bg-primary h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="w-full max-w-md">
                        <AdContainer message="Sponsorisé" adSlotId="1234567890" />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}