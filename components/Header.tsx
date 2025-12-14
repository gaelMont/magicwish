'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const { user, friendRequestCount } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const linkClass = (path: string) => `
    text-sm font-medium transition-colors block py-2 md:py-0
    ${pathname === path 
      ? 'text-primary font-bold' 
      : 'text-muted hover:text-foreground'}
  `;

  const isSocialActive = ['/contacts', '/groups', '/stats'].includes(pathname);

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
            <ThemeToggle />

            {user ? (
              <>
                {/* NAVIGATION DESKTOP */}
                <nav className="hidden md:flex gap-6 mr-4 items-center">
                  <Link href="/search" className={linkClass('/search')}>Recherche</Link> 
                  <Link href="/wishlist" className={linkClass('/wishlist')}>Wishlist</Link>
                  <Link href="/collection" className={linkClass('/collection')}>Collection</Link>
                  <Link href="/trades" className={linkClass('/trades')}>Echanges</Link>
                  
                  {/* DROPDOWN SOCIAL */}
                  <div className="relative group">
                    <button className={`text-sm font-medium transition-colors flex items-center gap-1 ${isSocialActive ? 'text-primary font-bold' : 'text-muted hover:text-foreground'}`}>
                      Social
                      {friendRequestCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                          {friendRequestCount}
                        </span>
                      )}
                      <span className="text-[10px] transform group-hover:rotate-180 transition-transform">▼</span>
                    </button>
                    
                    <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                      <div className="py-1">
                        <Link href="/stats" className="px-4 py-2 text-sm text-foreground hover:bg-secondary transition justify-between items-center">
                           Panthéon
                        </Link>
                        <div className="border-t border-border my-1"></div>
                        <Link href="/contacts" className="px-4 py-2 text-sm text-foreground hover:bg-secondary transition justify-between items-center">
                          Mes Contacts
                          {friendRequestCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {friendRequestCount}
                            </span>
                          )}
                        </Link>
                        <Link href="/groups" className="block px-4 py-2 text-sm text-foreground hover:bg-secondary transition">
                          Mes Playgroups
                        </Link>
                      </div>
                    </div>
                  </div>

                  <Link 
                    href="/settings"
                    className={linkClass('/settings')}
                  >
                    Paramètres
                  </Link>
                </nav>

                <div className="h-5 w-px bg-border hidden md:block"></div>

                <div className="flex items-center gap-3">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full bg-secondary border border-border object-cover"
                    />
                  )}
                  
                  {/* Bouton Menu Mobile */}
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-foreground hover:bg-secondary rounded-lg"
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
               
               <div className="pt-2 pb-2 border-y border-border/50">
                 <p className="text-xs text-muted font-bold uppercase mb-2 ml-4">Social</p>
                 
                 <Link href="/stats" className={`${linkClass('/stats')} pl-4 mb-2 flex items-center gap-2`} onClick={() => setIsMenuOpen(false)}>
                    Panthéon
                 </Link>
                 
                 <Link href="/contacts" className={`${linkClass('/contacts')} pl-4 mb-2 flex items-center gap-2`} onClick={() => setIsMenuOpen(false)}>
                    Contacts 
                    {friendRequestCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {friendRequestCount}
                        </span>
                    )}
                 </Link>
                 
                 <Link href="/groups" className={`${linkClass('/groups')} pl-4`} onClick={() => setIsMenuOpen(false)}>
                    Mes Playgroups
                 </Link>
               </div>

               <Link href="/settings" className={linkClass('/settings')} onClick={() => setIsMenuOpen(false)}>Paramètres</Link>
             </nav>
          </div>
        )}
      </div>
    </header>
  );
}