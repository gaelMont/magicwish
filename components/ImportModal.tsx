// components/ImportModal.tsx
'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type CSVRow = {
  [key: string]: string | undefined;
};

type CardInput = {
  name: string;
  setCode: string;
  quantity: number;
  id: string; // Notre ID unique pour Firestore
};

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  // Fonction utilitaire pour découper un tableau en morceaux (chunks)
  function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked_arr = [];
    for (let i = 0; i < array.length; i += size) {
      chunked_arr.push(array.slice(i, i + size));
    }
    return chunked_arr;
  }

  const mapRowToCard = (row: CSVRow): CardInput | null => {
    // Normalisation
    const normalizedRow: { [key: string]: string } = {};
    Object.keys(row).forEach(key => {
      if (key) normalizedRow[key.toLowerCase().trim()] = (row[key] || '').trim();
    });

    const name = normalizedRow['name'] || normalizedRow['card name'] || normalizedRow['card'] || normalizedRow['nom'];
    // Si pas de nom, on ignore la ligne
    if (!name) return null;

    const setCode = normalizedRow['set code'] || normalizedRow['set'] || normalizedRow['edition'] || normalizedRow['extension'] || '';
    
    const qtyString = normalizedRow['quantity'] || normalizedRow['count'] || normalizedRow['qty'] || normalizedRow['qte'] || '1';
    const quantity = parseInt(qtyString) || 1;

    // ID unique : nom-set
    const id = `${name}-${setCode}`.toLowerCase().replace(/[^a-z0-9]/g, '-');

    return { name, setCode, quantity, id };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setProgress(0);
    setStatusMessage("Analyse du fichier...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as CSVRow[];
        
        // 1. Préparer toutes les données valides
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

        setStatusMessage(`Traitement de ${allCards.length} cartes en lots...`);
        
        // 2. Découper en paquets de 75 (Limite de l'API Scryfall "Collection")
        const chunks = chunkArray(allCards, 75);
        let processedCount = 0;
        let successCount = 0;

        // 3. Traiter chaque paquet
        for (const chunk of chunks) {
          try {
            // A. Préparer la requête pour Scryfall (Identifiers)
            const identifiers = chunk.map(card => {
              // Si on a un set code, on l'utilise, sinon juste le nom
              return card.setCode && card.setCode.length >= 2 
                ? { name: card.name, set: card.setCode }
                : { name: card.name };
            });

            // B. Appel API Scryfall (Un seul appel pour 75 cartes !)
            const response = await fetch('https://api.scryfall.com/cards/collection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifiers })
            });

            const scryfallResult = await response.json();
            const foundCards = scryfallResult.data || [];

            // C. Préparer le Batch Firestore (Écriture groupée)
            const batch = writeBatch(db);
            
            // Pour retrouver la quantité, on fait un petit dictionnaire local du chunk
            // Clé: "nom+set" (approximatif pour matcher le retour Scryfall) -> Valeur: Quantité
            // Note: Scryfall peut corriger le nom, donc on doit être malin.
            // On va itérer sur NOTRE liste (chunk) et chercher si Scryfall a renvoyé un résultat correspondant.
            
            for (const inputCard of chunk) {
              // On cherche la carte correspondante dans la réponse Scryfall
              // L'index dans 'data' ne correspond pas forcément à l'ordre d'envoi si des cartes sont introuvables
              // Heureusement Scryfall renvoie tout, mais pour simplifier, on va chercher par nom
              const found = foundCards.find((fc: any) => 
                fc.name.toLowerCase() === inputCard.name.toLowerCase() || // Nom exact
                fc.name.toLowerCase().includes(inputCard.name.toLowerCase()) // Nom partiel
              );

              const cardRef = doc(db, 'users', user.uid, 'wishlist', inputCard.id);

              if (found) {
                // INFO TROUVÉE SUR SCRYFALL
                const price = found.prices?.eur ? parseFloat(found.prices.eur) : 0;
                let imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
                if (found.image_uris?.normal) imageUrl = found.image_uris.normal;
                else if (found.card_faces?.[0]?.image_uris?.normal) imageUrl = found.card_faces[0].image_uris.normal;

                // Astuce Batch : On ne peut pas lire ET écrire conditionnellement facilement dans un batch pur sans transactions complexes.
                // Pour simplifier et aller VITE : On utilise setDoc avec { merge: true }
                // Mais pour increment, c'est délicat.
                // Pour ce mode "Turbo", on va écraser les données Scryfall mais garder l'ID.
                // Si la carte existe déjà, on aimerait incrementer. Le batch supporte increment !
                
                batch.set(cardRef, {
                    name: found.name, // Nom officiel Scryfall
                    imageUrl: imageUrl,
                    price: price,
                    setName: found.set_name,
                    setCode: found.set,
                    quantity: increment(inputCard.quantity), // Magie : ça marche même si le doc n'existe pas (crée à la valeur)
                    addedAt: new Date(), // Ça mettra à jour la date
                }, { merge: true });

              } else {
                // CARTE NON TROUVÉE SUR SCRYFALL (On l'ajoute quand même en brouillon)
                batch.set(cardRef, {
                  name: inputCard.name,
                  quantity: increment(inputCard.quantity),
                  imageUrl: "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg",
                  price: 0,
                  setName: inputCard.setCode,
                  imported: true, // Marqueur brouillon
                  addedAt: new Date()
                }, { merge: true });
              }
              successCount++;
            }

            // D. Envoyer le paquet à Firestore
            await batch.commit();

          } catch (err) {
            console.error("Erreur sur un lot", err);
          }

          processedCount += chunk.length;
          setProgress(Math.round((processedCount / allCards.length) * 100));
          
          // Petite pause de sécurité (même avec l'endpoint collection, faut pas abuser)
          await new Promise(r => setTimeout(r, 100));
        }

        toast.success(`Terminé ! ${successCount} cartes traitées.`);
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
        <h2 className="text-xl font-bold mb-2">Importer (Mode Turbo 🚀)</h2>
        <p className="text-sm text-gray-500 mb-6">
          Importation par lots. Détection automatique des images et prix.
        </p>

        {isImporting ? (
          <div className="text-center py-6">
            <div className="text-4xl font-bold text-purple-600 mb-2 transition-all">{progress}%</div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden mb-3">
              <div 
                className="bg-purple-600 h-full rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 animate-pulse">
              {statusMessage}
            </p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer relative group">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">⚡</div>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              Choisir un CSV (Gros volume accepté)
            </span>
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