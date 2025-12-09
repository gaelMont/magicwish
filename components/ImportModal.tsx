// components/ImportModal.tsx
'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment, WriteBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetCollection?: string;
};

// Types pour les données
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CSVRow = any; // On accepte tout format venant du CSV pour la prévisualisation

type CardInput = { 
  name: string; 
  setCode: string; 
  quantity: number; 
  scryfallIdFromCsv?: string;
  tempId: string;
  signature: string;
};

interface ScryfallData {
  id: string;
  name: string;
  set: string;
  set_name: string;
  prices?: { eur?: string };
  image_uris?: { normal?: string };
  card_faces?: Array<{ image_uris?: { normal?: string } }>;
}

export default function ImportModal({ isOpen, onClose, targetCollection = 'wishlist' }: ImportModalProps) {
  const { user } = useAuth();
  
  // États pour la prévisualisation
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');

  // États pour la progression
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  // --- 1. GESTION DU FICHIER (PAPA PARSE) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Réinitialisation
    setPreviewData([]);
    setColumns([]);
    
    Papa.parse(file, {
      header: true, // On remet TRUE comme demandé pour avoir les objets (Clés/Valeurs)
      skipEmptyLines: true,
      dynamicTyping: true, // Convertit les nombres automatiquement
      complete: (results) => {
        const rows = results.data;
        const metaFields = results.meta.fields || [];

        if (rows.length > 0) {
          console.log("Aperçu des données :", rows.slice(0, 5));
          setColumns(metaFields);
          setPreviewData(rows);
          setStep('preview'); // On passe à l'étape tableau
          toast.success(`${rows.length} lignes chargées.`);
        } else {
            toast.error("Le fichier semble vide.");
        }
      },
      error: (err: unknown) => {
        console.error("Erreur parsing :", err);
        toast.error("Impossible de lire le fichier CSV.");
      }
    });
  };

  // --- 2. TRAITEMENT DES DONNÉES (LOGIQUE ROBUSTE) ---
  const startImport = async () => {
    if (!user || previewData.length === 0) return;

    setStep('importing');
    setProgress(0);
    setStatusMessage("Préparation des cartes...");

    // Fonction pour nettoyer les clés (enlever BOM, espaces, minuscules)
    const normalizeKey = (row: CSVRow, possibleKeys: string[]): string | undefined => {
        const keys = Object.keys(row);
        for (const k of keys) {
            const cleanK = k.trim().toLowerCase().replace(/^\ufeff/, '');
            if (possibleKeys.includes(cleanK)) return row[k];
        }
        return undefined;
    };

    let allCards: CardInput[] = [];

    // Conversion des données brutes en objets CardInput propres
    previewData.forEach((row) => {
        // Recherche intelligente des colonnes (peu importe la majuscule/minuscule)
        const name = normalizeKey(row, ['name', 'nom', 'card name', 'card']);
        if (!name) return; // Pas de nom = on saute

        const setCode = normalizeKey(row, ['set code', 'set', 'edition', 'code']) || '';
        
        let quantity = 1;
        const qtyVal = normalizeKey(row, ['quantity', 'qty', 'qte', 'count']);
        if (qtyVal) {
            const parsed = parseInt(String(qtyVal));
            if (!isNaN(parsed) && parsed > 0) quantity = parsed;
        }

        const scryfallId = normalizeKey(row, ['scryfall id', 'scryfallid']);

        const cleanName = String(name).split(' // ')[0].toLowerCase();
        const cleanSet = String(setCode).toLowerCase();
        const tempId = `${cleanName}-${cleanSet}`.replace(/[^a-z0-9]/g, '-');
        const signature = `${cleanName}|${cleanSet}`;

        allCards.push({
            name: String(name),
            setCode: String(setCode),
            quantity,
            scryfallIdFromCsv: scryfallId ? String(scryfallId) : undefined,
            tempId,
            signature
        });
    });

    if (allCards.length === 0) {
        toast.error("Aucune carte valide trouvée dans le tableau.");
        setStep('preview');
        return;
    }

    // --- LOGIQUE EXISTANTE (SCRYFALL + FIREBASE) ---
    const optimizeCardList = (rawCards: CardInput[]): CardInput[] => {
        const map = new Map<string, CardInput>();
        rawCards.forEach(card => {
          const key = card.scryfallIdFromCsv || card.signature;
          if (map.has(key)) {
            const existing = map.get(key)!;
            existing.quantity += card.quantity;
          } else {
            map.set(key, { ...card });
          }
        });
        return Array.from(map.values());
    };

    function chunkArray<T>(array: T[], size: number): T[][] {
        const result = [];
        for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
        return result;
    }

    allCards = optimizeCardList(allCards);
    const totalCards = allCards.length;
    const chunks = chunkArray(allCards, 75);
    let successCount = 0;
    let processedCards = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            const identifiers = chunk.map(c => {
                if (c.scryfallIdFromCsv) return { id: c.scryfallIdFromCsv };
                return (c.setCode && c.setCode.length >= 2) ? { name: c.name, set: c.setCode } : { name: c.name };
            });

            const response = await fetch('https://api.scryfall.com/cards/collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifiers })
            });

            const scryfallResult = await response.json();
            const foundData = (scryfallResult.data || []) as ScryfallData[];
            const resultsMap = new Map<string, ScryfallData>();
            
            foundData.forEach((f) => {
                const fName = f.name.toLowerCase();
                const fSet = f.set.toLowerCase();
                const fNameClean = fName.split(' // ')[0];
                resultsMap.set(f.id, f);
                resultsMap.set(`${fName}|${fSet}`, f);
                resultsMap.set(`${fNameClean}|${fSet}`, f);
                if (!resultsMap.has(fName)) resultsMap.set(fName, f);
            });

            const batch = writeBatch(db);

            chunk.forEach(inputCard => {
                const inputName = inputCard.name.toLowerCase();
                const inputSet = inputCard.setCode.toLowerCase();
                let found = null;
                
                if (inputCard.scryfallIdFromCsv) found = resultsMap.get(inputCard.scryfallIdFromCsv);
                if (!found && inputSet) found = resultsMap.get(`${inputName}|${inputSet}`);
                if (!found) found = resultsMap.get(inputName);

                if (found) {
                    const cardRef = doc(db, 'users', user.uid, targetCollection, found.id);
                    const price = found.prices?.eur ? parseFloat(found.prices.eur) : 0;
                    
                    let imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
                    if (found.image_uris?.normal) imageUrl = found.image_uris.normal;
                    else if (found.card_faces?.[0]?.image_uris?.normal) imageUrl = found.card_faces[0].image_uris.normal;

                    batch.set(cardRef, {
                        name: found.name.split(' // ')[0],
                        quantity: increment(inputCard.quantity),
                        imageUrl: imageUrl,
                        price: price,
                        setName: found.set_name,
                        setCode: found.set, 
                        scryfallId: found.id,
                        lastUpdated: new Date()
                    }, { merge: true });
                    successCount++;
                } else {
                    // Fallback (Carte non trouvée sur Scryfall)
                    const cardRef = doc(db, 'users', user.uid, targetCollection, inputCard.tempId);
                    batch.set(cardRef, {
                        name: inputCard.name,
                        quantity: increment(inputCard.quantity),
                        imageUrl: "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg",
                        price: 0,
                        setName: inputCard.setCode || 'Inconnu',
                        imported: true,
                        notFound: true,
                        addedAt: new Date()
                    }, { merge: true });
                }
            });

            await batch.commit();

        } catch (err) {
            console.error(err);
        }

        processedCards += chunk.length;
        setProgress(Math.round((processedCards / totalCards) * 100));
        setStatusMessage(`Traitement... (${processedCards}/${totalCards})`);
        await new Promise(r => setTimeout(r, 50));
    }

    toast.success(`Import réussi ! ${successCount} cartes ajoutées.`);
    onClose();
    setStep('upload'); // Reset pour la prochaine fois
  };

  const handleReset = () => {
    setPreviewData([]);
    setColumns([]);
    setStep('upload');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* EN-TÊTE MODALE */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Importer {targetCollection === 'wishlist' ? 'Wishlist' : 'Collection'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">✕</button>
        </div>
        
        {/* ÉTAPE 3 : IMPORTATION (BARRE DE CHARGEMENT) */}
        {step === 'importing' && (
          <div className="text-center py-10 flex-grow flex flex-col justify-center">
            <div className="text-5xl font-bold text-green-600 mb-4">{progress}%</div>
            <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 overflow-hidden mb-4 max-w-lg mx-auto">
              <div className="bg-green-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 animate-pulse">{statusMessage}</p>
          </div>
        )}

        {/* ÉTAPE 1 : SELECTION DU FICHIER */}
        {step === 'upload' && (
            <div className="flex-grow flex flex-col justify-center p-8">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-16 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer relative group">
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="text-7xl mb-6 group-hover:scale-110 transition-transform">📂</div>
                    <span className="font-bold text-xl text-gray-700 dark:text-gray-200">Choisir un fichier CSV</span>
                    <p className="text-gray-400 mt-2">Compatible ManaBox, DragonShield, etc.</p>
                </div>
            </div>
        )}

        {/* ÉTAPE 2 : PRÉVISUALISATION (TABLEAU) */}
        {step === 'preview' && (
            <div className="flex flex-col flex-grow overflow-hidden">
                <div className="flex justify-between items-center mb-2 px-1">
                    <div className="flex gap-4 text-sm">
                         <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">✅ {previewData.length} lignes détectées</span>
                         <span className="text-gray-500 py-1">Vérifiez que les colonnes Name et Set sont visibles.</span>
                    </div>
                    <button 
                        onClick={handleReset}
                        className="text-sm text-red-500 hover:bg-red-50 px-3 py-1 rounded transition"
                    >
                        🗑️ Changer de fichier
                    </button>
                </div>

                <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg flex-grow bg-gray-50 dark:bg-gray-900">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-800 dark:text-gray-200 sticky top-0 z-10">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-4 py-3 whitespace-nowrap border-r border-gray-300 dark:border-gray-600 last:border-0 font-bold">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.slice(0, 50).map((row, rowIndex) => (
                                <tr key={rowIndex} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                                    {columns.map((col, colIndex) => (
                                        <td key={colIndex} className="px-4 py-2 truncate max-w-[200px] border-r border-gray-100 dark:border-gray-700 last:border-0">
                                            {/* Affichage sécurisé des valeurs */}
                                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Message si tableau tronqué */}
                    {previewData.length > 50 && (
                        <div className="p-3 text-center text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                            (Affichage des 50 premières lignes sur {previewData.length})
                        </div>
                    )}
                </div>

                {/* BOUTONS D'ACTION */}
                <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition font-medium"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={startImport}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5 flex items-center gap-2"
                    >
                        <span>🚀</span>
                        <span>Importer {previewData.length} cartes</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}