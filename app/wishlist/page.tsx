// app/wishlist/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useWishlists } from '@/hooks/useWishlists';
import SingleWishlistView from '@/components/wishlist/SingleWishlistView';
import GlobalWishlistView from '@/components/wishlist/GlobalWishlistView';
import DataTransferHubModal from '@/components/DataTransferHubModal'; 
import ImportModal from '@/components/ImportModal';
import ExportModal from '@/components/ExportModal';
import { useCardCollection } from '@/hooks/useCardCollection'; 

export default function WishlistPage() {
  const { user } = useAuth();
  const { lists, createList, deleteList, loading: metaLoading } = useWishlists();
  
  const [selectedListId, setSelectedListId] = useState<string>('default');
  const [newListName, setNewListName] = useState('');

  const [isHubOpen, setIsHubOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  // On charge les cartes uniquement pour l'export maintenant
  const { cards: selectedListCards } = useCardCollection('wishlist', selectedListId); 

  const currentListName = useMemo(() => {
    return lists.find(l => l.id === selectedListId)?.name || 'Liste principale';
  }, [lists, selectedListId]);

  if (!user) return <p className="p-10 text-center text-muted">Veuillez vous connecter.</p>;
  
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if(newListName.trim()) {
        createList(newListName);
        setNewListName('');
    }
  };

  const closeAllModals = () => {
    setIsHubOpen(false);
    setIsImportOpen(false);
    setIsExportOpen(false);
  };
  
  const openHub = () => {
    setIsImportOpen(false);
    setIsExportOpen(false);
    setIsHubOpen(true);
  };
  
  const handleSelectImport = () => {
    setIsHubOpen(false);
    setIsImportOpen(true);
  };
  
  const handleSelectExport = () => {
    setIsHubOpen(false);
    setIsExportOpen(true);
  };

  return (
    <main className="container mx-auto p-4 flex flex-col md:flex-row gap-8 min-h-[85vh]">
      
      <aside className="w-full md:w-72 flex-none space-y-6">
        <div className="bg-surface p-5 rounded-xl shadow-sm border border-border sticky top-24">
            <h3 className="font-bold mb-4 text-foreground flex items-center gap-2 border-b border-border pb-2">
                📑 Mes Listes
            </h3>
            
            {metaLoading ? (
                <p className="text-sm text-muted">Chargement...</p>
            ) : (
                <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                    
                    <button 
                        onClick={() => setIsHubOpen(true)}
                        className="btn-primary text-sm whitespace-nowrap mb-3 w-full"
                    >
                        Importer/Exporter
                    </button>
                    
                    <button
                        onClick={() => setSelectedListId('GLOBAL_VIEW')}
                        className={`text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 mb-2 ${
                            selectedListId === 'GLOBAL_VIEW'
                            ? 'bg-purple-600 text-white shadow-md font-medium' 
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/40 dark:text-purple-200'
                        }`}
                    >
                        <span>🌍</span> Tout voir (Fusionne)
                    </button>

                    <div className="border-t border-border my-2"></div>

                    {lists.map(list => (
                        <div key={list.id} className="group flex items-center relative">
                            <button
                                onClick={() => setSelectedListId(list.id)}
                                className={`grow text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                                    selectedListId === list.id 
                                    ? 'bg-primary text-primary-foreground shadow-md font-medium' 
                                    : 'hover:bg-secondary text-muted hover:text-foreground'
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
                                        ? 'text-white/70 hover:text-white' 
                                        : 'opacity-0 group-hover:opacity-100 text-muted hover:text-danger'
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

            <form onSubmit={handleCreate} className="mt-6 pt-4 border-t border-border">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Nom nouvelle liste..." 
                        className="w-full text-sm p-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                    />
                    <button 
                        type="submit"
                        className="bg-primary hover:opacity-90 text-primary-foreground px-3 rounded-lg font-bold text-lg leading-none pb-1 transition"
                    >
                        +
                    </button>
                </div>
            </form>
        </div>
      </aside>

      <section className="grow min-w-0">
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
      
      <DataTransferHubModal 
        isOpen={isHubOpen}
        onClose={closeAllModals}
        onSelectImport={handleSelectImport}
        onSelectExport={handleSelectExport}
        targetLabel="Wishlist"
      />
      
      <ImportModal 
          isOpen={isImportOpen} 
          onClose={closeAllModals} 
          onGoBack={openHub}       
          onCloseAll={closeAllModals}
          targetCollection="wishlist" 
          // Suppression de currentCollection ici aussi
      />
      
      <ExportModal
        isOpen={isExportOpen}
        onClose={closeAllModals}
        onGoBack={openHub}
        onCloseAll={closeAllModals}
        cards={selectedListCards}
        listName={currentListName}
        targetType="wishlist"
      />

    </main>
  );
}