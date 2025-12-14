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
import { checkWishlistMatch } from '@/app/actions/matching'; 

export default function SearchPage() {
  const { user } = useAuth();
  const { lists } = useWishlists();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallRawData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBaseCard, setSelectedBaseCard] = useState<ScryfallRawData | null>(null);
  const [targetDestination, setTargetDestination] = useState<'collection' | 'wishlist'>('collection');

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

  const openPicker = (card: ScryfallRawData, destination: 'collection' | 'wishlist') => {
      setSelectedBaseCard(card);
      setTargetDestination(destination);
      setModalOpen(true);
  };

  const handleConfirmAdd = async (card: CardType, targetListId: string = 'default') => {
      if (!user) return;

      const destLabel = targetDestination === 'collection' ? 'Collection' : 'Wishlist';
      const toastId = toast.loading(`Ajout à : ${destLabel}...`);
      
      try {
          let collectionPath = 'collection';
          if (targetDestination === 'wishlist') {
              if (targetListId === 'default') {
                  collectionPath = 'wishlist';
              } else {
                  collectionPath = `wishlists_data/${targetListId}/cards`;
              }
          }

          const cardRef = doc(db, 'users', user.uid, collectionPath, card.id);

          const dataToSave = {
              ...card,
              imageBackUrl: card.imageBackUrl || null,
              addedAt: serverTimestamp(),
              wishlistId: targetDestination === 'wishlist' ? targetListId : null, 
              isForTrade: false 
          };

          await setDoc(cardRef, {
              ...dataToSave,
              quantity: increment(card.quantity)
          }, { merge: true });

          toast.success(`Ajouté avec succès !`, { id: toastId });

          // --- DÉCLENCHEUR SCAN WISHLIST ---
          if (targetDestination === 'wishlist') {
              checkWishlistMatch(user.uid, [{ 
                  id: card.id, 
                  name: card.name, 
                  isFoil: !!card.isFoil 
              }]).then(res => {
                  if (res.matches && res.matches > 0) {
                      toast(`🎉 ${res.matches} ami(s) possèdent cette carte !`, { icon: '🔔', duration: 5000 });
                  }
              });
          }

      } catch (error) {
          console.error(error);
          toast.error("Erreur lors de l'ajout", { id: toastId });
      }
  };

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
      
      <div className="text-center mb-8 pt-4">
          <h1 className="text-3xl font-bold text-primary mb-2">
              Centre de Recherche
          </h1>
          <p className="text-muted">
              Trouvez n&apos;importe quelle carte et ajoutez-la à votre Collection ou votre Wishlist.
          </p>
      </div>

      <div className="max-w-2xl mx-auto mb-10 sticky top-4 z-20">
          <form onSubmit={handleSearch} className="relative shadow-lg rounded-full">
              <input 
                  type="text" 
                  className="w-full p-4 pl-6 pr-14 rounded-full border border-border bg-surface text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-lg"
                  placeholder="Nom de la carte (ex: Black Lotus, Sol Ring...)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
              />
              <button 
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-primary hover:opacity-90 text-primary-foreground rounded-full w-12 flex items-center justify-center transition disabled:opacity-50"
              >
                  {isSearching ? '...' : 'Go'}
              </button>
          </form>
      </div>

      {isSearching ? (
          <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-muted">Recherche en cours...</p>
          </div>
      ) : uniqueResults.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {uniqueResults.map((card) => (
                  <div key={card.id} className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden flex flex-col group hover:shadow-md transition">
                      <div className="relative aspect-[2.5/3.5] bg-secondary overflow-hidden">
                          {card.image_uris?.normal ? (
                              <img src={card.image_uris.normal} alt={card.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                          ) : (
                             <div className="flex items-center justify-center h-full text-muted text-xs">Pas d&apos;image</div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
                              <button 
                                  onClick={() => openPicker(card, 'collection')}
                                  className="w-full bg-primary hover:opacity-90 text-primary-foreground font-bold py-2 rounded-lg text-sm shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300"
                              >
                                  + Collection
                              </button>
                              <button 
                                  onClick={() => openPicker(card, 'wishlist')}
                                  className="w-full bg-surface text-primary font-bold py-2 rounded-lg text-sm shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75"
                              >
                                  + Wishlist
                              </button>
                          </div>
                      </div>

                      <div className="p-3">
                          <h3 className="font-bold text-foreground truncate" title={card.name}>{card.name}</h3>
                          <p className="text-xs text-muted">{card.set_name}</p>
                      </div>
                  </div>
              ))}
          </div>
      ) : hasSearched ? (
          <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
              <p className="text-xl text-muted">Aucun résultat trouvé.</p>
          </div>
      ) : (
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto opacity-50 hover:opacity-100 transition-opacity">
               <div className="p-6 border-2 border-dashed border-border rounded-xl text-center">
                   <span className="text-4xl mb-2 block font-bold text-muted">COLLECTION</span>
                   <h3 className="font-bold text-foreground">Compléter ma Collection</h3>
               </div>
               <div className="p-6 border-2 border-dashed border-border rounded-xl text-center">
                   <span className="text-4xl mb-2 block font-bold text-muted">WISHLIST</span>
                   <h3 className="font-bold text-foreground">Remplir ma Wishlist</h3>
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