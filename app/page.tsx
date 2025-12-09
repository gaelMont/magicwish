// app/page.tsx
'use client'; 

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, getDoc, increment } from 'firebase/firestore'; 
import toast from 'react-hot-toast';

// 1. Mise à jour du Type pour gérer les cartes Recto-Verso
type ScryfallCard = {
  id: string;
  name: string;
  image_uris?: {
    small: string;
    normal: string;
  };
  // Les cartes double face ont leurs images ici :
  card_faces?: {
    image_uris?: {
      small: string;
      normal: string;
    };
  }[];
};

// URL d'un dos de carte Magic standard (pour éviter l'erreur "empty string")
const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

export default function HomePage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 2. Fonction utilitaire pour trouver la bonne image (Recto, Verso, ou Dos)
  const getCardImage = (card: ScryfallCard): string => {
    // Cas 1 : Carte normale
    if (card.image_uris?.normal) {
      return card.image_uris.normal;
    }
    // Cas 2 : Carte Double Face (on prend le recto : index 0)
    if (card.card_faces && card.card_faces[0]?.image_uris?.normal) {
      return card.card_faces[0].image_uris.normal;
    }
    // Cas 3 : Pas d'image trouvée -> on retourne le dos de carte
    return CARD_BACK_URL;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setResults([]);

    try {
      const response = await fetch(`/api/search?q=${query}`);
      if (!response.ok) throw new Error('Erreur recherche');
      const data = await response.json();
      setResults(data.data || []); 
    } catch (err) {
      toast.error("Aucune carte trouvée.");
    } finally {
      setIsLoading(false);
    }
  };

  const addToWishlist = async (card: ScryfallCard) => {
    if (!user) {
      toast.error("Vous devez être connecté !");
      return;
    }

    const wishlistRef = doc(db, 'users', user.uid, 'wishlist', card.id);
    const validImageUrl = getCardImage(card); // On utilise notre fonction sécurisée ici aussi

    try {
      const docSnap = await getDoc(wishlistRef);

      if (docSnap.exists()) {
        await updateDoc(wishlistRef, {
          quantity: increment(1)
        });
        toast.success(`Et de une de plus ! (${docSnap.data().quantity + 1})`);
      } else {
        await setDoc(wishlistRef, {
          name: card.name,
          imageUrl: validImageUrl, // On sauvegarde la bonne URL
          quantity: 1,
          addedAt: new Date()
        });
        toast.success("Carte ajoutée à la wishlist !");
      }
    } catch (error) {
      console.error(error);
      toast.error("Oups, erreur de sauvegarde.");
    }
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8 text-center mt-8">Rechercher une carte Magic</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-xl mx-auto">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom de la carte (ex: Ludevic)"
          className="flex-grow p-3 border rounded-lg shadow-sm outline-none transition-colors
            bg-white text-gray-900 border-gray-300 placeholder-gray-500
            dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
        />
        <button 
          type="submit" 
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {isLoading ? '...' : 'Rechercher'}
        </button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {results.map((card) => (
          <div key={card.id} className="relative group">
            {/* 3. On utilise getCardImage ici */}
            <img
              src={getCardImage(card)}
              alt={card.name}
              className="rounded-xl shadow-md hover:shadow-xl transition duration-300 w-full bg-gray-200 dark:bg-gray-700 min-h-[200px]"
            />
            
            <div className="mt-2 flex justify-between items-center px-1">
              <p className="text-sm font-medium truncate flex-1">{card.name}</p>
              
              {user && (
                <button
                  onClick={() => addToWishlist(card)}
                  className="ml-2 bg-blue-100 text-blue-600 hover:bg-blue-200 p-2 rounded-full transition"
                  title="Ajouter / Incrémenter"
                >
                  +
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}