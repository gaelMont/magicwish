// hooks/useColumnPreference.ts
'use client';

import { useState, useEffect } from 'react';

export function useColumnPreference(storageKey: string, defaultValue: number) {
  const [columns, setColumnsState] = useState(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Lecture au montage du composant (côté client uniquement)
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setColumnsState(parsed);
      }
    }
    setIsLoaded(true);
  }, [storageKey]);

  const setColumns = (val: number) => {
    setColumnsState(val);
    localStorage.setItem(storageKey, val.toString());
  };

  return { columns, setColumns, isLoaded };
}