// components/Header.tsx
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
                    ⚙️
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
               <Link href="/settings" className={linkClass('/settings')} onClick={() => setIsMenuOpen(false)}>Paramètres</Link> {/* LIEN PARAMÈTRES MOBILE */}
               <button onClick={() => { logOut(); setIsMenuOpen(false); }} className="text-left py-2 text-danger text-sm font-medium">Déconnexion</button>
             </nav>
          </div>
        )}
      </div>
    </header>
  );
}