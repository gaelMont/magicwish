// app/wishlist/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useWishlists } from '@/hooks/useWishlists';
// Import des nouveaux composants
import SingleWishlistView from '@/components/wishlist/SingleWishlistView';
import GlobalWishlistView from '@/components/wishlist/GlobalWishlistView';

export default function WishlistPage() {
  const { user } = useAuth();
  const { lists, createList, deleteList, loading: metaLoading } = useWishlists();
  
  const [selectedListId, setSelectedListId] = useState<string>('default');
  const [newListName, setNewListName] = useState('');

  if (!user) return <p className="p-10 text-center">Veuillez vous connecter.</p>;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if(newListName.trim()) {
        createList(newListName);
        setNewListName('');
    }
  };

  return (
    <main className="container mx-auto p-4 flex flex-col md:flex-row gap-8 min-h-[85vh]">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-72 flex-none space-y-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
            <h3 className="font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                📑 Mes Listes
            </h3>
            
            {metaLoading ? (
                <p className="text-sm text-gray-400">Chargement...</p>
            ) : (
                <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                    
                    {/* BOUTON VUE GLOBALE */}
                    <button
                        onClick={() => setSelectedListId('GLOBAL_VIEW')}
                        className={`text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 mb-2 ${
                            selectedListId === 'GLOBAL_VIEW'
                            ? 'bg-purple-600 text-white shadow-md font-medium' 
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300'
                        }`}
                    >
                        <span>🌍</span> Tout voir (Fusionné)
                    </button>

                    <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

                    {lists.map(list => (
                        <div key={list.id} className="group flex items-center relative">
                            <button
                                onClick={() => setSelectedListId(list.id)}
                                className={`flex-grow text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                                    selectedListId === list.id 
                                    ? 'bg-blue-600 text-white shadow-md font-medium' 
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                }`}
                            >
                                {list.name}
                            </button>
                            
                            {list.id !== 'default' && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteList(list.id);
                                        if (selectedListId === list.id) setSelectedListId('default');
                                    }}
                                    className={`absolute right-2 p-1.5 rounded-md transition-opacity ${
                                        selectedListId === list.id 
                                        ? 'text-blue-200 hover:text-white hover:bg-blue-500' 
                                        : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                    title="Supprimer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Formulaire Création */}
            <form onSubmit={handleCreate} className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Nom nouvelle liste..." 
                        className="w-full text-sm p-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                    />
                    <button 
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg font-bold text-lg leading-none pb-1"
                    >
                        +
                    </button>
                </div>
            </form>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <section className="flex-grow min-w-0">
          {selectedListId === 'GLOBAL_VIEW' ? (
              <GlobalWishlistView lists={lists} />
          ) : (
              <SingleWishlistView 
                key={selectedListId} 
                listId={selectedListId} 
                listName={lists.find(l => l.id === selectedListId)?.name || 'Liste'} 
              />
          )}
      </section>

    </main>
  );
}