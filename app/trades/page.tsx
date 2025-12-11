// app/trades/page.tsx
'use client';

import { useEffect } from 'react'; // Petit oubli corrigé
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useTradeMatcher } from '@/hooks/useTradeMatcher';
import MagicCard from '@/components/MagicCard';

export default function TradesPage() {
  const { user } = useAuth();
  const { matches, loading, runScan, friendCount, scannedCount } = useTradeMatcher();

  // Protection
  if (!user) return <div className="p-10 text-center">Connectez-vous.</div>;

  return (
    <main className="container mx-auto p-4 max-w-5xl min-h-[80vh]">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                🤝 Centre d'Échanges
            </h1>
            <p className="text-gray-500 text-sm mt-1">
                Trouvez automatiquement vos cartes chez vos amis.
            </p>
          </div>
          
          {/* BOUTON D'ACTION */}
          <button 
            onClick={runScan}
            disabled={loading || friendCount === 0}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
                <>
                   <span className="animate-spin">🔄</span> Analyse en cours ({scannedCount}/{friendCount})
                </>
            ) : (
                <>🚀 Lancer l'analyse des stocks</>
            )}
          </button>
      </div>

      {/* ETAT INITIAL : Si pas encore lancé et pas de résultats */}
      {!loading && matches.length === 0 && (
          <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
             {friendCount === 0 ? (
                 <>
                    <p className="text-xl text-gray-500 mb-2">Vous n'avez pas encore d'amis.</p>
                    <Link href="/contacts" className="text-blue-600 underline hover:text-blue-800">Ajouter des contacts</Link>
                 </>
             ) : (
                 <>
                    <p className="text-xl text-gray-800 dark:text-white font-bold mb-2">Prêt à scanner ?</p>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Nous allons comparer votre Wishlist (toutes listes confondues) avec la Collection de vos <span className="font-bold">{friendCount} amis</span>.
                    </p>
                 </>
             )}
          </div>
      )}

      {/* RÉSULTATS */}
      <div className="space-y-6">
          {matches.map((match) => (
              <div key={match.card.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-6 animate-in fade-in slide-in-from-bottom-2">
                  
                  {/* Gauche : La Carte voulue */}
                  <div className="flex-none w-32 mx-auto sm:mx-0">
                      <div className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md">
                         <img src={match.card.imageUrl} alt={match.card.name} className="w-full h-full object-cover" />
                      </div>
                  </div>

                  {/* Droite : Les infos et Qui l'a */}
                  <div className="flex-grow flex flex-col justify-center text-center sm:text-left">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{match.card.name}</h3>
                      <p className="text-sm text-blue-500 font-medium mb-4">{match.card.setName} — {match.card.price ? match.card.price + ' €' : 'N/A'}</p>
                      
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
                          <p className="text-xs uppercase text-green-700 dark:text-green-400 font-bold mb-3 flex items-center gap-2 justify-center sm:justify-start">
                             ✅ Disponible chez :
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                              {match.owners.map(owner => (
                                  <Link 
                                    key={owner.uid} 
                                    href={`/user/${owner.uid}`}
                                    className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full shadow-sm border border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:text-blue-600 transition group"
                                  >
                                      <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden text-[10px] flex items-center justify-center">
                                          {owner.photoURL ? <img src={owner.photoURL} className="w-full h-full object-cover" /> : owner.username[0]}
                                      </div>
                                      <span className="font-bold text-sm">@{owner.username}</span>
                                      <span className="text-xs text-gray-400 group-hover:text-blue-400">→</span>
                                  </Link>
                              ))}
                          </div>
                      </div>
                  </div>

              </div>
          ))}
      </div>
    </main>
  );
}