// app/search/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { ScryfallRawData } from '@/lib/cardUtils';
import { CardType } from '@/hooks/useCardCollection';
import { useWishlists } from '@/hooks/useWishlists';
import CardVersionPickerModal from '@/components/CardVersionPickerModal';
import toast from 'react-hot-toast';

export default function SearchPage() {
  const { user } = useAuth();
  const { lists } = useWishlists();
  
  // États de recherche
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallRawData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // États du Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBaseCard, setSelectedBaseCard] = useState<ScryfallRawData | null>(null);
  const [targetDestination, setTargetDestination] = useState<'collection' | 'wishlist'>('collection');

  // --- 1. FONCTION DE RECHERCHE ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.data) {
            setResults(data.data);
        } else {
            toast.error("Aucune carte trouvée.");
        }
    } catch (error) {
        console.error(error);
        toast.error("Erreur de recherche.");
    } finally {
        setIsSearching(false);
    }
  };

  // --- 2. OUVERTURE DU MODAL ---
  const openPicker = (card: ScryfallRawData, destination: 'collection' | 'wishlist') => {
      setSelectedBaseCard(card);
      setTargetDestination(destination);
      setModalOpen(true);
  };

  // --- 3. SAUVEGARDE EN BASE ---
  const handleConfirmAdd = async (card: CardType, targetListId: string = 'default') => {
      if (!user) return;

      const destLabel = targetDestination === 'collection' ? 'Collection' : 'Wishlist';
      const toastId = toast.loading(`Ajout à : ${destLabel}...`);
      
      try {
          // Détermination du chemin Firestore
          let collectionPath = 'collection';
          if (targetDestination === 'wishlist') {
              if (targetListId === 'default') {
                  collectionPath = 'wishlist';
              } else {
                  collectionPath = `wishlists_data/${targetListId}/cards`;
              }
          }

          const cardRef = doc(db, 'users', user.uid, collectionPath, card.id);

          // Construction de l'objet (NETTOYAGE ET SÉCURISATION)
          // On évite les doublons de clés ici
          const dataToSave = {
              ...card, // On copie toutes les propriétés de base
              
              // SÉCURITÉ FIRESTORE : On écrase imageBackUrl pour garantir qu'il n'est pas undefined
              imageBackUrl: card.imageBackUrl || null,
              
              // Métadonnées système
              addedAt: serverTimestamp(),
              
              // Logique métier
              wishlistId: targetDestination === 'wishlist' ? targetListId : null, 
              isForTrade: false 
          };

          // Sauvegarde (set avec merge pour gérer l'incrément si existant)
          await setDoc(cardRef, {
              ...dataToSave,
              quantity: increment(card.quantity)
          }, { merge: true });

          toast.success(`Ajouté avec succès !`, { id: toastId });

      } catch (error) {
          console.error(error);
          toast.error("Erreur lors de l'ajout", { id: toastId });
      }
  };

  // Filtre visuel pour éviter les doublons de noms
  const uniqueResults = useMemo(() => {
    const seen = new Set();
    return results.filter(c => {
        const name = c.name.split(' // ')[0];
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
    });
  }, [results]);

  return (
    <main className="container mx-auto p-4 max-w-5xl min-h-[85vh]">
      
      {/* HEADER */}
      <div className="text-center mb-8 pt-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              🔍 Centre de Recherche
          </h1>
          <p className="text-gray-500">
              Trouvez n&apos;importe quelle carte et ajoutez-la à votre Collection ou votre Wishlist.
          </p>
      </div>

      {/* BARRE DE RECHERCHE */}
      <div className="max-w-2xl mx-auto mb-10 sticky top-4 z-20">
          <form onSubmit={handleSearch} className="relative shadow-lg rounded-full">
              <input 
                  type="text" 
                  className="w-full p-4 pl-6 pr-14 rounded-full border-2 border-transparent bg-white dark:bg-gray-800 dark:text-white focus:border-blue-500 outline-none transition text-lg"
                  placeholder="Nom de la carte (ex: Black Lotus, Sol Ring...)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
              />
              <button 
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isSearching ? '...' : '🔎'}
              </button>
          </form>
      </div>

      {/* RÉSULTATS */}
      {isSearching ? (
          <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400">Interrogation de Scryfall...</p>
          </div>
      ) : uniqueResults.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {uniqueResults.map((card) => (
                  <div key={card.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col group hover:shadow-md transition">
                      {/* Image */}
                      <div className="relative aspect-[2.5/3.5] bg-gray-200 overflow-hidden">
                          {card.image_uris?.normal ? (
                              <img src={card.image_uris.normal} alt={card.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                          ) : (
                             <div className="flex items-center justify-center h-full text-gray-400 text-xs">Pas d&apos;image</div>
                          )}
                          
                          {/* Overlay au survol */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
                              <button 
                                  onClick={() => openPicker(card, 'collection')}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300"
                              >
                                  + Collection
                              </button>
                              <button 
                                  onClick={() => openPicker(card, 'wishlist')}
                                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-sm shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75"
                              >
                                  + Wishlist
                              </button>
                          </div>
                      </div>

                      <div className="p-3">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate" title={card.name}>{card.name}</h3>
                          <p className="text-xs text-gray-500">{card.set_name}</p>
                      </div>
                  </div>
              ))}
          </div>
      ) : hasSearched ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-xl text-gray-500">Aucun résultat trouvé pour &quot;{query}&quot;.</p>
          </div>
      ) : (
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto opacity-50 hover:opacity-100 transition-opacity">
               <div className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center">
                   <span className="text-4xl mb-2 block">📚</span>
                   <h3 className="font-bold">Compléter ma Collection</h3>
               </div>
               <div className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center">
                   <span className="text-4xl mb-2 block">✨</span>
                   <h3 className="font-bold">Remplir ma Wishlist</h3>
               </div>
          </div>
      )}

      <CardVersionPickerModal 
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          baseCard={selectedBaseCard}
          onConfirm={handleConfirmAdd}
          destination={targetDestination}
          availableLists={lists}
      />

    </main>
  );
}