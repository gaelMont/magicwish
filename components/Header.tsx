// components/Header.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { usePathname } from 'next/navigation'; // Pour savoir sur quelle page on est

export default function Header() {
  const { user, logOut } = useAuth();
  const pathname = usePathname();

  // Petite fonction pour styliser le lien actif
  const linkClass = (path: string) => `
    font-medium transition-colors 
    ${pathname === path 
      ? 'text-blue-600 dark:text-blue-400 font-bold' 
      : 'text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400'}
  `;

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm sticky top-0 z-40">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-80 transition">
          ✨ MagicWish
        </Link>

        <div>
          {user ? (
            <div className="flex items-center gap-6">
              {/* Navigation */}
              <nav className="hidden md:flex gap-6 mr-4">
                <Link href="/" className={linkClass('/')}>Recherche</Link>
                <Link href="/wishlist" className={linkClass('/wishlist')}>Ma Wishlist</Link>
                <Link href="/collection" className={linkClass('/collection')}>Ma Collection</Link>
              </nav>

              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden md:block"></div>

              {/* Avatar + Logout */}
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
                  className="text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1 rounded transition"
                >
                  Déconnexion
                </button>
              </div>
            </div>
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
      
      {/* Menu Mobile (visible uniquement sur petits écrans) */}
      {user && (
        <div className="md:hidden flex justify-around mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-sm">
           <Link href="/" className={linkClass('/')}>Recherche</Link>
           <Link href="/wishlist" className={linkClass('/wishlist')}>Wishlist</Link>
           <Link href="/collection" className={linkClass('/collection')}>Collection</Link>
        </div>
      )}
    </header>
  );
}