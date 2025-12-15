// components/ImportModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { importCardsAction, ImportItemInput } from '@/app/actions/import';
import AdContainer from './AdContainer'; 

type CsvRow = {
  "Name": string;
  "Set code": string;
  "Collector number": string;
  "Foil": string;
  "Quantity": string;
  "Scryfall ID": string; 
  [key: string]: string; 
};

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetCollection?: 'collection' | 'wishlist'; 
  // NOUVEAU PROP OPTIONNEL
  listId?: string;
  onGoBack?: () => void; 
  onCloseAll?: () => void;
};

export default function ImportModal({ 
    isOpen, 
    onClose,
    targetCollection = 'collection',
    // Valeur par défaut 'default'
    listId = 'default',
    onGoBack,
    onCloseAll
}: ImportModalProps) {
  const { user } = useAuth();
  
  const [inputType, setInputType] = useState<'csv' | 'text'>('csv'); 
  const [textInput, setTextInput] = useState('');
  
  const [data, setData] = useState<CsvRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [importMode, setImportMode] = useState<'add' | 'sync'>('add'); 

  useEffect(() => {
    if (isOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep('upload');
        setData([]);
        setTextInput('');
        setInputType('csv');
        setImportMode('add');
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
        const fields = results.meta.fields || [];
        if (!fields.includes("Name") && !fields.includes("Scryfall ID")) {
            toast.error("Format CSV non reconnu (Manabox ou Deckbox requis)");
            return;
        }
        setData(results.data as CsvRow[]);
        setStep('preview');
      },
      error: (error) => toast.error("Erreur lecture CSV : " + error.message)
    });
  };

  const handleTextParse = () => {
    if (!textInput.trim()) return;

    const rows: CsvRow[] = [];
    const lines = textInput.split('\n');
    
    // Regex adaptée pour "1x Nom (SET) Num"
    const regex = /^(\d+)x?\s+(.+?)\s+\(([a-zA-Z0-9]+)\)\s+(\S+)(?:\s+\*(F)\*)?/i;

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        
        const match = cleanLine.match(regex);
        if (match) {
            rows.push({
                "Quantity": match[1],
                "Name": match[2],
                "Set code": match[3].toLowerCase(),
                "Collector number": match[4] || '',
                "Foil": match[5] === 'F' ? "true" : "false",
                "Scryfall ID": ""
            });
        }
    });

    if (rows.length === 0) {
        toast.error("Aucune ligne valide reconnue.");
        return;
    }
    setData(rows);
    setStep('preview');
  };

  const startImport = async () => {
    if (!user) return;
    setStep('importing');

    const cleanItems: ImportItemInput[] = data.map(row => ({
        scryfallId: row["Scryfall ID"] || undefined,
        name: row["Name"] || "Unknown",
        set: row["Set code"] || "",
        collectorNumber: row["Collector number"] || "",
        quantity: parseInt(row["Quantity"]) || 1,
        isFoil: row["Foil"]?.toLowerCase() === "true"
    })).filter(item => item.name !== "Unknown" || item.scryfallId);

    if (cleanItems.length === 0) {
        toast.error("Aucune donnée valide à importer.");
        setStep('preview');
        return;
    }

    try {
        const result = await importCardsAction(
            user.uid,
            targetCollection,
            importMode,
            cleanItems,
            listId // TRANSMISSION DE L'ID
        );

        if (result.success) {
            toast.success(`Opération terminée. ${result.count} cartes traitées.`);
            if (onCloseAll) onCloseAll();
            else onClose();
        } else {
            toast.error(`Erreur: ${result.error}`);
            setStep('preview');
        }

    } catch (e) {
        console.error("Erreur client import:", e);
        toast.error("Erreur de communication avec le serveur.");
        setStep('preview');
    }
  };

  const handleBackdropClick = () => {
      if (step !== 'importing') {
          if (onGoBack) onGoBack();
          else onClose();
      }
  };

  if (!isOpen) return null;

  const targetLabel = targetCollection === 'collection' ? 'Collection' : 'Wishlist';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={handleBackdropClick}>
      <div 
        className="bg-surface rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-border flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none flex justify-between items-center mb-4 border-b border-border pb-3">
            <div className="flex items-center gap-3">
                {step !== 'importing' && onGoBack && (
                    <button onClick={onGoBack} className="text-muted hover:text-foreground text-xl p-1 rounded transition">←</button>
                )}
                <h2 className="text-xl font-bold text-foreground">
                    Importer : {targetLabel} {listId !== 'default' && <span className="text-xs font-normal text-muted ml-2">({listId})</span>}
                </h2>
            </div>
            {step !== 'importing' && onCloseAll && (
                <button onClick={onCloseAll} className="text-muted hover:text-danger text-lg p-2">✕</button>
            )}
        </div>

        <div className="grow overflow-hidden flex flex-col min-h-0">
            {step === 'upload' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <p className="text-sm text-muted mb-4 flex-none">
                        Formats supportés : Manabox (CSV), Deckbox (CSV), ou texte copié.
                    </p>
                    <div className="flex-none flex border-b border-border mb-4">
                        <button onClick={() => setInputType('csv')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'csv' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}>Fichier CSV</button>
                        <button onClick={() => setInputType('text')} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${inputType === 'text' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}>Coller Texte</button>
                    </div>
                    
                    {inputType === 'csv' ? (
                        <div className="grow p-12 border-2 border-dashed border-border rounded-xl text-center hover:bg-secondary transition relative cursor-pointer group flex flex-col items-center justify-center">
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" />
                            <div className="text-6xl mb-4 text-muted">[CSV]</div>
                            <p className="font-bold text-lg text-foreground">Déposer un fichier CSV</p>
                        </div>
                    ) : (
                        <div className="grow flex flex-col min-h-0">
                            <textarea 
                                value={textInput} 
                                onChange={(e) => setTextInput(e.target.value)} 
                                rows={15} 
                                placeholder="Ex: 1x Sol Ring (CMD) 100 *F*" 
                                className="grow w-full p-4 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary outline-none resize-none" 
                            />
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
                        {data.length} cartes détectées.
                    </p>
                    <div className="flex-none grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div onClick={() => setImportMode('add')} className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col gap-1 ${importMode === 'add' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                            <div className="flex items-center gap-2 font-bold text-primary text-sm">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'add' ? 'border-primary bg-primary' : 'border-muted'}`}>{importMode === 'add' && <span className="w-2 h-2 rounded-full bg-white"></span>}</span> 
                                Mode Ajout (Add)
                            </div>
                        </div>
                        <div onClick={() => setImportMode('sync')} className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col gap-1 ${importMode === 'sync' ? 'border-purple-600 bg-purple-500/5' : 'border-border hover:border-purple-500/50'}`}>
                            <div className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-300 text-sm">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${importMode === 'sync' ? 'border-purple-600 bg-purple-600' : 'border-muted'}`}>{importMode === 'sync' && <span className="w-2 h-2 rounded-full bg-white"></span>}</span> 
                                Mode Complétion (Smart Sync)
                            </div>
                        </div>
                    </div>
                    <div className="grow overflow-auto min-h-0 border border-border rounded-lg bg-background mb-4">
                        <table className="w-full text-xs text-left text-muted">
                            <thead className="text-foreground bg-secondary sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2">Nom</th>
                                    <th className="px-4 py-2">Set</th>
                                    <th className="px-4 py-2">Num</th>
                                    <th className="px-4 py-2">Qté</th>
                                    <th className="px-4 py-2">Foil</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.slice(0, 100).map((row, i) => (
                                    <tr key={i} className="bg-surface border-b border-border">
                                        <td className="px-4 py-1 truncate max-w-[150px] text-foreground">{row["Name"]}</td>
                                        <td className="px-4 py-1">{row["Set code"]}</td>
                                        <td className="px-4 py-1">{row["Collector number"]}</td>
                                        <td className="px-4 py-1 font-bold">{row["Quantity"]}</td>
                                        <td className="px-4 py-1">{row["Foil"]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex-none pt-2">
                        <button onClick={startImport} className="w-full text-white font-bold py-3 rounded-xl shadow-lg bg-primary hover:opacity-90">
                            {importMode === 'add' ? 'Valider l\'Ajout' : 'Valider la Synchronisation'}
                        </button>
                    </div>
                </div>
            )}

           {step === 'importing' && (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Importation en cours...</h3>
                    <p className="text-muted text-sm max-w-md mb-8">Ne fermez pas cette fenêtre.</p>
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