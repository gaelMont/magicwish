// components/AdContainer.tsx
'use client';
import { usePremium } from '@/hooks/usePremium';
import Link from 'next/link';

export default function AdContainer() {
  const { isPremium, loading } = usePremium();

  if (loading || isPremium) return null;

  return (
    <div className="w-full my-4 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        
        {/* Placeholder pour AdSense / Bannière */}
        <div className="w-full max-w-[300px] h-[250px] bg-white dark:bg-black border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 text-sm overflow-hidden">
            <span className="text-2xl">📢</span>
            <p>Espace Publicitaire</p>
        </div>
        
        <p className="text-[10px] text-gray-500 mt-3 uppercase tracking-wide">
            Supportez MagicWish - <Link href="/premium" className="underline hover:text-blue-500 font-bold">Retirer la pub (1€)</Link>
        </p>
    </div>
  );
}