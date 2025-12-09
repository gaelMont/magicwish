// components/ImportModal.tsx
'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetCollection?: string;
};

type CSVRow = { [key: string]: string | undefined };
type CardInput = { name: string; setCode: string; quantity: number; id: string };

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

  const mapRowToCard = (row: CSVRow): CardInput | null => {
    const normalizedRow: { [key: string]: string } = {};
    Object.keys(row).forEach(key => {
      if (key) normalizedRow[key.toLowerCase().trim()] = (row[key] || '').trim();
    });

    const name = normalizedRow['name'] || normalizedRow['card name'] || normalizedRow['card'] || normalizedRow['nom'];
    if (!name) return null;

    const setCode = normalizedRow['set code'] || normalizedRow['set'] || normalizedRow['edition'] || normalizedRow['extension'] || '';
    const qtyString = normalizedRow['quantity'] || normalizedRow['count'] || normalizedRow['qty'] || normalizedRow['qte'] || '1';
    const quantity = parseInt(qtyString) || 1;
    
    // ID : On nettoie le nom pour l'ID
    const cleanNameID = name.split(' // ')[0];
    const id = `${cleanNameID}-${setCode}`.toLowerCase().replace(/[^a-z0-9]/g, '-');

    return { name, setCode, quantity, id };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setProgress(0);
    setStatusMessage(`Destination : ${targetCollection === 'wishlist' ? 'Wishlist' : 'Collection'}...`);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as CSVRow[];
        const allCards: CardInput[] = [];
        rows.forEach(row => {
          const card = mapRowToCard(row);
          if (card) allCards.push(card);
        });

        if (allCards.length === 0) {
          toast.error("Aucune carte valide trouvée.");
          setIsImporting(false);
          return;
        }

        const chunks = chunkArray(allCards, 75);
        const totalChunks = chunks.length;
        
        let processedCards = 0;
        let successCount = 0;

        for (let i = 0; i < totalChunks; i++) {
          const chunk = chunks[i];
          try {
            const identifiers = chunk.map(c => 
              (c.setCode && c.setCode.length >= 2) ? { name: c.name, set: c.setCode } : { name: c.name }
            );

            const response = await fetch('https://api.scryfall.com/cards/collection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifiers })
            });

            const scryfallResult = await response.json();
            const foundData = scryfallResult.data || [];
            const batch = writeBatch(db);

            chunk.forEach(inputCard => {
              // Recherche souple (A inclut B ou B inclut A)
              const found = foundData.find((f: any) => {
                const scryfallName = f.name.toLowerCase();
                const csvName = inputCard.name.toLowerCase();
                return scryfallName.includes(csvName) || csvName.includes(scryfallName);
              });

              const cardRef = doc(db, 'users', user.uid, targetCollection, inputCard.id);

              if (found) {
                const price = found.prices?.eur ? parseFloat(found.prices.eur) : 0;
                let imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
                
                if (found.image_uris?.normal) {
                    imageUrl = found.image_uris.normal;
                } else if (found.card_faces?.[0]?.image_uris?.normal) {
                    imageUrl = found.card_faces[0].image_uris.normal;
                }

                batch.set(cardRef, {
                  // CORRECTION : On ne garde que le recto pour le nom
                  name: found.name.split(' // ')[0], 
                  quantity: increment(inputCard.quantity),
                  imageUrl: imageUrl,
                  price: price,
                  setName: found.set_name,
                  setCode: found.set,
                  addedAt: new Date()
                }, { merge: true });
              } else {
                batch.set(cardRef, {
                  name: inputCard.name,
                  quantity: increment(inputCard.quantity),
                  imageUrl: "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg",
                  price: 0,
                  setName: inputCard.setCode,
                  imported: true,
                  addedAt: new Date()
                }, { merge: true });
              }
              successCount++;
            });

            await batch.commit();

          } catch (err) {
            console.error(`Erreur lot ${i+1}`, err);
          }

          processedCards += chunk.length;
          const percent = Math.round((processedCards / allCards.length) * 100);
          setProgress(percent);
          setStatusMessage(`Traitement... ${percent}%`);
          await new Promise(r => setTimeout(r, 100));
        }

        toast.success(`Terminé ! ${successCount} cartes ajoutées.`);
        setIsImporting(false);
        onClose();
      },
      error: () => {
        toast.error("Erreur CSV");
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-2">
          Importer vers {targetCollection === 'wishlist' ? 'Wishlist' : 'Collection'} 🚀
        </h2>
        
        {isImporting ? (
          <div className="text-center py-6">
            <div className="text-4xl font-bold text-green-600 mb-2">{progress}%</div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden mb-3">
              <div className="bg-green-600 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 animate-pulse font-mono">{statusMessage}</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer relative group">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">📦</div>
            <span className="font-medium text-gray-700 dark:text-gray-200">Glisser votre CSV</span>
          </div>
        )}
        {!isImporting && (
          <button onClick={onClose} className="mt-6 w-full py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 font-medium transition">Annuler</button>
        )}
      </div>
    </div>
  );
}