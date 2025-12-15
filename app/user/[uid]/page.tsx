// app/user/[uid]/page.tsx
'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { FriendProfile } from '@/hooks/useFriends'; 
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { WishlistMeta } from '@/hooks/useWishlists';
import FriendCollectionDisplay from '@/components/user-profile/FriendCollectionDisplay';
import FriendWishlistDisplay from '@/components/user-profile/FriendWishlistDisplay';
import { useAuth } from '@/lib/AuthContext';


export default function UserProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const unwrappedParams = use(params);
  const targetUid = unwrappedParams.uid;
  const { user, loading: authLoading } = useAuth();
  
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'collection' | 'wishlist'>('collection');
  const [wishlistsMeta, setWishlistsMeta] = useState<WishlistMeta[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const { cards: friendCollectionCards, loading: loadingCollection, totalPrice: collectionTotal } = useCardCollection('collection', 'default', targetUid);

  // --- CHARGEMENT DE MES DONNÉES EN ARRIÈRE-PLAN (pour le matching) ---
  const { cards: myWishlistCards, loading: loadingMyWishlist } = useCardCollection('wishlist'); 
  const { cards: myCollectionCards, loading: loadingMyCollection } = useCardCollection('collection'); 

  const myWishlistMap = useMemo(() => {
    if (loadingMyWishlist || !myWishlistCards) return new Map<string, CardType>();
    const map = new Map<string, CardType>();
    myWishlistCards.forEach((c: CardType) => {
        map.set(c.id, c);
        map.set(c.name.toLowerCase(), c);
    });
    return map;
  }, [myWishlistCards, loadingMyWishlist]);

  const myTradeBinderMap = useMemo(() => {
    if (loadingMyCollection || !myCollectionCards) return new Map<string, CardType>();
    const map = new Map<string, CardType>();
    myCollectionCards.forEach((c: CardType) => {
        if ((c.quantityForTrade ?? 0) > 0) {
            map.set(c.id, c);
            map.set(c.name.toLowerCase(), c);
        }
    });
    return map;
  }, [myCollectionCards, loadingMyCollection]);
  // --- FIN CHARGEMENT ---


  // --- HOOKS PERSISTANTS (Tri/Colonnes) ---
  const { columns: colColumns, setColumns: setColColumns } = useColumnPreference(`mw_cols_user_view_collection`, 4); 
  const { sortBy: colSortBy, setSortBy: setColSortBy } = useSortPreference(`mw_sort_user_view_collection`, 'name');
  
  const { columns: wishColumns, setColumns: setWishColumns } = useColumnPreference(`mw_cols_user_view_wishlist`, 4);
  // --- FIN HOOKS PERSISTANTS ---

  
  // Chargement des infos du profil et des métadonnées de wishlist
  useEffect(() => {
    if (authLoading) return;

    const fetchProfileAndMeta = async () => {
      setLoadingMeta(true);
      try {
        const docRef = doc(db, 'users', targetUid, 'public_profile', 'info');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            setProfile({ uid: targetUid, ...snap.data() } as FriendProfile);
        }

        const metaRef = collection(db, 'users', targetUid, 'wishlists_meta');
        const metaSnap = await getDocs(metaRef);
        const fetchedLists = metaSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
        } as WishlistMeta));

        if (!fetchedLists.find(l => l.id === 'default')) {
            fetchedLists.unshift({ id: 'default', name: 'Liste principale' });
        }

        fetchedLists.sort((a, b) => {
            if (a.id === 'default') return -1;
            if (b.id === 'default') return 1;
            return a.name.localeCompare(b.name);
        });
        
        setWishlistsMeta(fetchedLists);

      } catch (e) {
        console.error("Erreur chargement profil/meta", e);
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchProfileAndMeta();
  }, [targetUid, authLoading]);

  const loadingProfile = !profile && !loadingCollection && !loadingMeta;

  if (loadingProfile || authLoading) return <div className="p-10 text-center text-muted">Chargement du profil...</div>;
  if (!user) return <div className="p-10 text-center text-muted">Veuillez vous connecter.</div>;


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
                <p className="text-xs uppercase text-success font-bold mb-1">Valeur estimée</p>
                <p className="text-2xl font-bold text-success">{collectionTotal.toFixed(2)} €</p>
            </div>
        </div>

        {/* TABS (EMOJIS REMOVED) */}
        <div className="flex justify-center mb-8 border-b border-border">
            <button 
                onClick={() => setActiveTab('collection')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'collection' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
            >
                Sa Collection ({friendCollectionCards.length})
            </button>
            <button 
                onClick={() => setActiveTab('wishlist')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                    activeTab === 'wishlist' 
                    ? 'border-purple-600 text-purple-600' 
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
            >
                Sa Wishlist ({wishlistsMeta.length} listes)
            </button>
        </div>

        {/* CONTENU DYNAMIQUE */}
        {activeTab === 'collection' ? (
            <FriendCollectionDisplay 
                cards={friendCollectionCards}
                loading={loadingCollection}
                totalPrice={collectionTotal} 
                columns={colColumns}
                setColumns={setColColumns}
                sortBy={colSortBy}
                setSortBy={setColSortBy}
                targetUid={targetUid}
                myWishlistMap={myWishlistMap}
                myTradeBinderMap={myTradeBinderMap}
            />
        ) : (
            <FriendWishlistDisplay
                targetUid={targetUid}
                columns={wishColumns}
                setColumns={setWishColumns}
                wishlistsMeta={wishlistsMeta}
                myWishlistMap={myWishlistMap} // PASSING THE PROP
                myTradeBinderMap={myTradeBinderMap}
            />
        )}
        
    </main>
  );
}