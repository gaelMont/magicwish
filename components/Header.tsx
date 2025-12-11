'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { usePathname } from 'next/navigation';

export default function Header() {
  const { user, logOut, friendRequestCount } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const linkClass = (path: string) => `
    font-medium transition-colors block py-2 md:py-0
    ${pathname === path 
      ? 'text-blue-600 dark:text-blue-400 font-bold' 
      : 'text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400'}
  `;

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm sticky top-0 z-40">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          <Link 
            href="/" 
            className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-80 transition"
            onClick={() => setIsMenuOpen(false)}
          >
            MagicWish
          </Link>

          <div className="flex items-center gap-4">
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
                      <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {friendRequestCount}
                      </span>
                    )}
                  </Link>
                </nav>

                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden md:block"></div>

                <div className="flex items-center gap-3">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full border border-gray-300"
                      title={user.displayName || ''}
                    />
                  )}
                  <button
                    onClick={logOut}
                    className="hidden md:block text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1 rounded transition"
                  >
                    Deconnexion
                  </button>

                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg focus:outline-none"
                  >
                    Menu
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
        
        {user && isMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 duration-200">
             <nav className="flex flex-col space-y-2">
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
               <Link href="/contacts" className={`${linkClass('/contacts')} flex items-center justify-between`} onClick={() => setIsMenuOpen(false)}>
                 <span>Contacts</span>
                 {friendRequestCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {friendRequestCount}
                    </span>
                 )}
               </Link>
               <button 
                 onClick={() => { logOut(); setIsMenuOpen(false); }}
                 className="text-left py-2 text-red-600 font-medium hover:bg-red-50 dark:hover:bg-red-900/10 rounded"
               >
                 Deconnexion
               </button>
             </nav>
          </div>
        )}
      </div>
    </header>
  );
}