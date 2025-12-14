// components/UsernameSetupModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function UsernameSetupModal() {
  const { user, username, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  const [inputVal, setInputVal] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // On ouvre la modale SI : user connecté, chargement fini, ET pas de username
  useEffect(() => {
    if (!loading && user && !username) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user, username, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputVal) return;

    // 1. Nettoyage et Validation basique
    const cleanUsername = inputVal.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (cleanUsername.length < 3) {
      toast.error("Le pseudo doit faire au moins 3 caractères.");
      return;
    }
    
    if (cleanUsername !== inputVal.trim().toLowerCase()) {
        toast.error("Caractères spéciaux interdits (sauf _ )");
        return;
    }

    setIsChecking(true);

    try {
      // 2. Vérification d'unicité (On check la collection 'usernames')
      const usernameRef = doc(db, 'usernames', cleanUsername);
      const usernameSnap = await getDoc(usernameRef);

      if (usernameSnap.exists()) {
        toast.error(`Le pseudo "@${cleanUsername}" est déjà pris.`);
        setIsChecking(false);
        return;
      }

      // 3. Création atomique (Tout ou rien) via Batch
      const batch = writeBatch(db);

      // A. Réserver le pseudo dans la collection globale
      batch.set(usernameRef, { uid: user.uid });

      // B. Créer le profil public de l'utilisateur
      const profileRef = doc(db, 'users', user.uid, 'public_profile', 'info');
      batch.set(profileRef, {
        username: cleanUsername,
        displayName: user.displayName || 'Joueur Inconnu',
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        bio: "Nouveau membre MagicWish"
      });

      await batch.commit();

      toast.success(`Bienvenue, @${cleanUsername} !`);
      setIsOpen(false); 

    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la création du profil.");
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-100 p-4 backdrop-blur-md">
      <div className="bg-surface rounded-2xl p-8 max-w-md w-full shadow-2xl border border-border animate-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2 text-primary">👋</div>
          <h2 className="text-2xl font-bold text-foreground">Bienvenue sur MagicWish !</h2>
          <p className="text-muted mt-2">
            Pour permettre à vos amis de vous trouver, veuillez choisir un <span className="font-bold text-primary">nom d&apos;utilisateur unique</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Votre pseudo (ex: jace_beleren)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">@</span>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value.toLowerCase())}
                className="w-full pl-8 p-3 border rounded-lg bg-background text-foreground border-border focus:ring-2 focus:ring-primary outline-none lowercase"
                placeholder="pseudo_unique"
                disabled={isChecking}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted mt-1">Lettres minuscules, chiffres et underscore (_) uniquement.</p>
          </div>

          <button
            type="submit"
            disabled={isChecking || inputVal.length < 3}
            className="w-full bg-primary hover:opacity-90 text-primary-foreground font-bold py-3 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Vérification...' : 'Valider mon profil'}
          </button>
        </form>
      </div>
    </div>
  );
}