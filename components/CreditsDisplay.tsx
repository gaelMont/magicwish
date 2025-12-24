// components/CreditsDisplay.tsx
'use client';

import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import { useMemo } from 'react';

export function CreditsDisplay() {
  const { user, userProfile, loading } = useAuth();

  // CORRECTION : On calcule la valeur directement au lieu d'utiliser un useEffect + useState.
  // useMemo permet de ne recalculer que si userProfile change.
  const displayCredits = useMemo(() => {
    if (!userProfile) return 0;

    // Si Premium, on ne se soucie pas des crédits (mais la logique d'affichage est gérée plus bas)
    if (userProfile.isPremium) return 9999;

    const todayStr = new Date().toISOString().split('T')[0];
    const lastReset = userProfile.lastCreditReset;
    
    // Logique d'affichage simulée :
    // Si la date de reset n'est pas aujourd'hui, on affiche 5 (car ils seront reset à la prochaine action)
    if (lastReset !== todayStr) {
      return 5; // Valeur par défaut
    }
    
    return userProfile.dailyCredits ?? 0;
  }, [userProfile]);

  if (loading || !user) return null;

  // Affichage Premium
  if (userProfile?.isPremium) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-linear-to-r from-yellow-400/10 to-amber-500/10 border border-amber-200 rounded-full">
        <span className="text-amber-600 font-bold text-xs tracking-wider uppercase">Premium</span>
      </div>
    );
  }

  // Version Gratuite
  return (
    <Link href="/pricing" className="group">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full transition-colors cursor-pointer">
        <div className="flex flex-col items-end leading-none">
          <span className="text-xs font-semibold text-slate-700">
            {displayCredits} Crédits
          </span>
          <span className="text-[10px] text-slate-500 group-hover:text-blue-600">
            Recharger
          </span>
        </div>
        {/* Petit indicateur visuel */}
        <div className="w-2 h-2 rounded-full bg-blue-500 relative">
          {displayCredits === 0 && (
            <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </Link>
  );
}