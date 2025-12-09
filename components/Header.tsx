// components/Header.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

export default function Header() {
  const { user, logOut } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:opacity-80">
          ✨ MagicWish
        </Link>

        <div>
          {user ? (
            <div className="flex items-center gap-4">
              {/* LIEN WISHLIST AJOUTÉ ICI */}
              <Link 
                href="/wishlist" 
                className="font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Ma Wishlist
              </Link>

              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden md:block"></div>

              {/* Avatar */}
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
                className="text-sm bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded hover:opacity-80 transition"
              >
                Déconnexion
              </button>
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
    </header>
  );
}