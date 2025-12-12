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
      ? 'text-blue-600 dark:text-blue-400 font-bold' 
      : 'text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-300'}
  `;

  return (
    <header className="bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-40">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          {/* LOGO : Sobre et Clean */}
          <Link 
            href="/" 
            className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white hover:opacity-70 transition"
            onClick={() => setIsMenuOpen(false)}
          >
            MagicWish
          </Link>

          <div className="flex items-center gap-4">
            
            <ThemeToggle />

            {user ? (
              <>
                {/* MENU DESKTOP */}
                <nav className="hidden md:flex gap-6 mr-4 items-center">
                  <Link href="/search" className={linkClass('/search')}>Recherche</Link> 
                  <Link href="/wishlist" className={linkClass('/wishlist')}>Wishlist</Link>
                  <Link href="/collection" className={linkClass('/collection')}>Collection</Link>
                  <Link href="/trades" className={linkClass('/trades')}>Echanges</Link>
                  <Link href="/contacts" className={`${linkClass('/contacts')} relative flex items-center gap-1`}>
                    Contacts
                    {friendRequestCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                        {friendRequestCount}
                      </span>
                    )}
                  </Link>
                </nav>

                <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700 hidden md:block"></div>

                {/* USER & LOGOUT */}
                <div className="flex items-center gap-3">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 object-cover border border-zinc-200 dark:border-zinc-700"
                      title={user.displayName || ''}
                    />
                  )}
                  <button
                    onClick={logOut}
                    className="hidden md:block text-xs font-medium text-zinc-500 hover:text-red-600 transition"
                  >
                    Déconnexion
                  </button>

                  {/* BURGER MOBILE */}
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              // BOUTON LOGIN
              <Link
                href="/login"
                className="bg-zinc-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
        
        {/* MENU MOBILE DÉROULANT */}
        {user && isMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-2 duration-200">
             <nav className="flex flex-col space-y-3">
               <Link href="/search" className={linkClass('/search')} onClick={() => setIsMenuOpen(false)}>
                 Recherche
               </Link>
               <Link href="/wishlist" className={linkClass('/wishlist')} onClick={() => setIsMenuOpen(false)}>
                 Wishlist
               </Link>
               <Link href="/collection" className={linkClass('/collection')} onClick={() => setIsMenuOpen(false)}>
                 Collection
               </Link>
               <Link href="/trades" className={linkClass('/trades')} onClick={() => setIsMenuOpen(false)}>
                 Echanges
               </Link>
               <Link href="/contacts" className={linkClass('/contacts')} onClick={() => setIsMenuOpen(false)}>
                 <span>Contacts</span>
                 {friendRequestCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                        {friendRequestCount}
                    </span>
                 )}
               </Link>
               <button 
                 onClick={() => { logOut(); setIsMenuOpen(false); }}
                 className="text-left py-2 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 rounded"
               >
                 Déconnexion
               </button>
             </nav>
          </div>
        )}
      </div>
    </header>
  );
}