// components/ImportModal.tsx
'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, getDoc, increment, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

// Types pour mapper les colonnes variables des fichiers CSV
type CSVRow = {
  [key: string]: string | undefined;
};

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  // --- LOGIQUE INTELLIGENTE DE DÉTECTION ---
  const mapRowToCard = (row: CSVRow) => {
    // 1. Normaliser les clés (minuscules) pour éviter les problèmes de casse
    const normalizedRow: { [key: string]: string } = {};
    Object.keys(row).forEach(key => {
      normalizedRow[key.toLowerCase().trim()] = (row[key] || '').trim();
    });

    // 2. Trouver le NOM (Manabox: "Name", Moxfield: "Count", etc.)
    const name = normalizedRow['name'] || normalizedRow['card name'] || normalizedRow['card'];
    
    // 3. Trouver le CODE SET (Edition, Set, Set Code)
    // Manabox utilise 'Set code', Moxfield 'Edition', Archidekt 'Edition'
    const setCode = normalizedRow['set code'] || normalizedRow['edition'] || normalizedRow['set'] || '';

    // 4. Trouver la QUANTITÉ
    const qtyString = normalizedRow['quantity'] || normalizedRow['count'] || normalizedRow['qty'] || normalizedRow['qte'] || '1';
    const quantity = parseInt(qtyString) || 1;

    // 5. Trouver si FOIL (Optionnel)
    const foilString = normalizedRow['foil'] || normalizedRow['finish'] || '';
    const isFoil = foilString.toLowerCase().includes('foil') || foilString.toLowerCase() === 'true';

    return { name, setCode, quantity, isFoil };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setProgress(0);

    Papa.parse(file, {
      header: true, // Lit la première ligne comme entêtes
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as CSVRow[];
        const total = rows.length;
        let processed = 0;
        
        // On utilise un "Batch" Firestore pour écrire par paquets (plus rapide et sûr)
        // Note: Firestore limite les batchs à 500 opérations. Pour simplifier ici, on fait un par un 
        // ou on pourrait grouper, mais vu la logique "merge", le un par un avec feedback est bien.
        
        // Pour éviter de bloquer l'UI, on traite ça proprement
        let successCount = 0;

        for (const row of rows) {
          const cardData = mapRowToCard(row);

          if (cardData.name) {
            // Création d'un ID unique basé sur Nom + Set (pour éviter les doublons)
            // On nettoie le nom pour l'ID (pas d'espaces bizarres)
            const cleanId = `${cardData.name}-${cardData.setCode}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            
            const cardRef = doc(db, 'users', user.uid, 'wishlist', cleanId);

            try {
              // On essaie de récupérer l'image via Scryfall plus tard ou on met un placeholder
              // Pour l'import massif, on met l'image par défaut pour ne pas spammer l'API Scryfall 500 fois en 1 seconde
              
              const docSnap = await getDoc(cardRef);

              if (docSnap.exists()) {
                await updateDoc(cardRef, {
                  quantity: increment(cardData.quantity)
                });
              } else {
                await setDoc(cardRef, {
                  name: cardData.name,
                  quantity: cardData.quantity,
                  setName: cardData.setCode, // On stocke le code en attendant d'avoir le nom complet
                  imageUrl: "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg", // Dos de carte par défaut
                  imported: true, // Marqueur pour savoir qu'il faudra peut-être mettre à jour l'image plus tard
                  addedAt: new Date()
                });
              }
              successCount++;
            } catch (err) {
              console.error("Erreur import ligne:", row);
            }
          }
          
          processed++;
          setProgress(Math.round((processed / total) * 100));
        }

        toast.success(`${successCount} cartes importées avec succès !`);
        setIsImporting(false);
        onClose();
      },
      error: (error) => {
        toast.error("Erreur de lecture du fichier CSV");
        console.error(error);
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Importer une collection</h2>
        
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Accepte les fichiers CSV de <strong>Manabox, Archidekt, Moxfield</strong>.
          <br/>
          <span className="text-xs opacity-70">Les colonnes détectées : Name, Quantity, Set Code/Edition.</span>
        </p>

        {isImporting ? (
          <div className="text-center py-4">
            <div className="text-2xl font-bold text-blue-600 mb-2">{progress}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-sm mt-2">Traitement des cartes...</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer relative">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <span className="text-4xl mb-2 block">📂</span>
            <span className="font-medium">Cliquez ou glissez un fichier CSV ici</span>
          </div>
        )}

        <button 
          onClick={onClose}
          disabled={isImporting}
          className="mt-6 w-full py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}