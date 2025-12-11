// components/ImportModal.tsx
'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetCollection?: string; // On garde prop pour ne pas casser l'appel parent, même si inutilisé pour l'instant
};

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  // On utilise 'any' ici temporairement pour accepter n'importe quel CSV sans se soucier du typage strict
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true, // Transforme les lignes en objets (clé: valeur)
      skipEmptyLines: true,
      encoding: "UTF-8", // Crucial pour les accents et symboles Magic
      complete: (results) => {
        console.log("Données importées :", results.data);
        
        // On force le typage ici car PapaParse renvoie un type générique
        setColumns(results.meta.fields || []);
        setData(results.data as any[]);
      },
      error: (error) => {
        console.error("Erreur lors du parsing :", error);
      }
    });
  };

  const handleReset = () => {
    setData([]);
    setColumns([]);
  };

  return (
    // Fond sombre (Overlay)
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      
      {/* La boîte Modale */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* En-tête */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Vérification du CSV
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">✕</button>
        </div>

        {/* Contenu Principal */}
        <div className="flex-grow overflow-hidden flex flex-col">
          
          {/* Zone d'Input (Affichée seulement si pas de données) */}
          {data.length === 0 && (
            <div className="p-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="text-5xl mb-4">📂</div>
              <p className="font-bold text-gray-700 dark:text-gray-200">Cliquez pour sélectionner votre CSV Manabox</p>
            </div>
          )}

          {/* Affichage du Tableau (Affiché seulement si données présentes) */}
          {data.length > 0 && (
            <div className="flex flex-col h-full overflow-hidden">
              
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-green-600 font-bold">✅ {data.length} lignes chargées</p>
                <button 
                  onClick={handleReset}
                  className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200"
                >
                  Changer de fichier
                </button>
              </div>

              {/* Zone scrollable du tableau */}
              <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg flex-grow bg-gray-50 dark:bg-gray-900">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 border-collapse">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-800 dark:text-gray-200 sticky top-0">
                    <tr>
                      {columns.map((col, index) => (
                        <th key={index} className="px-4 py-3 border border-gray-300 dark:border-gray-600 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 100).map((row, rowIndex) => (
                      <tr key={rowIndex} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700">
                        {columns.map((col, colIndex) => (
                          <td key={colIndex} className="px-4 py-2 border border-gray-200 dark:border-gray-700 whitespace-nowrap max-w-[200px] truncate">
                            {row[col] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <p className="text-xs text-center text-gray-400 mt-2">
                Affichage des 100 premières lignes uniquement pour prévisualisation.
              </p>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="mt-4 flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}