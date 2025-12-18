import { useCallback, useRef } from 'react';

/**
 * Hook qui permet de différer l'exécution d'une fonction (ex: écriture en DB)
 * tout en permettant une mise à jour locale instantanée (UI Optimiste).
 */
export function useDebouncedUpdate<T extends unknown[]>(
    callback: (...args: T) => void,
    delay: number
) {
    // On utilise une ref pour stocker le timer afin qu'il survive aux re-rendus
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // On utilise une ref pour la callback pour toujours avoir la version la plus récente
    // sans avoir à la mettre dans les dépendances du useCallback
    const callbackRef = useRef(callback);
    // eslint-disable-next-line react-hooks/refs
    callbackRef.current = callback;

    const debouncedFunction = useCallback((...args: T) => {
        // Si un timer existe déjà (appel précédent récent), on l'annule
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // On lance un nouveau timer
        timeoutRef.current = setTimeout(() => {
            callbackRef.current(...args);
        }, delay);
    }, [delay]);

    // Fonction pour annuler manuellement si besoin (ex: démontage composant)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    return debouncedFunction;
}