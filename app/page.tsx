// app/page.tsx
'use client'; 

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, getDoc, increment } from 'firebase/firestore'; 
import { useWishlists } from '@/hooks/useWishlists'; // <--- NOUVEL IMPORT
import toast from 'react-hot-toast';

// --- TYPES ---
type ScryfallCard = {
  id: string;
  oracle_id: string;
  name: string;
  set_name: string;
  set: string;
  released_at: string;
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

// --- SOUS-COMPOSANT : Gère l'affichage d'une carte ---
// PROPS AJOUTÉE : targetListId
const CardGroup = ({ 
  name, 
  versions, 
  targetListId 
}: { 
  name: string, 
  versions: ScryfallCard[], 
  targetListId: string 
}) => {
  const { user } = useAuth();
  
  // Par défaut, on prend la première version
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

    const card = selectedCard; 
    
    // --- LOGIQUE DE CHEMIN DYNAMIQUE ---
    let collectionPath = '';
    if (targetListId === 'default') {
        collectionPath = `users/${user.uid}/wishlist`;
    } else {
        collectionPath = `users/${user.uid}/wishlists_data/${targetListId}/cards`;
    }
    
    const wishlistRef = doc(db, collectionPath, card.id);
    // ------------------------------------

    const validImageUrl = getCardImage(card);
    const priceNumber = card.prices?.eur ? parseFloat(card.prices.eur) : 0;
    const cleanName = card.name.split(' // ')[0];

    try {
      const docSnap = await getDoc(wishlistRef);
      if (docSnap.exists()) {
        await updateDoc(wishlistRef, { 
          quantity: increment(1),
          price: priceNumber // Mise à jour du prix au cas où il a changé
        });
        toast.success(`+1 exemplaire (${card.set_name})`);
      } else {
        await setDoc(wishlistRef, {
          name: cleanName,
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
      toast.error("Erreur lors de l'ajout.");
    }
  };

  return (
    <div className="relative group flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Image */}
      <div className="relative w-full min-h-[250px] bg-gray-200 dark:bg-gray-900 flex items-center justify-center p-2">
        <img
          src={getCardImage(selectedCard)}
          alt={name}
          className="w-full h-full object-contain max-h-[350px]"
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
  const { user } = useAuth();
  
  // --- NOUVEAU HOOK POUR LES LISTES ---
  const { lists, loading: listsLoading } = useWishlists();
  const [selectedTargetList, setSelectedTargetList] = useState<string>('default');

  const [query, setQuery] = useState('');
  const [groupedResults, setGroupedResults] = useState<{ name: string, versions: ScryfallCard[] }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setGroupedResults([]); 

    try {
      const response = await fetch(`/api/search?q=${query}`);
      if (!response.ok) throw new Error('Erreur');
      const data = await response.json();
      const rawCards: ScryfallCard[] = data.data || [];

      // Groupement
      const groups = new Map<string, ScryfallCard[]>();
      rawCards.forEach(card => {
        const cleanName = card.name.split(' // ')[0];
        if (!groups.has(cleanName)) groups.set(cleanName, []);
        groups.get(cleanName)?.push(card);
      });

      const resultsArray = Array.from(groups.entries()).map(([cleanName, versions]) => ({
        name: cleanName, 
        versions: versions
      }));

      setGroupedResults(resultsArray);

    } catch (err) {
      toast.error("Aucune carte trouvée.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8 text-center mt-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
        MagicWish ✨
      </h1>

      <div className="max-w-xl mx-auto mb-10 space-y-3">
        {/* FORMULAIRE DE RECHERCHE */}
        <form onSubmit={handleSearch} className="flex gap-2">
            <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (ex: Black Lotus)..."
            className="flex-grow p-3 border rounded-lg shadow-sm outline-none transition-colors
                bg-white text-gray-900 border-gray-300 placeholder-gray-500
                dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400 focus:border-blue-500"
            />
            <button 
            type="submit" 
            disabled={isSearching}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-semibold disabled:opacity-50 transition shadow-sm"
            >
            {isSearching ? '...' : '🔍'}
            </button>
        </form>

        {/* SÉLECTEUR DE LISTE CIBLE (Visible seulement si connecté) */}
        {user && (
            <div className="flex justify-end items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <label htmlFor="targetList" className="text-sm text-gray-500 dark:text-gray-400">
                    Ajouter dans :
                </label>
                <div className="relative">
                    <select
                        id="targetList"
                        value={selectedTargetList}
                        onChange={(e) => setSelectedTargetList(e.target.value)}
                        disabled={listsLoading}
                        className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-1.5 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                    >
                        {/* Si chargement ou vide, option par défaut */}
                        {lists.length === 0 ? (
                            <option value="default">Liste principale</option>
                        ) : (
                            lists.map((list) => (
                                <option key={list.id} value={list.id}>
                                    {list.name}
                                </option>
                            ))
                        )}
                    </select>
                    {/* Petite flèche custom pour le style */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* GRILLE D'AFFICHAGE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {groupedResults.map((group) => (
          <CardGroup 
            key={group.name} 
            name={group.name} 
            versions={group.versions} 
            targetListId={selectedTargetList} // <--- ON PASSE L'ID DE LA LISTE CHOISIE
          />
        ))}
      </div>
    </main>
  );
}