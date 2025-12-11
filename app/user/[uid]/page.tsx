// app/user/[uid]/page.tsx
'use client';

import { useState, useEffect, use } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useCardCollection } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import { FriendProfile } from '@/hooks/useFriends'; // Réutilisation du type

export default function UserProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  // En Next.js 15+, params est une Promise
  const unwrappedParams = use(params);
  const targetUid = unwrappedParams.uid;

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'collection' | 'wishlist'>('collection');
  
  // On utilise notre hook modifié avec le targetUid !
  const { cards, loading, totalPrice } = useCardCollection(activeTab, 'default', targetUid);

  // Charger les infos du profil (Nom, Avatar)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', targetUid, 'public_profile', 'info');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            setProfile({ uid: targetUid, ...snap.data() } as FriendProfile);
        }
      } catch (e) {
        console.error("Erreur profil", e);
      }
    };
    fetchProfile();
  }, [targetUid]);

  if (!profile && !loading) return <div className="p-10 text-center">Profil introuvable ou privé.</div>;

  return (
    <main className="container mx-auto p-4 pb-20">
        
        {/* HEADER PROFIL */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-gray-700 shadow-md overflow-hidden">
                {profile?.photoURL ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover"/> : profile?.username?.[0]?.toUpperCase()}
            </div>
            
            {/* Infos */}
            <div className="text-center md:text-left flex-grow">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    {profile?.displayName || 'Utilisateur'}
                </h1>
                <p className="text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/30 inline-block px-3 py-1 rounded-full text-sm">
                    @{profile?.username}
                </p>
            </div>

            {/* Stats Valeur */}
            <div className="bg-green-50 dark:bg-green-900/20 px-6 py-4 rounded-xl border border-green-100 dark:border-green-800 text-center">
                <p className="text-xs uppercase text-green-600 dark:text-green-400 font-bold mb-1">Valeur affichée</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalPrice.toFixed(2)} €</p>
            </div>
        </div>

        {/* TABS (Collection vs Wishlist) */}
        <div className="flex justify-center mb-8 border-b border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => setActiveTab('collection')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'collection' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                📚 Sa Collection
            </button>
            <button 
                onClick={() => setActiveTab('wishlist')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'wishlist' 
                    ? 'border-purple-600 text-purple-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                ✨ Sa Wishlist
            </button>
        </div>

        {/* GRILLE DE CARTES */}
        {loading ? (
            <p className="text-center p-10 text-gray-500">Chargement des cartes...</p>
        ) : cards.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-dashed border-2 border-gray-200 dark:border-gray-700">
                <p className="text-gray-400 italic">Cette liste est vide.</p>
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {cards.map(card => (
                    <MagicCard 
                        key={card.id} 
                        {...card} 
                        readOnly={true} // <--- Important : Mode lecture seule
                    />
                ))}
            </div>
        )}

    </main>
  );
}