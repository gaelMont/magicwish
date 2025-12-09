// components/ImportModal.tsx
'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, getDoc, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type CSVRow = {
  [key: string]: string | undefined;
};

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  // Petit utilitaire pour faire une pause (pour ne pas fâcher Scryfall)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Fonction pour récupérer les infos Scryfall
  const fetchScryfallData = async (name: string, setCode?: string) => {
    try {
      // Encodage de l'URL pour gérer les caractères spéciaux comme "+2 Mace"
      let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
      
      // Si on a un code de set valide (plus de 2 lettres), on l'utilise
      if (setCode && setCode.length >= 2) {
        url += `&set=${encodeURIComponent(setCode)}`;
      }

      const res = await fetch(url);
      if (!res.ok) return null; // Si pas trouvé, on renvoie null

      const data = await res.json();
      
      // Extraction Image
      let imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
      if (data.image_uris?.normal) {
        imageUrl = data.image_uris.normal;
      } else if (data.card_faces?.[0]?.image_uris?.normal) {
        imageUrl = data.card_faces[0].image_uris.normal;
      }

      // Extraction Prix
      const price = data.prices?.eur ? parseFloat(data.prices.eur) : 0;

      return {
        imageUrl,
        price,
        setName: data.set_name, // Nom complet du set (ex: "Commander 2019")
        setCode: data.set       // Code propre (ex: "c19")
      };
    } catch (e) {
      console.error("Erreur Scryfall pour", name, e);
      return null;
    }
  };

  const mapRowToCard = (row: CSVRow) => {
    // Normalisation des clés
    const normalizedRow: { [key: string]: string } = {};
    Object.keys(row).forEach(key => {
      if (key) normalizedRow[key.toLowerCase().trim()] = (row[key] || '').trim();
    });

    const name = 
      normalizedRow['name'] || normalizedRow['card name'] || normalizedRow['card'] || normalizedRow['nom'];
    
    const setCode = 
      normalizedRow['set code'] || normalizedRow['set'] || normalizedRow['edition'] || normalizedRow['extension'] || '';

    const qtyString = 
      normalizedRow['quantity'] || normalizedRow['count'] || normalizedRow['qty'] || normalizedRow['qte'] || '1';
      
    const quantity = parseInt(qtyString) || 1;

    return { name, setCode, quantity };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setProgress(0);
    setStatusMessage("Lecture du fichier...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as CSVRow[];
        const total = rows.length;
        let processed = 0;
        let successCount = 0;

        if (total === 0) {
          toast.error("Fichier vide");
          setIsImporting(false);
          return;
        }

        setStatusMessage(`Traitement de ${total} cartes...`);

        for (const row of rows) {
          const cardCSV = mapRowToCard(row);

          if (cardCSV.name) {
            // 1. Récupération des données Scryfall (Image + Prix)
            const scryfallData = await fetchScryfallData(cardCSV.name, cardCSV.setCode);

            // 2. Préparation des données pour Firestore
            // Si Scryfall a échoué, on garde des valeurs par défaut
            const finalData = {
              name: cardCSV.name,
              quantity: cardCSV.quantity,
              imageUrl: scryfallData?.imageUrl || "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg",
              price: scryfallData?.price || 0,
              setName: scryfallData?.setName || cardCSV.setCode, // Nom complet si trouvé, sinon code CSV
              addedAt: new Date(),
              // On nettoie le nom pour l'ID (ex: "sol-ring-c19")
              id: `${cardCSV.name}-${cardCSV.setCode}`.toLowerCase().replace(/[^a-z0-9]/g, '-')
            };
            
            // 3. Écriture dans Firestore
            const cardRef = doc(db, 'users', user.uid, 'wishlist', finalData.id);

            try {
              const docSnap = await getDoc(cardRef);
              if (docSnap.exists()) {
                await updateDoc(cardRef, {
                  quantity: increment(cardCSV.quantity),
                  // On en profite pour mettre à jour le prix si on l'a trouvé
                  ...(scryfallData?.price ? { price: scryfallData.price } : {})
                });
              } else {
                await setDoc(cardRef, finalData);
              }
              successCount++;
            } catch (err) {
              console.error("Erreur Firestore:", err);
            }

            // 4. Pause de 75ms pour respecter l'API Scryfall (Rate Limit)
            await delay(75);
          }
          
          processed++;
          setProgress(Math.round((processed / total) * 100));
        }

        toast.success(`${successCount} cartes importées avec succès !`);
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
        <h2 className="text-xl font-bold mb-2">Importer une collection</h2>
        <p className="text-sm text-gray-500 mb-6">
          Le fichier sera analysé et les prix/images seront récupérés automatiquement via Scryfall.
        </p>

        {isImporting ? (
          <div className="text-center py-6">
            <div className="text-4xl font-bold text-blue-600 mb-2 transition-all">{progress}%</div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden mb-3">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 animate-pulse">
              {statusMessage}
            </p>
            <p className="text-xs text-gray-400 mt-1">Ne fermez pas cette fenêtre.</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer relative group">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">📂</div>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              Cliquez pour choisir un CSV
            </span>
            <div className="mt-2 text-xs text-gray-500">
              Format: Name, Quantity, Set Code
            </div>
          </div>
        )}

        {!isImporting && (
          <button 
            onClick={onClose}
            className="mt-6 w-full py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 font-medium transition"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}