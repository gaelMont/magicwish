'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { collection, getDocs, query, where, doc, getDoc, documentId } from 'firebase/firestore';
import { useFriends } from '@/hooks/useFriends';
import Image from 'next/image';

// --- TYPES STRICTS ---

type StatProfile = {
    uid: string;
    displayName: string;
    username: string;
    photoURL: string | null;
    totalValue: number;
    totalCards: number;
    uniqueCards: number;
    foilCount: number;
    avgPrice: number;
};

type GroupOption = {
    id: string;
    name: string;
    members: string[];
};

// Interface pour les données brutes Firestore
interface FirestoreStats {
    totalValue?: number;
    totalCards?: number;
    uniqueCards?: number;
    foilCount?: number;
    avgPrice?: number;
}

// --- COMPOSANTS DE PRÉSENTATION ---

const StatCard = ({ 
    title, 
    winner, 
    value, 
    colorClass,
    valueColor 
}: { 
    title: string, 
    winner?: StatProfile, 
    value: string, 
    colorClass: string,
    valueColor: string 
}) => (
    <div className={`bg-surface border-l-4 ${colorClass} rounded-xl p-4 shadow-sm flex flex-col justify-between h-full`}>
        <div>
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">{title}</h3>
            {winner ? (
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0 border border-border relative">
                        {winner.photoURL ? (
                            <Image src={winner.photoURL} alt={winner.username} fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-muted text-xs">
                                {winner.username[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">{winner.displayName}</p>
                        <p className="text-xs text-muted">@{winner.username}</p>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted italic">En attente...</p>
            )}
        </div>
        <div className="text-right">
            <span className={`text-2xl font-black ${valueColor}`}>
                {winner ? value : '-'}
            </span>
        </div>
    </div>
);

const LeaderboardRow = ({ rank, profile }: { rank: number, profile: StatProfile }) => {
    let rankStyle = "bg-secondary text-muted";
    if (rank === 1) rankStyle = "bg-yellow-100 text-yellow-700 border-yellow-200";
    if (rank === 2) rankStyle = "bg-gray-100 text-gray-700 border-gray-200";
    if (rank === 3) rankStyle = "bg-orange-100 text-orange-700 border-orange-200";

    return (
        <div className="flex items-center gap-4 p-3 border-b border-border last:border-0 hover:bg-secondary/20 transition">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${rankStyle}`}>
                {rank}
            </div>
            
            <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0 border border-border relative">
                {profile.photoURL ? (
                    <Image src={profile.photoURL} alt={profile.username} fill className="object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-muted text-xs">
                        {profile.username[0]?.toUpperCase()}
                    </div>
                )}
            </div>

            <div className="grow min-w-0">
                <p className="font-bold text-foreground truncate">{profile.displayName}</p>
                <div className="flex gap-2 text-xs text-muted items-center">
                    <span>@{profile.username}</span>
                    <span className="hidden sm:inline">• {profile.totalCards} cartes</span>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold text-primary">{profile.totalValue.toFixed(0)} €</p>
                <p className="text-xs text-muted">Moy. {profile.avgPrice.toFixed(1)} €</p>
            </div>
        </div>
    );
};

export default function StatsPage() {
    const { user } = useAuth();
    const { friends } = useFriends();
    
    const [scope, setScope] = useState<'friends' | 'group'>('friends');
    const [myGroups, setMyGroups] = useState<GroupOption[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    
    const [stats, setStats] = useState<StatProfile[]>([]);
    const [loading, setLoading] = useState(false);

    // 1. Charger les groupes
    useEffect(() => {
        if (!user) return;
        const fetchGroups = async () => {
            try {
                const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
                const snap = await getDocs(q);
                const groupsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupOption));
                setMyGroups(groupsList);
                if (groupsList.length > 0) setSelectedGroupId(groupsList[0].id);
            } catch (e) {
                console.error("Erreur chargement groupes", e);
            }
        };
        fetchGroups();
    }, [user]);

    // 2. Fonction de calcul OPTIMISÉE (Parallèle)
    const calculateStats = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        
        let targetUids: string[] = [];

        if (scope === 'friends') {
            // On inclut l'utilisateur courant + ses amis
            targetUids = [user.uid, ...friends.map(f => f.uid)];
        } else {
            const group = myGroups.find(g => g.id === selectedGroupId);
            if (group) targetUids = group.members;
        }

        // Dédoublonnage au cas où
        targetUids = Array.from(new Set(targetUids));

        if (targetUids.length === 0) {
            setStats([]);
            setLoading(false);
            return;
        }

        try {
            // Lancement de TOUTES les requêtes en parallèle
            const promises = targetUids.map(async (uid) => {
                try {
                    // A. Récupération Profil (Optimisé: on utilise les données locales si ami/soi-même)
                    let profileData = { 
                        displayName: 'Inconnu', 
                        username: '?', 
                        photoURL: null as string | null 
                    };

                    if (uid === user.uid) {
                        profileData = { 
                            displayName: user.displayName || 'Moi', 
                            username: 'moi', 
                            photoURL: user.photoURL 
                        };
                    } else {
                        const friend = friends.find(f => f.uid === uid);
                        if (friend) {
                            profileData = { 
                                displayName: friend.displayName, 
                                username: friend.username, 
                                photoURL: friend.photoURL || null 
                            };
                        } else {
                            // Si pas ami direct (membre de groupe), on fetch le profil
                            const userSnap = await getDoc(doc(db, 'users', uid, 'public_profile', 'info'));
                            if (userSnap.exists()) {
                                const d = userSnap.data();
                                profileData = {
                                    displayName: d.displayName || 'Sans nom',
                                    username: d.username || '?',
                                    photoURL: d.photoURL || null
                                };
                            }
                        }
                    }

                    // B. Récupération Stats (Lecture seule du document caché)
                    // On ne recalcule PAS (updateUserStats) ici pour la vitesse.
                    const statsSnap = await getDoc(doc(db, 'users', uid, 'public_profile', 'stats'));
                    const userStats = statsSnap.exists() ? (statsSnap.data() as FirestoreStats) : {};

                    return {
                        uid,
                        ...profileData,
                        totalValue: userStats.totalValue || 0,
                        totalCards: userStats.totalCards || 0,
                        uniqueCards: userStats.uniqueCards || 0,
                        foilCount: userStats.foilCount || 0,
                        avgPrice: userStats.avgPrice || 0
                    };
                } catch (err) {
                    console.error(`Erreur pour ${uid}`, err);
                    return null;
                }
            });

            // Attente de tous les résultats
            const results = await Promise.all(promises);
            
            // Filtrage des erreurs (null) et tri
            const validResults = results.filter((r): r is StatProfile => r !== null);
            setStats(validResults.sort((a, b) => b.totalValue - a.totalValue));

        } catch (error) {
            console.error("Erreur globale stats", error);
        } finally {
            setLoading(false);
        }
    }, [user, friends, scope, selectedGroupId, myGroups]);

    // 3. Trigger automatique
    useEffect(() => {
        calculateStats();
    }, [calculateStats]);

    // --- CALCUL DES GAGNANTS ---
    const topValue = useMemo(() => [...stats].sort((a, b) => b.totalValue - a.totalValue)[0], [stats]);
    const topUnique = useMemo(() => [...stats].sort((a, b) => b.uniqueCards - a.uniqueCards)[0], [stats]);
    const topFoil = useMemo(() => [...stats].sort((a, b) => b.foilCount - a.foilCount)[0], [stats]);
    const topWhale = useMemo(() => [...stats].sort((a, b) => b.avgPrice - a.avgPrice)[0], [stats]);

    if (!user) return <div className="p-10 text-center text-muted">Veuillez vous connecter.</div>;

    return (
        <main className="container mx-auto p-4 max-w-5xl min-h-[85vh]">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-border pb-4 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">Panthéon</h1>
                    <p className="text-muted text-sm">Le classement en temps réel de votre communauté.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border shadow-sm">
                    <button 
                        onClick={() => setScope('friends')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${scope === 'friends' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
                    >
                        Amis
                    </button>
                    {myGroups.length > 0 && (
                        <button 
                            onClick={() => setScope('group')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition ${scope === 'group' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
                        >
                            Playgroups
                        </button>
                    )}
                </div>
            </div>

            {/* SÉLECTEUR DE GROUPE */}
            {scope === 'group' && (
                <div className="mb-6 flex gap-4 items-center animate-in fade-in">
                    <select 
                        value={selectedGroupId} 
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="p-3 bg-surface border border-border rounded-xl text-foreground font-medium outline-none focus:ring-2 focus:ring-primary min-w-[250px]"
                    >
                        {myGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.members.length} membres)</option>)}
                    </select>
                </div>
            )}

            {/* CHARGEMENT */}
            {loading && (
                <div className="text-center py-20 animate-pulse">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted font-medium">Récupération des scores...</p>
                </div>
            )}

            {/* RÉSULTATS */}
            {!loading && stats.length > 0 && (
                <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                    
                    {/* PODIUM */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard 
                            title="Grand Trésorier" 
                            winner={topValue} 
                            value={`${topValue?.totalValue.toFixed(0)} €`} 
                            colorClass="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10" 
                            valueColor="text-yellow-600 dark:text-yellow-400"
                        />
                        <StatCard 
                            title="Archiviste" 
                            winner={topUnique} 
                            value={`${topUnique?.uniqueCards}`} 
                            colorClass="border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                            valueColor="text-blue-600 dark:text-blue-400"
                        />
                        <StatCard 
                            title="Seigneur Foil" 
                            winner={topFoil} 
                            value={`${topFoil?.foilCount}`} 
                            colorClass="border-purple-500 bg-purple-50 dark:bg-purple-900/10"
                            valueColor="text-purple-600 dark:text-purple-400"
                        />
                        <StatCard 
                            title="La Baleine" 
                            winner={topWhale} 
                            value={`${topWhale?.avgPrice.toFixed(1)} €`} 
                            colorClass="border-green-500 bg-green-50 dark:bg-green-900/10"
                            valueColor="text-green-600 dark:text-green-400"
                        />
                    </div>

                    {/* CLASSEMENT */}
                    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border bg-secondary/30">
                            <h3 className="font-bold text-foreground">Classement Général (Valeur)</h3>
                        </div>
                        <div className="divide-y divide-border">
                            {stats.map((profile, index) => (
                                <LeaderboardRow key={profile.uid} rank={index + 1} profile={profile} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}