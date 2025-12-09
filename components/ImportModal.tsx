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
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  function chunkArray<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  const applyFallback = (batch: WriteBatch, uid: string, collection: string, card: CardInput) => {
    const cardRef = doc(db, 'users', uid, collection, card.tempId);
    batch.set(cardRef, {
      name: card.name,
      quantity: increment(card.quantity),
      imageUrl: "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg",
      price: 0,
      setName: card.setCode || 'Inconnu',
      imported: true,
      notFound: true,
      addedAt: new Date()
    }, { merge: true });
  };

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

  // --- NOUVELLE LOGIQUE : Lecture par position (Index) ---
  const mapRowToCard = (row: string[]): CardInput | null => {
    // Structure ManaBox attendue :
    // 0: Binder Name | 1: Binder Type | 2: Name | 3: Set Code ... | 8: Quantity ... | 10: Scryfall ID
    
    // Sécurité : Vérifier qu'on a assez de colonnes
    if (!row || row.length < 3) return null;

    const name = row[2]?.trim();
    if (!name) return null;

    const setCode = row[3]?.trim() || '';
    
    // Nettoyage de la quantité (parfois "1", parfois vide)
    let qty = 1;
    if (row[8]) {
      const parsed = parseInt(row[8].trim());
      if (!isNaN(parsed) && parsed > 0) qty = parsed;
    }

    // ID Scryfall (colonne 10)
    let scryfallId = undefined;
    if (row.length > 10 && row[10] && row[10].length > 10) {
      scryfallId = row[10].trim();
    }

    const cleanName = name.split(' // ')[0].toLowerCase();
    const cleanSet = setCode.toLowerCase();
    const tempId = `${cleanName}-${cleanSet}`.replace(/[^a-z0-9]/g, '-');
    const signature = `${cleanName}|${cleanSet}`;

    return { 
      name: name, 
      setCode: setCode, 
      quantity: qty, 
      tempId, 
      signature, 
      scryfallIdFromCsv: scryfallId 
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setProgress(0);
    setStatusMessage(`Analyse du fichier...`);

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const csvText = event.target?.result as string;
      if (!csvText) {
        toast.error("Fichier vide");
        setIsImporting(false);
        return;
      }

      // --- 1. DÉTECTION DU SÉPARATEUR ---
      const firstLine = csvText.split('\n')[0];
      const semiCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const detectedDelimiter = semiCount > commaCount ? ';' : ',';
      
      console.log(`Séparateur utilisé : "${detectedDelimiter}"`);

      Papa.parse(csvText, {
        header: false, // <--- CHANGEMENT MAJEUR : On désactive la lecture des en-têtes
        skipEmptyLines: true,
        delimiter: detectedDelimiter,
        complete: async (results) => {
          // On récupère un tableau de tableaux de chaînes (string[][])
          const rows = results.data as string[][];

          if (rows.length < 2) {
            toast.error("Fichier CSV vide ou mal formé.");
            setIsImporting(false);
            return;
          }

          // On ignore la première ligne (les titres : "Binder Name, ...")
          const dataRows = rows.slice(1);
          
          let allCards: CardInput[] = [];
          dataRows.forEach(row => {
            const card = mapRowToCard(row);
            if (card) allCards.push(card);
          });

          // --- LOGS DE DEBUG ---
          if (allCards.length === 0) {
            console.error("Aucune carte trouvée. Voici la première ligne brute :", dataRows[0]);
            toast.error("Aucune carte détectée. Vérifiez le format (ManaBox).");
            setIsImporting(false);
            return;
          }
          
          console.log(`✅ ${allCards.length} cartes détectées. Exemple :`, allCards[0]);

          // --- IMPORTATION ---
          allCards = optimizeCardList(allCards);
          const optimizedCount = allCards.length;
          const chunks = chunkArray(allCards, 75);
          let processedCards = 0;
          let successCount = 0;

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            try {
              const identifiers = chunk.map(c => {
                  if (c.scryfallIdFromCsv) return { id: c.scryfallIdFromCsv };
                  return (c.setCode && c.setCode.length >= 2) 
                      ? { name: c.name, set: c.setCode } 
                      : { name: c.name };
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
                  if (!resultsMap.has(fNameClean)) resultsMap.set(fNameClean, f);
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
                  const isIdMatch = inputCard.scryfallIdFromCsv === found.id;
                  const setMatches = inputSet ? (found.set === inputSet) : true;
                  const nameMatches = found.name.toLowerCase().includes(inputName);

                  if (isIdMatch || setMatches || nameMatches) {
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
                      applyFallback(batch, user.uid, targetCollection, inputCard);
                  }
                } else {
                  applyFallback(batch, user.uid, targetCollection, inputCard);
                }
              });

              await batch.commit();

            } catch (err) {
              console.error(err);
              toast.error(`Erreur import lot ${i+1}`);
            }

            processedCards += chunk.length;
            setProgress(Math.round((processedCards / optimizedCount) * 100));
            setStatusMessage(`Traitement...`);
            await new Promise(r => setTimeout(r, 100));
          }

          toast.success(`Import terminé ! (${successCount} cartes identifiées)`);
          setIsImporting(false);
          onClose();
        },
        // --- CORRECTION TYPESCRIPT ICI (unknown au lieu de any) ---
        error: (err: unknown) => {
          console.error(err);
          toast.error("Erreur lecture CSV");
          setIsImporting(false);
        }
      });
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Importer {targetCollection === 'wishlist' ? 'Wishlist' : 'Collection'}
        </h2>
        
        {isImporting ? (
          <div className="text-center py-6">
            <div className="text-4xl font-bold text-green-600 mb-2">{progress}%</div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden mb-3">
              <div className="bg-green-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-sm text-gray-500 font-mono">{statusMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer relative group">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">📦</div>
              <span className="font-medium text-gray-700 dark:text-gray-200">Choisir un fichier CSV</span>
              <p className="text-xs text-gray-400 mt-2">Format: ManaBox (recommandé), Name, Set...</p>
            </div>
          </div>
        )}
        
        {!isImporting && (
          <button onClick={onClose} className="mt-6 w-full py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 font-medium transition">
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}