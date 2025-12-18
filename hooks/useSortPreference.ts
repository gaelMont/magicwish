import { useState, useEffect } from 'react';

// Définition complète et exhaustive des options de tri
export type SortOption = 
    // Options Temporelles
    | 'date_desc' 
    | 'date_asc'
    | 'date' // Legacy (gardé pour compatibilité avec vos anciennes données)

    // Options Prix
    | 'price_desc' 
    | 'price_asc'

    // Options Nom
    | 'name_asc'
    | 'name_desc'
    | 'name' // Legacy

    // Options Quantité
    | 'quantity_desc' 
    | 'quantity_asc'
    | 'quantity' // Legacy

    // Options Mana (CMC) - NOUVEAU
    | 'cmc_desc'
    | 'cmc_asc'

    // Options Édition (Set) - NOUVEAU (C'est ce qui vous manque)
    | 'set_asc'
    | 'set_desc';

const useSortPreference = (key: string, defaultValue: SortOption = 'date_desc') => {
    // La valeur par défaut doit être une nouvelle valeur valide
    const [sort, setSort] = useState<SortOption>(() => {
        if (typeof window === 'undefined') {
            return defaultValue;
        }
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue) {
                // On pourrait ajouter une validation ici pour vérifier si c'est une option valide
                // Mais pour l'instant on fait confiance au stockage
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