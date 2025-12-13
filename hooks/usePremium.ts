// hooks/usePremium.ts
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export function usePremium() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsPremium(false);
        setLoading(false);
        return; // Stoppe l'exécution si pas d'utilisateur
    }
    setLoading(true);

    // Écoute en temps réel les changements sur le document utilisateur
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        // Le Webhook Stripe met à jour ce champ
        setIsPremium(docSnap.data()?.isPremium === true);
        setLoading(false);
    }, (error) => {
        // Ajout d'un gestionnaire d'erreur pour intercepter les erreurs de permission
        if (error.code === 'permission-denied') {
            console.warn("usePremium: Permission refusée. Arrêt de l'écoute.");
            setIsPremium(false);
            setLoading(false);
        } else {
             console.error("Erreur check premium", error);
             setLoading(false);
        }
    });

    return () => unsub();
  }, [user]);

  return { isPremium, loading };
}