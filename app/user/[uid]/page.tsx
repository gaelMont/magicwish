// app/user/[uid]/page.tsx
'use client';

import { useState, use, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCardCollection, CardType } from '@/hooks/useCardCollection';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { WishlistMeta } from '@/hooks/useWishlists';
import { useColumnPreference } from '@/hooks/useColumnPreference';
import { useSortPreference, SortOption } from '@/hooks/useSortPreference';
import Image from 'next/image';

// Composants
import FriendCollectionDisplay from '@/components/user-profile/FriendCollectionDisplay';
import FriendWishlistDisplay from '@/components/user-profile/FriendWishlistDisplay';

type UserProfile = {
    username: string;
    displayName: string;
    photoURL?: string;
    bio?: string;
};

export default function UserProfilePage({ params }: { params: Promise<{ uid: string }> }) {
    const unwrappedParams = use(params);
    const targetUid = unwrappedParams.uid;
    const { user, loading: authLoading } = useAuth();

    // --- CHARGEMENT DONNÉES AMI ---
    const { cards: friendCollectionCards, loading: loadingCollection, totalPrice: collectionTotal } = useCardCollection('collection', 'default', targetUid);
    
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [wishlistsMeta, setWishlistsMeta] = useState<WishlistMeta[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(true);
    
    // --- ÉTATS UI ---
    const [activeTab, setActiveTab] = useState<'collection' | 'wishlist'>('collection');
    
    // --- CHARGEMENT DONNÉES PERSO (Pour le matching) ---
    const { cards: myWishlistCards } = useCardCollection('wishlist', 'default', user?.uid);
    const { cards: myTradeCards } = useCardCollection('collection', 'default', user?.uid);

    const myWishlistMap = useMemo(() => {
        const map = new Map<string, CardType>();
        myWishlistCards.forEach(c => {
            map.set(c.id, c);
            if (!c.isSpecificVersion) map.set(c.name.toLowerCase(), c);
        });
        return map;
    }, [myWishlistCards]);

    const myTradeBinderMap = useMemo(() => {
        const map = new Map<string, CardType>();
        myTradeCards.filter(c => (c.quantityForTrade || 0) > 0).forEach(c => {
            map.set(c.id, c);
            if (!c.isSpecificVersion) map.set(c.name.toLowerCase(), c);
        });
        return map;
    }, [myTradeCards]);

    // --- PRÉFÉRENCES UTILISATEUR ---
    const { columns: colColumns, setColumns: setColColumns } = useColumnPreference('mw_cols_friend_col', 5);
    const { columns: wishColumns, setColumns: setWishColumns } = useColumnPreference('mw_cols_friend_wish', 5);
    const { sortBy: colSortBy, setSortBy: setColSortBy } = useSortPreference('mw_sort_friend_col', 'date_desc' as SortOption);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!targetUid) return;
            try {
                const profileSnap = await getDoc(doc(db, 'users', targetUid, 'public_profile', 'info'));
                if (profileSnap.exists()) setProfile(profileSnap.data() as UserProfile);
            } catch (e) {
                console.error("Erreur profil", e);
            }
        };
        fetchProfile();
    }, [targetUid]);

    useEffect(() => {
        if (!targetUid) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingMeta(true);
        const unsubscribe = onSnapshot(collection(db, 'users', targetUid, 'wishlists_meta'), (snapshot) => {
            const fetchedLists = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WishlistMeta));
            if (!fetchedLists.find(l => l.id === 'default')) fetchedLists.unshift({ id: 'default', name: 'Liste principale' });
            fetchedLists.sort((a, b) => a.id === 'default' ? -1 : b.id === 'default' ? 1 : a.name.localeCompare(b.name));
            setWishlistsMeta(fetchedLists);
            setLoadingMeta(false);
        }, (error) => {
            console.error("Erreur meta", error);
            setLoadingMeta(false);
        });
        return () => unsubscribe();
    }, [targetUid]);

    if (!profile && loadingCollection && loadingMeta || authLoading) return <div className="p-10 text-center text-muted font-bold animate-pulse uppercase text-xs">Chargement du profil...</div>;
    if (!user) return <div className="p-10 text-center text-muted font-bold uppercase text-xs">Veuillez vous connecter.</div>;

    return (
        <main className="container mx-auto p-4 pb-20">
            <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border mb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-black border-4 border-surface shadow-md overflow-hidden relative">
                    {profile?.photoURL ? <Image src={profile.photoURL} alt="Avatar" fill className="object-cover" sizes="96px" /> : profile?.username?.[0]?.toUpperCase()}
                </div>
                <div className="text-center md:text-left grow">
                    <h1 className="text-3xl font-black text-foreground mb-1 uppercase tracking-tighter">{profile?.displayName || 'Utilisateur'}</h1>
                    <p className="text-primary font-black bg-primary/10 inline-block px-3 py-1 rounded-lg text-xs uppercase tracking-widest">@{profile?.username}</p>
                </div>
                <div className="bg-success/10 px-6 py-4 rounded-2xl border border-success/20 text-center shadow-sm">
                    <p className="text-[10px] uppercase text-success font-black mb-1 tracking-widest">Valeur Collection</p>
                    <p className="text-2xl font-black text-success">{collectionTotal.toFixed(2)} €</p>
                </div>
            </div>

            <div className="flex justify-center mb-8 border-b border-border">
                <button onClick={() => setActiveTab('collection')} className={`px-6 py-3 font-black text-xs uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'collection' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
                    Collection ({friendCollectionCards.length})
                </button>
                <button onClick={() => setActiveTab('wishlist')} className={`px-6 py-3 font-black text-xs uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'wishlist' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
                    Wishlist ({wishlistsMeta.length})
                </button>
            </div>

            {activeTab === 'collection' ? (
                <FriendCollectionDisplay cards={friendCollectionCards} loading={loadingCollection} totalPrice={collectionTotal} columns={colColumns} setColumns={setColColumns} sortBy={colSortBy} setSortBy={setColSortBy} targetUid={targetUid} myWishlistMap={myWishlistMap} myTradeBinderMap={myTradeBinderMap} />
            ) : (
                <FriendWishlistDisplay targetUid={targetUid} columns={wishColumns} setColumns={setWishColumns} wishlistsMeta={wishlistsMeta} myWishlistMap={myWishlistMap} myTradeBinderMap={myTradeBinderMap} />
            )}
        </main>
    );
}