// components/DeleteAllButton.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

type DeleteAllButtonProps = {
  targetCollection: 'wishlist' | 'collection';
};

export default function DeleteAllButton({ targetCollection }: DeleteAllButtonProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Fonction utilitaire pour découper en paquets de 500
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const handleDeleteAll = async () => {
    if (!user) return;

    setIsDeleting(true);
    const toastId = toast.loading("Suppression en cours...");

    try {
      // 1. On récupère TOUTES les cartes
      const colRef = collection(db, 'users', user.uid, targetCollection);
      const snapshot = await getDocs(colRef);

      if (snapshot.empty) {
        toast.success("La liste est déjà vide !", { id: toastId });
        setIsDeleting(false);
        return;
      }

      const docs = snapshot.docs;
      // 2. On découpe en lots de 500 (limite technique Firestore)
      const batches = chunkArray(docs, 500);

      // 3. On supprime lot par lot
      for (const batchDocs of batches) {
        const batch = writeBatch(db);
        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      toast.success(`Tout a été supprimé (${docs.length} cartes).`, { id: toastId });

    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsConfirmOpen(true)}
        disabled={isDeleting}
        className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
        title="Tout effacer"
      >
        {isDeleting ? '...' : '🗑️ Vider la liste'}
      </button>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDeleteAll}
        title="⚠️ DANGER : Tout supprimer ?"
        message={`Vous êtes sur le point de supprimer INTÉGRALEMENT votre ${targetCollection}. Cette action est irréversible.`}
      />
    </>
  );
}