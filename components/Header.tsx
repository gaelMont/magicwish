// components/Header.tsx
'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { useCollections } from '@/hooks/useCollections';
import { useWishlists } from '@/hooks/useWishlists';
import { CreditsDisplay } from '@/components/CreditsDisplay';
import { Lock } from 'lucide-react'; // Icône professionnelle

export default function Header() {
  const { user, userProfile, friendRequestCount, logOut } = useAuth();
  
  const { lists: collectionLists, createList: createCollection } = useCollections();
  const { lists: wishlistLists, createList: createWishlist } = useWishlists();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [showCollectionSubmenu, setShowCollectionSubmenu] = useState(false);
  const [showWishlistSubmenu, setShowWishlistSubmenu] = useState(false);
  
  const collectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wishlistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isMobileCollectionOpen, setIsMobileCollectionOpen] = useState(false);
  const [isMobileWishlistOpen, setIsMobileWishlistOpen] = useState(false);
  const [isMobileSocialOpen, setIsMobileSocialOpen] = useState(false);

  // --- LOGIQUE PREMIUM ---
  const isPremium = userProfile?.isPremium ?? false;
  const MAX_FREE_LISTS = 1;

  // Création bloquée si limite atteinte
  const canCreateCollection = isPremium || collectionLists.length < MAX_FREE_LISTS;
  const canCreateWishlist = isPremium || wishlistLists.length < MAX_FREE_LISTS;

  // --- TRI DES LISTES ---
  // On trie par date pour que la liste "Gratuite" (la plus ancienne) soit toujours en premier
  const sortedWishlists = useMemo(() => {
    return [...wishlistLists].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }, [wishlistLists]);

  const sortedCollections = useMemo(() => {
    return [...collectionLists].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }, [collectionLists]);

  const linkClass = (path: string) => `
    text-sm font-medium transition-colors block py-2 md:py-0
    ${pathname === path 
      ? 'text-primary font-bold' 
      : 'text-muted hover:text-foreground'}
  `;

  const isSocialActive = ['/contacts', '/groups', '/stats'].includes(pathname);
  
  const showHeader = !pathname.startsWith('/life');

  if (!showHeader) return null;
  
  // --- ACTIONS ---

  const handleCreateCollection = () => {
      if (!canCreateCollection) {
          if (confirm("Limite atteinte (1 collection max). Passez Premium pour créer des collections illimitées.")) {
             router.push('/pricing');
          }
          return;
      }
      const listName = prompt("Nom de la nouvelle collection:");
      if (listName && listName.trim()) {
          createCollection(listName.trim());
          setShowCollectionSubmenu(false);
          setIsMobileCollectionOpen(false);
      }
  };
  
  const handleCollectionSelect = (listId: string) => {
      router.push(`/collection?listId=${listId}`);
      setShowCollectionSubmenu(false);
      setIsMobileCollectionOpen(false);
      setIsMenuOpen(false);
  };

  const handleCreateWishlist = () => {
      if (!canCreateWishlist) {
        if (confirm("Limite atteinte (1 wishlist max). Passez Premium pour créer des listes illimitées.")) {
           router.push('/pricing');
        }
        return;
      }
      const listName = prompt("Nom de la nouvelle wishlist:");
      if (listName && listName.trim()) {
          createWishlist(listName.trim());
          setShowWishlistSubmenu(false);
          setIsMobileWishlistOpen(false);
      }
  };

  const handleWishlistSelect = (listId: string) => {
      router.push(`/wishlist?listId=${listId}`);
      setShowWishlistSubmenu(false);
      setIsMobileWishlistOpen(false);
      setIsMenuOpen(false);
  };
  
  const currentCollectionId = pathname.startsWith('/collection') 
    ? (searchParams.get('listId') || 'default') : 'default';
    
  const currentWishlistId = pathname.startsWith('/wishlist') 
    ? (searchParams.get('listId') || 'default') : 'default';

  // --- MOUSE EVENTS ---

  const openCollectionMenu = () => {
      if (collectionTimeoutRef.current) clearTimeout(collectionTimeoutRef.current);
      setShowCollectionSubmenu(true);
  };
  const closeCollectionMenu = () => {
      collectionTimeoutRef.current = setTimeout(() => setShowCollectionSubmenu(false), 200);
  };

  const openWishlistMenu = () => {
      if (wishlistTimeoutRef.current) clearTimeout(wishlistTimeoutRef.current);
      setShowWishlistSubmenu(true);
  };
  const closeWishlistMenu = () => {
      wishlistTimeoutRef.current = setTimeout(() => setShowWishlistSubmenu(false), 200);
  };

  return (
    <header className="bg-surface/80 backdrop-blur-md border-b border-border p-4 sticky top-0 z-40 transition-colors duration-300">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          
          <Link 
            href="/" 
            className="text-2xl font-black tracking-tight text-primary hover:opacity-80 transition"
            onClick={() => setIsMenuOpen(false)}
          >
            MagicWish
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden md:block">
               <CreditsDisplay />
            </div>

            <ThemeToggle />

            {user ? (
              <>
                <nav className="hidden md:flex gap-6 mr-4 items-center h-full">
                  <Link href="/search" className={linkClass('/search')}>Recherche</Link> 
                  
                  {/* --- MENU WISHLIST DESKTOP --- */}
                  <div 
                      className="relative h-full flex items-center"
                      onMouseEnter={openWishlistMenu}
                      onMouseLeave={closeWishlistMenu}
                  >
                      <Link href="/wishlist" className={linkClass('/wishlist')}>
                          Ma Wishlist
                      </Link>
                      
                      {showWishlistSubmenu && (
                           <div className="absolute top-full left-0 pt-2 w-64 z-50">
                               <div className="bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                  <div className="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider bg-secondary/30">
                                      Mes Listes
                                  </div>
                                  <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
                                      {sortedWishlists.map((list, index) => {
                                          // Une liste est "Verrouillée" si index >= 1 et User non premium
                                          const isLocked = !isPremium && index >= MAX_FREE_LISTS;
                                          
                                          return (
                                              <button 
                                                  key={list.id}
                                                  onClick={() => handleWishlistSelect(list.id)}
                                                  className={`w-full text-left px-4 py-2 text-sm transition flex justify-between items-center group
                                                      ${currentWishlistId === list.id ? 'text-primary font-bold bg-secondary' : 'text-foreground hover:bg-secondary'}
                                                      ${isLocked ? 'opacity-70' : ''}
                                                  `}
                                                  title={list.name}
                                              >
                                                  <span className="truncate pr-2">{list.name}</span>
                                                  {isLocked && (
                                                      <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />
                                                  )}
                                              </button>
                                          );
                                      })}
                                  </div>
                                  <div className="border-t border-border">
                                      <button 
                                          onClick={handleCreateWishlist} 
                                          className={`w-full text-left px-4 py-2 text-sm font-bold flex justify-between items-center ${
                                            canCreateWishlist ? 'text-primary hover:bg-secondary' : 'text-muted bg-secondary/50 cursor-not-allowed'
                                          }`}
                                      >
                                          <span>+ Nouvelle Liste</span>
                                          {!canCreateWishlist && <span className="text-[10px] bg-muted text-surface px-1 rounded">MAX</span>}
                                      </button>
                                  </div>
                              </div>
                           </div>
                      )}
                  </div>
                  
                  {/* --- MENU COLLECTION DESKTOP --- */}
                  <div 
                      className="relative h-full flex items-center"
                      onMouseEnter={openCollectionMenu}
                      onMouseLeave={closeCollectionMenu}
                  >
                      <Link href="/collection" className={linkClass('/collection')}>
                          Ma Collection
                      </Link>
                      
                      {showCollectionSubmenu && (
                           <div className="absolute top-full left-0 pt-2 w-64 z-50">
                               <div className="bg-surface border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                  <div className="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider bg-secondary/30">
                                      Mes Classeurs
                                  </div>
                                  <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
                                      {sortedCollections.map((list, index) => {
                                          const isLocked = !isPremium && index >= MAX_FREE_LISTS;

                                          return (
                                              <button 
                                                  key={list.id}
                                                  onClick={() => handleCollectionSelect(list.id)}
                                                  className={`w-full text-left px-4 py-2 text-sm transition flex justify-between items-center group
                                                      ${currentCollectionId === list.id ? 'text-primary font-bold bg-secondary' : 'text-foreground hover:bg-secondary'}
                                                      ${isLocked ? 'opacity-70' : ''}
                                                  `}
                                                  title={list.name}
                                              >
                                                  <span className="truncate pr-2">{list.name}</span>
                                                  {isLocked && (
                                                      <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />
                                                  )}
                                              </button>
                                          );
                                      })}
                                  </div>
                                  <div className="border-t border-border">
                                      <button 
                                          onClick={handleCreateCollection} 
                                          className={`w-full text-left px-4 py-2 text-sm font-bold flex justify-between items-center ${
                                            canCreateCollection ? 'text-primary hover:bg-secondary' : 'text-muted bg-secondary/50 cursor-not-allowed'
                                          }`}
                                      >
                                          <span>+ Nouveau Classeur</span>
                                          {!canCreateCollection && <span className="text-[10px] bg-muted text-surface px-1 rounded">MAX</span>}
                                      </button>
                                  </div>
                              </div>
                           </div>
                      )}
                  </div>
                  
                  <Link href="/trades" className={linkClass('/trades')}>Echanges</Link>
                    
                  {/* --- SOCIAL --- */}
                  <div className="relative group h-full flex items-center">
                    <button className={`text-sm font-medium transition-colors flex items-center gap-1 ${isSocialActive ? 'text-primary font-bold' : 'text-muted hover:text-foreground'}`}>
                      Social
                      {friendRequestCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {friendRequestCount}
                        </span>
                      )}
                      <span className="text-[10px] transform group-hover:rotate-180 transition-transform">▼</span>
                    </button>
                    
                    <div className="absolute top-full right-0 pt-2 w-48 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <div className="bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                        <div className="py-1">
                            <Link href="/stats" className="flex w-full px-4 py-2 text-sm text-foreground hover:bg-secondary transition items-center">
                            Panthéon
                            </Link>
                            <Link href="/contacts" className="flex w-full px-4 py-2 text-sm text-foreground hover:bg-secondary transition justify-between items-center">
                            Mes Contacts
                            {friendRequestCount > 0 && (
                                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {friendRequestCount}
                                </span>
                            )}
                            </Link>
                            <Link href="/groups" className="flex w-full px-4 py-2 text-sm text-foreground hover:bg-secondary transition items-center">
                            Mes Playgroups
                            </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link href="/settings" className={linkClass('/settings')}>Paramètres</Link>
                </nav>

                <div className="h-5 w-px bg-border hidden md:block"></div>

                <div className="flex items-center gap-3">
                  {user.photoURL && (
                    <Image 
                      src={user.photoURL} 
                      alt="Avatar" 
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full bg-secondary border border-border object-cover"
                    />
                  )}
                  
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-foreground hover:bg-secondary rounded-lg font-bold text-sm"
                  >
                    Menu
                  </button>
                  
                  <button
                    onClick={() => logOut()}
                    className="hidden md:block text-xs font-medium text-muted hover:text-primary transition"
                  >
                    Quitter
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition shadow-md"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
        
        {/* MOBILE MENU */}
        {user && isMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-border animate-in slide-in-from-top-2">
             <div className="mb-4 flex justify-center">
                 <CreditsDisplay />
             </div>
             
             <nav className="flex flex-col space-y-3">
               <Link href="/search" className={linkClass('/search')} onClick={() => setIsMenuOpen(false)}>Recherche</Link>
               
               {/* --- MOBILE WISHLIST --- */}
               <div className="border-b border-border/50">
                  <button 
                      onClick={() => setIsMobileWishlistOpen(!isMobileWishlistOpen)}
                      className={`${linkClass('/wishlist')} w-full text-left py-2 flex justify-between items-center`}
                  >
                      Ma Wishlist
                      <span className={`text-[10px] transform transition-transform ${isMobileWishlistOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {isMobileWishlistOpen && (
                      <div className="bg-background/50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 mb-2 rounded-lg">
                          <div className="text-xs font-bold text-muted uppercase tracking-wider px-2 py-1">Mes Listes</div>
                          {sortedWishlists.map((list, index) => {
                              const isLocked = !isPremium && index >= MAX_FREE_LISTS;
                              return (
                                  <button 
                                      key={list.id}
                                      onClick={() => handleWishlistSelect(list.id)}
                                      className={`w-full text-left px-2 py-2 text-sm rounded transition flex justify-between items-center
                                          ${currentWishlistId === list.id ? 'text-primary font-bold bg-secondary' : 'text-foreground hover:bg-secondary'}
                                          ${isLocked ? 'opacity-70' : ''}
                                      `}
                                  >
                                      <span>{list.name}</span>
                                      {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />}
                                  </button>
                              );
                          })}
                          <div className="border-t border-border my-1"></div>
                          <button 
                              onClick={handleCreateWishlist} 
                              className={`w-full text-left px-2 py-2 text-sm font-bold flex justify-between ${canCreateWishlist ? 'text-primary hover:bg-secondary' : 'text-muted cursor-not-allowed'}`}
                          >
                              <span>+ Nouvelle Liste</span>
                              {!canCreateWishlist && <span className="text-[10px] bg-muted text-surface px-1 rounded">MAX</span>}
                          </button>
                      </div>
                  )}
               </div>
               
               {/* --- MOBILE COLLECTION --- */}
               <div className="border-b border-border/50">
                  <button 
                      onClick={() => setIsMobileCollectionOpen(!isMobileCollectionOpen)}
                      className={`${linkClass('/collection')} w-full text-left py-2 flex justify-between items-center`}
                  >
                      Ma Collection
                      <span className={`text-[10px] transform transition-transform ${isMobileCollectionOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {isMobileCollectionOpen && (
                      <div className="bg-background/50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 mb-2 rounded-lg">
                          <div className="text-xs font-bold text-muted uppercase tracking-wider px-2 py-1">Mes Classeurs</div>
                          {sortedCollections.map((list, index) => {
                              const isLocked = !isPremium && index >= MAX_FREE_LISTS;
                              return (
                                  <button 
                                      key={list.id}
                                      onClick={() => handleCollectionSelect(list.id)}
                                      className={`w-full text-left px-2 py-2 text-sm rounded transition flex justify-between items-center
                                          ${currentCollectionId === list.id ? 'text-primary font-bold bg-secondary' : 'text-foreground hover:bg-secondary'}
                                          ${isLocked ? 'opacity-70' : ''}
                                      `}
                                  >
                                      <span>{list.name}</span>
                                      {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />}
                                  </button>
                              );
                          })}
                          <div className="border-t border-border my-1"></div>
                          <button 
                              onClick={handleCreateCollection} 
                              className={`w-full text-left px-2 py-2 text-sm font-bold flex justify-between ${canCreateCollection ? 'text-primary hover:bg-secondary' : 'text-muted cursor-not-allowed'}`}
                          >
                              <span>+ Nouveau Classeur</span>
                              {!canCreateCollection && <span className="text-[10px] bg-muted text-surface px-1 rounded">MAX</span>}
                          </button>
                      </div>
                  )}
               </div>
               
               <Link href="/trades" className={linkClass('/trades')} onClick={() => setIsMenuOpen(false)}>Echanges</Link>
               
               {/* --- MOBILE SOCIAL --- */}
               <div className="border-b border-border/50">
                  <button 
                      onClick={() => setIsMobileSocialOpen(!isMobileSocialOpen)}
                      className={`${linkClass('/contacts')} w-full text-left py-2 flex justify-between items-center`}
                  >
                      <span className="flex items-center gap-2">
                        Social
                        {friendRequestCount > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {friendRequestCount}
                          </span>
                        )}
                      </span>
                      <span className={`text-[10px] transform transition-transform ${isMobileSocialOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {isMobileSocialOpen && (
                    <div className="bg-background/50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 mb-2 rounded-lg">
                        <Link href="/stats" className="block w-full text-left px-2 py-2 text-sm text-foreground hover:bg-secondary rounded" onClick={() => setIsMenuOpen(false)}>Panthéon</Link>
                        <Link href="/contacts" className="flex justify-between items-center w-full text-left px-2 py-2 text-sm text-foreground hover:bg-secondary rounded" onClick={() => setIsMenuOpen(false)}>
                          Mes Contacts
                          {friendRequestCount > 0 && <span className="bg-primary text-white text-[10px] px-1.5 rounded-full">{friendRequestCount}</span>}
                        </Link>
                        <Link href="/groups" className="block w-full text-left px-2 py-2 text-sm text-foreground hover:bg-secondary rounded" onClick={() => setIsMenuOpen(false)}>Mes Playgroups</Link>
                    </div>
                  )}
               </div>

               <Link href="/settings" className={linkClass('/settings')} onClick={() => setIsMenuOpen(false)}>Paramètres</Link>
               <button onClick={() => { logOut(); setIsMenuOpen(false); }} className="text-left py-2 text-danger text-sm font-bold">Déconnexion</button>
             </nav>
          </div>
        )}
      </div>
    </header>
  );
}