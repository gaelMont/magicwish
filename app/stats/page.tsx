// app/stats/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useFriends } from '@/hooks/useFriends';
import { updateUserStats } from '@/app/actions/stats';
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
    valueColor // Nouvelle prop pour forcer la couleur du texte
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
                    <span className="w-1 h-1 bg-muted rounded-full"></span>
                    <span>{profile.totalCards} cartes</span>
                    <span className="w-1 h-1 bg-muted rounded-full"></span>
                    <span>{profile.foilCount} Foils</span>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold text-primary">{profile.totalValue.toFixed(2)} €</p>
                <p className="text-xs text-muted">Moy. {profile.avgPrice.toFixed(2)} €</p>
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
    const [progress, setProgress] = useState(0);

    // 1. Charger les groupes
    useEffect(() => {
        if (!user) return;
        const fetchGroups = async () => {
            const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
            const snap = await getDocs(q);
            const groupsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupOption));
            setMyGroups(groupsList);
            if (groupsList.length > 0) setSelectedGroupId(groupsList[0].id);
        };
        fetchGroups();
    }, [user]);

    // 2. Fonction de calcul
    const calculateStats = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setStats([]); 
        setProgress(0);

        let targetUids: string[] = [];

        if (scope === 'friends') {
            targetUids = [user.uid, ...friends.map(f => f.uid)];
        } else {
            const group = myGroups.find(g => g.id === selectedGroupId);
            if (group) targetUids = group.members;
        }

        if (targetUids.length === 0) {
            setLoading(false);
            return;
        }

        const results: StatProfile[] = [];
        let processed = 0;

        for (const uid of targetUids) {
            try {
                // Info Profil
                let profileData: { displayName: string, username: string, photoURL: string | null } = {
                    displayName: 'Inconnu', username: '?', photoURL: null
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
                        const userSnap = await getDoc(doc(db, 'users', uid, 'public_profile', 'info'));
                        if (userSnap.exists()) {
                            const d = userSnap.data();
                            profileData = {
                                displayName: d.displayName,
                                username: d.username,
                                photoURL: d.photoURL
                            };
                        }
                    }
                }

                // --- OPTIMISATION : On déclenche le calcul serveur pour être sûr d'avoir des données ---
                await updateUserStats(uid);

                // Ensuite on lit le résultat
                const statsSnap = await getDoc(doc(db, 'users', uid, 'public_profile', 'stats'));
                let userStats: FirestoreStats = { 
                    totalValue: 0, totalCards: 0, uniqueCards: 0, foilCount: 0, avgPrice: 0 
                };

                if (statsSnap.exists()) {
                    userStats = statsSnap.data() as FirestoreStats;
                } 

                results.push({
                    uid,
                    ...profileData,
                    totalValue: userStats.totalValue || 0,
                    totalCards: userStats.totalCards || 0,
                    uniqueCards: userStats.uniqueCards || 0,
                    foilCount: userStats.foilCount || 0,
                    avgPrice: userStats.avgPrice || 0
                });

            } catch (e) {
                console.error(`Erreur stats pour ${uid}`, e);
            }

            processed++;
            setProgress(Math.round((processed / targetUids.length) * 100));
        }

        setStats(results.sort((a, b) => b.totalValue - a.totalValue));
        setLoading(false);
    }, [user, friends, scope, selectedGroupId, myGroups]);

    // 3. Trigger automatique au changement
    useEffect(() => {
        if (user && (scope === 'friends' || (scope === 'group' && selectedGroupId))) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            calculateStats();
        }
    }, [calculateStats, scope, selectedGroupId, user]);

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
                    <p className="text-muted text-sm">Comparez vos collections et découvrez qui règne sur le multivers.</p>
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

            {/* PROGRESSION */}
            {loading && (
                <div className="text-center py-20">
                    <p className="text-primary font-bold animate-pulse mb-2">Analyse des données... {progress}%</p>
                    <div className="w-full max-w-md mx-auto bg-secondary rounded-full h-1 overflow-hidden">
                        <div className="bg-primary h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
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
                            title="Archiviste Suprême" 
                            winner={topUnique} 
                            value={`${topUnique?.uniqueCards} Uniques`} 
                            colorClass="border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                            valueColor="text-blue-600 dark:text-blue-400"
                        />
                        <StatCard 
                            title="Seigneur des Gobelins" 
                            winner={topFoil} 
                            value={`${topFoil?.foilCount} Foils`} 
                            colorClass="border-purple-500 bg-purple-50 dark:bg-purple-900/10"
                            valueColor="text-purple-600 dark:text-purple-400"
                        />
                        <StatCard 
                            title="La Baleine" 
                            winner={topWhale} 
                            value={`${topWhale?.avgPrice.toFixed(2)} € / carte`} 
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

                    <div className="text-center pt-8">
                        <button onClick={calculateStats} className="text-sm text-muted hover:text-primary underline">
                            Rafraîchir les données
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}