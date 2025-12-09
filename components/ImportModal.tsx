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
  
  // États pour la prévisualisation (Le Tableau)
  const [previewData, setPreviewData] = useState<string[][]>([]); // Les données
  const [columns, setColumns] = useState<string[]>([]); // Les titres des colonnes
  const [fileParsed, setFileParsed] = useState(false); // Est-ce qu'on a fini de lire le fichier ?

  // États pour l'importation réelle
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  // --- 1. LECTURE DU FICHIER ET CRÉATION DU TABLEAU ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Réinitialisation
    setPreviewData([]);
    setColumns([]);
    setFileParsed(false);

    Papa.parse(file, {
      header: false, // On garde false pour éviter les bugs de clés, on gère l'en-tête nous-mêmes
      skipEmptyLines: true,
      delimiter: ",", // On force la virgule (format ManaBox)
      complete: (results) => {
        const rows = results.data as string[][];

        if (rows.length > 0) {
          console.log("Données brutes importées :", rows);
          setColumns(rows[0]); // La première ligne devient les en-têtes
          setPreviewData(rows.slice(1)); // Le reste devient les données
          setFileParsed(true); // Fichier prêt !
          toast.success(`${rows.length - 1} lignes chargées.`);
        }
      },
      error: (error: unknown) => {
        console.error("Erreur parsing :", error);
        toast.error("Erreur lors de la lecture du fichier.");
      }
    });
  };

  // --- 2. ANALYSE ET IMPORTATION (Logique existante) ---
  const startImport = async () => {
    if (!user || previewData.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    setStatusMessage("Analyse des données...");

    // Conversion des données du tableau en objets CardInput
    let allCards: CardInput[] = [];
    
    previewData.forEach((row) => {
      // LOGIQUE DE MAPPING (Index 2 = Nom, Index 10 = ID)
      if (row.length < 3) return;

      const getString = (idx: number) => (row[idx] ? String(row[idx]).trim() : '');
      
      const name = getString(2); // Nom
      if (!name) return;

      const setCode = getString(3); // Set
      
      let qty = 1;
      const qtyStr = getString(8); // Quantité
      if (qtyStr) {
        const parsed = parseInt(qtyStr);
        if (!isNaN(parsed) && parsed > 0) qty = parsed;
      }

      let scryfallId = undefined;
      const idStr = getString(10); // ID Scryfall
      if (idStr && idStr.length > 10) scryfallId = idStr;

      const cleanName = name.split(' // ')[0].toLowerCase();
      const cleanSet = setCode.toLowerCase();
      const tempId = `${cleanName}-${cleanSet}`.replace(/[^a-z0-9]/g, '-');
      const signature = `${cleanName}|${cleanSet}`;

      allCards.push({ 
        name, setCode, quantity: qty, tempId, signature, scryfallIdFromCsv: scryfallId 
      });
    });

    // --- DÉBUT COMMUNICATION FIREBASE/SCRYFALL (Code existant) ---
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
                    // Fallback
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
        setStatusMessage(`Traitement...`);
        await new Promise(r => setTimeout(r, 50));
    }

    toast.success(`Succès ! ${successCount} cartes ajoutées.`);
    setIsImporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Importer {targetCollection === 'wishlist' ? 'Wishlist' : 'Collection'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">✕</button>
        </div>
        
        {/* ÉCRAN DE CHARGEMENT */}
        {isImporting ? (
          <div className="text-center py-10">
            <div className="text-5xl font-bold text-green-600 mb-4">{progress}%</div>
            <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 overflow-hidden mb-4">
              <div className="bg-green-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300 animate-pulse">{statusMessage}</p>
          </div>
        ) : (
          <>
            {/* SÉLECTION FICHIER */}
            {!fileParsed && (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer relative group">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📄</div>
                <span className="font-bold text-lg text-gray-700 dark:text-gray-200">Cliquez pour choisir votre CSV ManaBox</span>
                </div>
            )}

            {/* PRÉVISUALISATION DU TABLEAU */}
            {fileParsed && previewData.length > 0 && (
                <div className="flex flex-col flex-grow overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-green-600 font-medium">✅ {previewData.length} cartes détectées</p>
                        <button 
                            onClick={() => { setFileParsed(false); setPreviewData([]); }}
                            className="text-sm text-red-500 hover:underline"
                        >
                            Changer de fichier
                        </button>
                    </div>

                    <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-[400px]">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-200 sticky top-0">
                                <tr>
                                    {columns.map((col, idx) => (
                                        <th key={idx} className="px-4 py-3 whitespace-nowrap">{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* On affiche max 50 lignes pour la performance de l'aperçu */}
                                {previewData.slice(0, 50).map((row, rowIndex) => (
                                    <tr key={rowIndex} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className="px-4 py-2 truncate max-w-[150px] border-r border-gray-100 dark:border-gray-700 last:border-0">
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {previewData.length > 50 && (
                            <div className="p-2 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-800">
                                ... et {previewData.length - 50} autres lignes.
                            </div>
                        )}
                    </div>

                    {/* BOUTON D'ACTION FINAL */}
                    <div className="mt-6 flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={startImport}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
                        >
                        </button>
                    </div>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}