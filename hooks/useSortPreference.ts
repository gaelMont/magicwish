// hooks/useSortPreference.ts (Mise à jour essentielle pour corriger les erreurs de type)

import { useState, useCallback, useEffect } from 'react';

// Définition complète des options de tri
export type SortOption = 
    | 'date' // Ancienne valeur (gardée pour la compatibilité)
    | 'quantity' 
    | 'price_desc' 
    | 'price_asc'
    | 'name' // Ancienne valeur (gardée pour la compatibilité)
    | 'date_desc' 
    | 'date_asc'
    | 'name_asc'
    | 'name_desc';

const useSortPreference = (key: string, defaultValue: SortOption = 'date_desc') => {
    // La valeur par défaut doit être une nouvelle valeur valide
    const [sort, setSort] = useState<SortOption>(() => {
        if (typeof window === 'undefined') {
            return defaultValue;
        }
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue) {
                // S'assurer que la valeur stockée est assignable au type SortOption
                return storedValue as SortOption; 
            }
            return defaultValue;
        } catch (error) {
            console.error("Error reading localStorage key:", key, error);
            return defaultValue;
        }
    });

    // Mise à jour de localStorage lorsque l'état change
    useEffect(() => {
        try {
            localStorage.setItem(key, sort);
        } catch (error) {
            console.error("Error setting localStorage key:", key, error);
        }
    }, [key, sort]);

    return { sortBy: sort, setSortBy: setSort };
};

export { useSortPreference };