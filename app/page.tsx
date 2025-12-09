// app/page.tsx
'use client'; 

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, getDoc, increment } from 'firebase/firestore'; 
import toast from 'react-hot-toast';

type ScryfallCard = {
  id: string;
  name: string;
  set_name: string; // <--- Nouveau : Nom de l'édition (ex: "Commander 2019")
  set: string; // Code du set (ex: "c19")
  collector_number: string; // Numéro de collection
  image_uris?: {
    small: string;
    normal: string;
  };
  card_faces?: {
    image_uris?: {
      small: string;
      normal: string;
    };
  }[];
  prices?: {
    eur?: string;
  };
};

const CARD_BACK_URL = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";

export default function HomePage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getCardImage = (card: ScryfallCard): string => {
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces && card.card_faces[0]?.image_uris?.normal) {
      return card.card_faces[0].image_uris.normal;
    }
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
    const validImageUrl = getCardImage(card);
    const priceNumber = card.prices?.eur ? parseFloat(card.prices.eur) : 0;

    try {
      const docSnap = await getDoc(wishlistRef);

      if (docSnap.exists()) {
        await updateDoc(wishlistRef, {
          quantity: increment(1),
          price: priceNumber
        });
        toast.success(`Quantité augmentée !`);
      } else {
        await setDoc(wishlistRef, {
          name: card.name,
          imageUrl: validImageUrl,
          quantity: 1,
          price: priceNumber,
          setName: card.set_name, // <--- On sauvegarde l'édition
          setCode: card.set,      // <--- On sauvegarde le code
          addedAt: new Date()
        });
        toast.success(`Ajoutée (${card.set_name})`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur de sauvegarde.");
    }
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8 text-center mt-8">Rechercher une version</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-xl mx-auto">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: Counterspell"
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
          <div key={card.id} className="relative group flex flex-col h-full">
            <img
              src={getCardImage(card)}
              alt={card.name}
              className="rounded-xl shadow-md hover:shadow-xl transition duration-300 w-full bg-gray-200 dark:bg-gray-700 min-h-[200px]"
            />
            
            <div className="mt-2 px-1 flex flex-col flex-grow">
               <div className="flex justify-between items-start">
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate">{card.name}</p>
                  
                  {/* AFFICHAGE DE L'ÉDITION */}
                  <p className="text-xs text-blue-600 dark:text-blue-400 truncate font-medium">
                    {card.set_name} 
                    <span className="text-gray-400 ml-1 text-[10px] uppercase">({card.set})</span>
                  </p>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {card.prices?.eur ? `${card.prices.eur} €` : "N/A"}
                  </p>
                </div>
                
                {user && (
                  <button
                    onClick={() => addToWishlist(card)}
                    className="ml-2 bg-blue-100 text-blue-600 hover:bg-blue-200 p-2 rounded-full transition flex-shrink-0"
                    title={`Ajouter cette version (${card.set_name})`}
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}