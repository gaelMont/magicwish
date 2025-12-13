// app/user/[uid]/page.tsx
'use client';

import { useState, useEffect, use } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useCardCollection } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import { FriendProfile } from '@/hooks/useFriends'; 
import ColumnSlider from '@/components/ColumnSlider'; // <--- IMPORT

export default function UserProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const unwrappedParams = use(params);
  const targetUid = unwrappedParams.uid;

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'collection' | 'wishlist'>('collection');
  
  // État local pour le slider
  const [columns, setColumns] = useState(4); // <--- NOUVEAU

  const { cards, loading, totalPrice } = useCardCollection(activeTab, 'default', targetUid);

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

  if (!profile && !loading) return <div className="p-10 text-center text-muted">Profil introuvable ou privé.</div>;

  return (
    <main className="container mx-auto p-4 pb-20">
        
        {/* HEADER PROFIL */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border mb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-surface shadow-md overflow-hidden">
                {profile?.photoURL ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover"/> : profile?.username?.[0]?.toUpperCase()}
            </div>
            
            <div className="text-center md:text-left grow">
                <h1 className="text-3xl font-bold text-foreground mb-1">
                    {profile?.displayName || 'Utilisateur'}
                </h1>
                <p className="text-primary font-medium bg-primary/10 inline-block px-3 py-1 rounded-full text-sm">
                    @{profile?.username}
                </p>
            </div>

            <div className="bg-success/10 px-6 py-4 rounded-xl border border-success/20 text-center">
                <p className="text-xs uppercase text-success font-bold mb-1">Valeur affichée</p>
                <p className="text-2xl font-bold text-success">{totalPrice.toFixed(2)} €</p>
            </div>
        </div>

        {/* TABS */}
        <div className="flex justify-center mb-8 border-b border-border">
            <button 
                onClick={() => setActiveTab('collection')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'collection' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
            >
                📚 Sa Collection
            </button>
            <button 
                onClick={() => setActiveTab('wishlist')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'wishlist' 
                    ? 'border-purple-600 text-purple-600' 
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
            >
                ✨ Sa Wishlist
            </button>
        </div>

        {/* BARRE D'OUTILS D'AFFICHAGE */}
        <div className="flex justify-end mb-4">
            <ColumnSlider columns={columns} setColumns={setColumns} />
        </div>

        {/* GRILLE DE CARTES DYNAMIQUE */}
        {loading ? (
            <p className="text-center p-10 text-muted">Chargement des cartes...</p>
        ) : cards.length === 0 ? (
            <div className="text-center py-16 bg-secondary/30 rounded-xl border-dashed border-2 border-border">
                <p className="text-muted italic">Cette liste est vide.</p>
            </div>
        ) : (
            <div 
                className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ 
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
                }}
            >
                {cards.map(card => (
                    <MagicCard 
                        key={card.id} 
                        {...card} 
                        readOnly={true}
                        returnTo={`/user/${targetUid}`}
                    />
                ))}
            </div>
        )}

    </main>
  );
}