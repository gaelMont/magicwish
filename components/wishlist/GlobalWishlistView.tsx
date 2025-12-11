'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { WishlistMeta } from '@/hooks/useWishlists';
import { CardType } from '@/hooks/useCardCollection';
import MagicCard from '@/components/MagicCard';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

type Props = {
    lists: WishlistMeta[];
};

export default function GlobalWishlistView({ lists }: Props) {
    const { user } = useAuth();
    const [allCards, setAllCards] = useState<(CardType & { sourceListName: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || lists.length === 0) return;

        const fetchAll = async () => {
            setLoading(true);
            let combined: (CardType & { sourceListName: string })[] = [];

            try {
                // A. Liste par défaut
                const defaultRef = collection(db, 'users', user.uid, 'wishlist');
                const defaultSnap = await getDocs(defaultRef);
                const defaultCards = defaultSnap.docs.map(d => ({ 
                    ...d.data(), id: d.id, sourceListName: 'Liste principale' 
                })) as (CardType & { sourceListName: string })[];
                combined = [...defaultCards];

                // B. Listes customs
                const customLists = lists.filter(l => l.id !== 'default');
                const promises = customLists.map(async (list) => {
                    const colRef = collection(db, 'users', user.uid, 'wishlists_data', list.id, 'cards');
                    const snap = await getDocs(colRef);
                    return snap.docs.map(d => ({
                        ...d.data(),
                        id: d.id,
                        sourceListName: list.name
                    })) as (CardType & { sourceListName: string })[];
                });

                const results = await Promise.all(promises);
                results.forEach(res => {
                    combined = [...combined, ...res];
                });

                setAllCards(combined);
            } catch (error) {
                console.error("Erreur chargement global", error);
                toast.error("Erreur chargement global");
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [user, lists]);

    const globalTotal = useMemo(() => {
        return allCards.reduce((acc, card) => acc + (card.price || 0) * card.quantity, 0);
    }, [allCards]);

    if (loading) return <div className="p-10 text-center animate-pulse">Fusion des listes en cours...</div>;

    return (
        <div className="animate-in fade-in duration-300">
             <div className="flex justify-between items-end mb-6 border-b pb-4 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 p-4 rounded-t-xl">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        🌍 Vue Globale
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Toutes vos cartes fusionnées ({allCards.length} cartes distinctes)
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-xs text-gray-500 uppercase font-semibold">Valeur Totale</span>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{globalTotal.toFixed(2)} €</p>
                </div>
            </div>

            {allCards.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 italic">Aucune carte trouvée.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {allCards.map((card, idx) => (
                        <div key={`${card.id}-${idx}`} className="relative group">
                            <div className="absolute top-0 right-0 z-30 bg-black/70 text-white text-[10px] px-2 py-1 rounded-bl-lg backdrop-blur-sm pointer-events-none">
                                {card.sourceListName}
                            </div>
                            <MagicCard {...card} isWishlist={false} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}