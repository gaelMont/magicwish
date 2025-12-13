'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const { user, logOut, friendRequestCount } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const linkClass = (path: string) => `
    text-sm font-medium transition-colors block py-2 md:py-0
    ${pathname === path 
      ? 'text-primary font-bold' 
      : 'text-muted hover:text-foreground'}
  `;

  return (
    // UTILISATION DES VARIABLES : bg-surface, border-border
    <header className="bg-surface/80 backdrop-blur-md border-b border-border p-4 sticky top-0 z-40 transition-colors duration-300">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          
          {/* Logo utilise text-primary */}
          <Link 
            href="/" 
            className="text-2xl font-black tracking-tight text-primary hover:opacity-80 transition"
            onClick={() => setIsMenuOpen(false)}
          >
            MagicWish
          </Link>

          <div className="flex items-center gap-4">
            <ThemeToggle />

            {user ? (
              <>
                <nav className="hidden md:flex gap-6 mr-4 items-center">
                  <Link href="/search" className={linkClass('/search')}>Recherche</Link> 
                  <Link href="/wishlist" className={linkClass('/wishlist')}>Wishlist</Link>
                  <Link href="/collection" className={linkClass('/collection')}>Collection</Link>
                  <Link href="/trades" className={linkClass('/trades')}>Echanges</Link>
                  <Link href="/contacts" className={`${linkClass('/contacts')} relative flex items-center gap-1`}>
                    Contacts
                    {friendRequestCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                        {friendRequestCount}
                      </span>
                    )}
                  </Link>
                </nav>

                <div className="h-5 w-px bg-border hidden md:block"></div>

                <div className="flex items-center gap-3">
                  {/* AJOUT DU LIEN PARAMÈTRES (Icône engrenage sur desktop) */}
                  <Link 
                    href="/settings"
                    className={`p-2 rounded-full hover:bg-secondary transition-colors ${pathname === '/settings' ? 'text-primary' : 'text-muted hover:text-foreground'}`}
                    title="Paramètres"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.318.674.674.843l1.173.567c.47.228.6.814.242 1.258l-.77.842a1.275 1.275 0 0 0-.291.872v2.146c0 .371.196.702.503.882l.77.452c.364.214.5.659.242 1.082l-1.173 1.296c-.356.394-.85.584-1.332.584h-1.396a1.275 1.275 0 0 0-.872.291l-.842.77c-.444.356-1.03.223-1.258-.242l-.567-1.173a1.275 1.275 0 0 0-.843-.674l-1.28-.213c-.543-.09-.94-.56-.94-1.11V11.23c0-.55.398-1.02.94-1.11l1.28-.213a1.275 1.275 0 0 0 .843-.674l.567-1.173c.228-.47.814-.6.258-.242l.77.842c.307.336.702.503 1.125.503h1.396Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </Link>

                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full bg-surface border border-border object-cover"
                    />
                  )}
                  <button
                    onClick={logOut}
                    className="hidden md:block text-xs font-medium text-danger hover:text-danger/80 transition"
                  >
                    Déconnexion
                  </button>

                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-primary hover:bg-secondary rounded-lg transition-colors"
                  >
                    Menu
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
             <nav className="flex flex-col space-y-3">
               <Link href="/search" className={linkClass('/search')} onClick={() => setIsMenuOpen(false)}>Recherche</Link>
               <Link href="/wishlist" className={linkClass('/wishlist')} onClick={() => setIsMenuOpen(false)}>Wishlist</Link>
               <Link href="/collection" className={linkClass('/collection')} onClick={() => setIsMenuOpen(false)}>Collection</Link>
               <Link href="/trades" className={linkClass('/trades')} onClick={() => setIsMenuOpen(false)}>Echanges</Link>
               <Link href="/contacts" className={linkClass('/contacts')} onClick={() => setIsMenuOpen(false)}>Contacts</Link>
               <Link href="/settings" className={linkClass('/settings')} onClick={() => setIsMenuOpen(false)}>Paramètres</Link> {/* AJOUT MOBILE */}
               <button onClick={() => { logOut(); setIsMenuOpen(false); }} className="text-left py-2 text-danger text-sm font-medium">Déconnexion</button>
             </nav>
          </div>
        )}
      </div>
    </header>
  );
}