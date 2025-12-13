'use client';

import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { useTradeSystem } from '@/hooks/useTradeSystem';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export default function DashboardPage() {
  const { user, loading: authLoading, friendRequestCount, username } = useAuth();
  const { totalPrice, cards } = useCardCollection('collection'); 
  const { incomingTrades, outgoingTrades } = useTradeSystem(); 
  
  const [recentCards, setRecentCards] = useState<CardType[]>([]);

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

  if (authLoading) return <div className="flex h-screen items-center justify-center animate-pulse text-primary">Chargement...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
        <h1 className="text-5xl font-black text-primary mb-6 tracking-tight">
          MagicWish
        </h1>
        <p className="text-xl text-muted max-w-lg mb-8">
          Gérez votre collection, vos wishlists et vos échanges en toute simplicité.
        </p>
        <Link 
          href="/login"
          className="btn-primary py-3 px-8 rounded-full text-lg shadow-lg transition transform hover:scale-105"
        >
          Commencer maintenant
        </Link>
      </div>
    );
  }

  // Styles centralisés utilisant les variables sémantiques (bg-surface, border-border)
  const cardStyle = "p-6 rounded-2xl border border-border transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-1 group bg-surface hover:border-primary";

  return (
    <main className="container mx-auto p-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Bonjour, <span className="text-primary">{username || user.displayName}</span>
        </h1>
        <p className="text-muted">Tableau de bord</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        
        {/* CARTE ECHANGES */}
        <Link href="/trades" className={`${cardStyle} 
            ${incomingTrades.length > 0 ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-800' : ''}`}>
            <div className="flex justify-between items-start mb-2">
                <span className={`font-bold text-lg group-hover:text-primary transition-colors ${incomingTrades.length > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-foreground'}`}>
                    Échanges
                </span>
                {incomingTrades.length > 0 && <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">{incomingTrades.length}</span>}
            </div>
            <p className="text-sm text-muted group-hover:text-foreground">
                {incomingTrades.length > 0 ? "Propositions en attente !" : `${outgoingTrades.length} propositions en cours.`}
            </p>
        </Link>

        {/* CARTE CONTACTS */}
        <Link href="/contacts" className={`${cardStyle} ${friendRequestCount > 0 ? 'bg-primary/5 border-primary/30' : ''}`}>
            <div className="flex justify-between items-start mb-2">
                <span className={`font-bold text-lg group-hover:text-primary transition-colors ${friendRequestCount > 0 ? 'text-primary' : 'text-foreground'}`}>
                    Contacts
                </span>
                {friendRequestCount > 0 && <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">{friendRequestCount}</span>}
            </div>
            <p className="text-sm text-muted group-hover:text-foreground">
                {friendRequestCount > 0 ? "Nouvelles demandes d'amis." : "Gérer ma liste d'amis."}
            </p>
        </Link>

        {/* CARTE TOTAL */}
        <Link href="/collection" className={cardStyle}>
            <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">Total</span>
                <span className="text-success font-bold bg-success/10 px-2 py-1 rounded text-xs">{totalPrice.toFixed(2)} €</span>
            </div>
            <p className="text-sm text-muted group-hover:text-foreground">
                {cards.length} cartes collectionnées.
            </p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
          {/* LISTE RÉCENTS */}
          <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg text-foreground">Derniers ajouts</h2>
                  <Link href="/collection" className="text-sm text-primary hover:underline font-medium">Tout voir</Link>
              </div>
              
              <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
                  {recentCards.length === 0 ? (
                      <div className="p-8 text-center text-muted">
                          Pas encore de cartes ? <Link href="/collection" className="text-primary underline">Importez-en !</Link>
                      </div>
                  ) : (
                      recentCards.map((card) => (
                          <div key={card.id} className="flex items-center gap-4 p-3 border-b border-border last:border-0 hover:bg-secondary/50 transition">
                              <div className="w-10 h-14 bg-secondary rounded overflow-hidden shrink-0">
                                  <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div className="grow">
                                  <p className="font-semibold text-sm text-foreground">{card.name}</p>
                                  <p className="text-xs text-muted">{card.setName} {card.isFoil && <span className="text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-1 rounded text-[9px] font-bold">Foil</span>}</p>
                              </div>
                              <div className="text-right">
                                  <span className="font-medium text-foreground text-sm">{(card.customPrice ?? card.price ?? 0).toFixed(2)} €</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* ACTION RAPIDE */}
          <div className="space-y-6">
              <div className="bg-primary rounded-xl p-6 text-primary-foreground shadow-lg shadow-primary/20">
                  <h3 className="font-bold text-lg mb-2">Action Rapide</h3>
                  <p className="text-primary-foreground/80 text-sm mb-6">Ajout rapide après ouverture de boosters ?</p>
                  
                  <Link href="/search" className="block w-full bg-surface text-primary font-bold text-center py-3 rounded-lg hover:bg-secondary transition shadow-sm mb-3">
                      Ajouter des cartes
                  </Link>
                  <Link href="/trades/manual" className="block w-full bg-black/20 hover:bg-black/30 text-white font-bold text-center py-3 rounded-lg transition border border-white/10">
                      Échange Manuel
                  </Link>
              </div>

              {/* ASTUCE */}
              <div className="bg-surface rounded-xl border-l-4 border-primary shadow-sm p-6 border-y border-r border-border">
                  <h3 className="font-bold text-foreground mb-2">Astuce</h3>
                  <p className="text-sm text-muted mb-4">
                      Remplissez votre Wishlist pour aider le scanner à trouver des échanges.
                  </p>
                  <Link href="/wishlist" className="text-sm font-bold text-primary hover:underline">
                      Gérer ma Wishlist
                  </Link>
              </div>
          </div>
      </div>
    </main>
  );
}