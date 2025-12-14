// hooks/useSortPreference.ts
'use client';

import { useState, useEffect } from 'react';

// On exporte le type pour l'utiliser dans la page
export type SortOption = 'name' | 'price_desc' | 'price_asc' | 'quantity' | 'date';

export function useSortPreference(storageKey: string, defaultValue: SortOption) {
  const [sortBy, setSortByState] = useState<SortOption>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Lecture au montage (client uniquement)
    const saved = localStorage.getItem(storageKey);
    if (saved) {
       // Sécurité : on vérifie que la valeur est un tri valide
       if (['name', 'price_desc', 'price_asc', 'quantity', 'date'].includes(saved)) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setSortByState(saved as SortOption);
       }
    }
    setIsLoaded(true);
  }, [storageKey]);

  const setSortBy = (val: SortOption) => {
    setSortByState(val);
    localStorage.setItem(storageKey, val);
  };

  return { sortBy, setSortBy, isLoaded };
}