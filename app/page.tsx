'use client';

import { useAuth } from '@/lib/AuthContext';
import { useCardCollection } from '@/hooks/useCardCollection';
import { useTradeSystem } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { CardType } from '@/hooks/useCardCollection';

export default function DashboardPage() {
  const { user, loading: authLoading, friendRequestCount, username } = useAuth();
  const { totalPrice, cards } = useCardCollection('collection'); // Pour la valeur totale et stats
  const { incomingTrades, outgoingTrades } = useTradeSystem(); // Pour les notifs d'échange
  
  const [recentCards, setRecentCards] = useState<CardType[]>([]);

  // Charger les 5 dernières cartes ajoutées (Optimisation : requête dédiée)
  useEffect(() => {
    const fetchRecent = async () => {
      if (!user) return;
      try {
        const q = query(
            collection(db, 'users', user.uid, 'collection'), 
            orderBy('addedAt', 'desc'), 
            limit(5)
        );
        const snap = await getDocs(q);
        setRecentCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as CardType)));
      } catch (e) { console.error(e); }
    };
    fetchRecent();
  }, [user]);

  if (authLoading) return <div className="flex h-screen items-center justify-center animate-pulse">Chargement MagicWish...</div>;

  // Si pas connecté, Landing Page simple
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
          MagicWish
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-lg mb-8">
          Gérez votre collection Magic: The Gathering, créez vos wishlists et trouvez automatiquement des échanges avec vos amis.
        </p>
        <Link 
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition transform hover:scale-105"
        >
          Commencer maintenant
        </Link>
      </div>
    );
  }

  // --- DASHBOARD CONNECTÉ ---
  return (
    <main className="container mx-auto p-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Bonjour, <span className="text-blue-600">{username || user.displayName}</span> 👋
        </h1>
        <p className="text-gray-500">Voici ce qui se passe sur votre compte.</p>
      </div>

      {/* 1. BLOCS DE STATUTS (Alertes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        
        {/* CARTE : ÉCHANGES */}
        <Link href="/trades" className={`p-6 rounded-2xl border transition shadow-sm hover:shadow-md ${incomingTrades.length > 0 ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">🤝</span>
                {incomingTrades.length > 0 && <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">{incomingTrades.length} Attente</span>}
            </div>
            <h3 className="font-bold text-lg mb-1">Échanges</h3>
            <p className="text-sm text-gray-500">
                {incomingTrades.length > 0 
                    ? "Vous avez des propositions à valider !" 
                    : `${outgoingTrades.length} propositions envoyées.`}
            </p>
        </Link>

        {/* CARTE : AMIS */}
        <Link href="/contacts" className={`p-6 rounded-2xl border transition shadow-sm hover:shadow-md ${friendRequestCount > 0 ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">👥</span>
                {friendRequestCount > 0 && <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">{friendRequestCount} Reçues</span>}
            </div>
            <h3 className="font-bold text-lg mb-1">Contacts</h3>
            <p className="text-sm text-gray-500">
                {friendRequestCount > 0 
                    ? "De nouveaux joueurs veulent vous ajouter." 
                    : "Gérez votre liste d'amis."}
            </p>
        </Link>

        {/* CARTE : VALEUR */}
        <Link href="/collection" className="p-6 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition shadow-sm hover:shadow-md group">
            <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">📈</span>
                <span className="text-green-600 font-bold bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded text-xs">Total</span>
            </div>
            <h3 className="font-bold text-lg mb-1">{totalPrice.toFixed(2)} €</h3>
            <p className="text-sm text-gray-500 group-hover:text-blue-500 transition-colors">
                Valeur estimée de vos {cards.length} cartes.
            </p>
        </Link>
      </div>

      {/* 2. DERNIERS AJOUTS & ACTIONS RAPIDES */}
      <div className="grid lg:grid-cols-3 gap-8">
          
          {/* COLONNE GAUCHE : Derniers ajouts */}
          <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">Derniers ajouts</h2>
                  <Link href="/collection" className="text-sm text-blue-600 hover:underline">Tout voir</Link>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  {recentCards.length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                          Pas encore de cartes ? <Link href="/collection" className="text-blue-500 underline">Importez-en !</Link>
                      </div>
                  ) : (
                      recentCards.map((card) => (
                          <div key={card.id} className="flex items-center gap-4 p-3 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                              <div className="w-10 h-14 bg-gray-200 rounded overflow-hidden shrink-0">
                                  <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="flex-grow">
                                  <p className="font-bold text-sm text-gray-900 dark:text-white">{card.name}</p>
                                  <p className="text-xs text-gray-500">{card.setName} {card.isFoil && '✨ Foil'}</p>
                              </div>
                              <div className="text-right">
                                  <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">{(card.customPrice ?? card.price ?? 0).toFixed(2)} €</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* COLONNE DROITE : Actions */}
          <div className="space-y-6">
              
              {/* Box Raccourcis */}
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                  <h3 className="font-bold text-lg mb-2">Action Rapide</h3>
                  {/* CORRECTION ICI : &apos; */}
                  <p className="text-white/80 text-sm mb-6">Vous revenez de tournoi ou d&apos;ouverture de boosters ?</p>
                  
                  <Link href="/collection" className="block w-full bg-white text-blue-600 font-bold text-center py-3 rounded-lg hover:bg-gray-50 transition shadow-sm">
                      + Ajouter des cartes
                  </Link>
                  <Link href="/trades/manual" className="block w-full mt-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-center py-3 rounded-lg border border-blue-500 transition">
                      🖐️ Échange Manuel
                  </Link>
              </div>

              {/* Box Wishlist Suggestion (Statique pour l'instant) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">Astuce 💡</h3>
                  <p className="text-sm text-gray-500 mb-4">
                      Remplissez votre Wishlist pour permettre au scanner de trouver des échanges automatiquement avec vos amis.
                  </p>
                  <Link href="/wishlist" className="text-sm font-bold text-purple-600 hover:text-purple-700">
                      Gérer ma Wishlist →
                  </Link>
              </div>

          </div>
      </div>
    </main>
  );
}