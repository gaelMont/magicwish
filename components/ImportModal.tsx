// components/ImportModal.tsx
'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetCollection?: string;
};

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");

  if (!isOpen) return null;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,         // Transforme les lignes en objets
      skipEmptyLines: true, // Ignore les lignes vides
      delimiter: ",",       // <--- ON FORCE LA VIRGULE (C'est la clé !)
      encoding: "UTF-8",    // Pour gérer les accents
      complete: (results) => {
        console.log("Résultat brut PapaParse :", results);

        // Si le parsing a échoué et n'a trouvé qu'une seule colonne, on tente un fallback
        if (results.meta.fields && results.meta.fields.length === 1) {
             console.warn("Attention : une seule colonne détectée. Tentative de détection auto...");
             // Ici on pourrait relancer sans délimiteur si besoin, mais
             // avec Manabox, forcer la virgule est normalement la bonne solution.
        }
        
        setColumns(results.meta.fields || []);
        setData(results.data as any[]);
      },
      error: (error) => {
        console.error("Erreur PapaParse :", error);
      }
    });
  };

  const handleReset = () => {
    setData([]);
    setColumns([]);
    setFileName("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-5xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* En-tête */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Vérification du CSV
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">✕</button>
        </div>

        {/* Contenu */}
        <div className="flex-grow overflow-hidden flex flex-col">
          
          {/* Écran d'upload */}
          {data.length === 0 && (
            <div className="p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition relative cursor-pointer group">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📂</div>
              <p className="font-bold text-lg text-gray-700 dark:text-gray-200">
                Déposer votre fichier Manabox ici
              </p>
              <p className="text-sm text-gray-400 mt-2">Format .csv attendu</p>
            </div>
          )}

          {/* Écran de résultat (Tableau) */}
          {data.length > 0 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm">
                   <span className="font-bold text-gray-900 dark:text-white">{fileName}</span>
                   <span className="ml-3 text-green-600 font-bold bg-green-50 px-2 py-1 rounded">✅ {data.length} cartes trouvées</span>
                </div>
                <button 
                  onClick={handleReset}
                  className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded hover:bg-red-200 font-medium"
                >
                  🗑️ Changer de fichier
                </button>
              </div>

              <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg flex-grow bg-gray-50 dark:bg-gray-900 shadow-inner">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 border-collapse">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-800 dark:text-gray-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {columns.map((col, index) => (
                        <th key={index} className="px-4 py-3 border-b border-r border-gray-300 dark:border-gray-600 whitespace-nowrap last:border-r-0">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 100).map((row, rowIndex) => (
                      <tr key={rowIndex} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                        {columns.map((col, colIndex) => (
                          <td key={colIndex} className="px-4 py-2 border-r border-gray-100 dark:border-gray-700 whitespace-nowrap max-w-[250px] truncate last:border-r-0">
                            {/* Affichage sécurisé */}
                            {row[col] !== undefined && row[col] !== null ? String(row[col]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-center text-gray-400 mt-2 italic">
                Aperçu des 100 premières lignes. Les accents et symboles doivent être lisibles.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}