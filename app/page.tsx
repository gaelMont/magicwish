// app/page.tsx
'use client'; 

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, getDoc, increment } from 'firebase/firestore'; 
import toast from 'react-hot-toast';

// --- TYPES ---
type ScryfallCard = {
  id: string;
  name: string;
  set_name: string;
  set: string;
  released_at: string; // Pour trier par date si besoin
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

// --- FONCTION UTILITAIRE IMAGE ---
const getCardImage = (card: ScryfallCard): string => {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces && card.card_faces[0]?.image_uris?.normal) {
    return card.card_faces[0].image_uris.normal;
  }
  return CARD_BACK_URL;
};

// --- SOUS-COMPOSANT : Gère l'affichage d'une carte et ses versions ---
const CardGroup = ({ name, versions }: { name: string, versions: ScryfallCard[] }) => {
  const { user } = useAuth();
  
  // On sélectionne par défaut la première version (souvent la plus récente selon Scryfall)
  const [selectedCard, setSelectedCard] = useState<ScryfallCard>(versions[0]);

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVersion = versions.find(v => v.id === e.target.value);
    if (newVersion) setSelectedCard(newVersion);
  };

  const addToWishlist = async () => {
    if (!user) {
      toast.error("Connectez-vous pour ajouter des cartes !");
      return;
    }

    const card = selectedCard; // On prend bien celle sélectionnée dans le menu
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
        toast.success(`+1 exemplaire (${card.set_name})`);
      } else {
        await setDoc(wishlistRef, {
          name: card.name,
          imageUrl: validImageUrl,
          quantity: 1,
          price: priceNumber,
          setName: card.set_name,
          setCode: card.set,
          addedAt: new Date()
        });
        toast.success(`Ajoutée : ${card.set_name}`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur sauvegarde");
    }
  };

  return (
    <div className="relative group flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Image qui change selon la sélection */}
      <div className="relative w-full min-h-[250px] bg-gray-200 dark:bg-gray-900">
        <img
          src={getCardImage(selectedCard)}
          alt={name}
          className="w-full h-full object-contain p-2"
        />
      </div>

      <div className="p-3 flex flex-col flex-grow gap-2">
        <h3 className="font-bold text-center truncate" title={name}>{name}</h3>

        {/* --- SÉLECTEUR D'ÉDITION --- */}
        <select 
          value={selectedCard.id}
          onChange={handleVersionChange}
          className="w-full p-2 text-xs border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white outline-none cursor-pointer"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.set_name} ({v.set.toUpperCase()}) - {v.prices?.eur ? `${v.prices.eur}€` : "N/A"}
            </option>
          ))}
        </select>

        {/* PRIX et BOUTON */}
        <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="font-bold text-blue-600 dark:text-blue-400">
             {selectedCard.prices?.eur ? `${selectedCard.prices.eur} €` : "Prix N/A"}
          </span>

          {user && (
            <button
              onClick={addToWishlist}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-sm font-medium transition shadow-sm"
            >
              Ajouter +
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


// --- COMPOSANT PRINCIPAL ---
export default function HomePage() {
  const [query, setQuery] = useState('');
  const [groupedResults, setGroupedResults] = useState<{ name: string, versions: ScryfallCard[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setGroupedResults([]); // Reset

    try {
      // On garde unique=prints pour avoir TOUTES les versions
      const response = await fetch(`/api/search?q=${query}`);
      if (!response.ok) throw new Error('Erreur');
      const data = await response.json();
      const rawCards: ScryfallCard[] = data.data || [];

      // --- ALGORITHME DE GROUPEMENT ---
      // On crée un dictionnaire : "Sol Ring" -> [Version1, Version2, Version3]
      const groups = new Map<string, ScryfallCard[]>();

      rawCards.forEach(card => {
        if (!groups.has(card.name)) {
          groups.set(card.name, []);
        }
        groups.get(card.name)?.push(card);
      });

      // On transforme le Map en tableau pour l'afficher
      const resultsArray = Array.from(groups.entries()).map(([name, versions]) => ({
        name,
        versions
      }));

      setGroupedResults(resultsArray);

    } catch (err) {
      toast.error("Aucune carte trouvée.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8 text-center mt-8">MagicWish ✨</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-10 max-w-xl mx-auto">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (ex: Sol Ring)..."
          className="flex-grow p-3 border rounded-lg shadow-sm outline-none transition-colors
            bg-white text-gray-900 border-gray-300 placeholder-gray-500
            dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
        />
        <button 
          type="submit" 
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-semibold disabled:opacity-50 transition"
        >
          {isLoading ? '...' : '🔍'}
        </button>
      </form>

      {/* GRILLE D'AFFICHAGE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {groupedResults.map((group) => (
          <CardGroup 
            key={group.name} 
            name={group.name} 
            versions={group.versions} 
          />
        ))}
      </div>
    </main>
  );
}