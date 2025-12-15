// app/admin/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, DocumentData, Timestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { forceUpdateAllUsersCardsAction } from '@/app/actions/admin';

interface FeedbackItem extends DocumentData {
    id: string;
    userId: string;
    username: string;
    suggestion: string;
    createdAt: Timestamp;
    status: 'new' | 'read' | 'interesting' | 'in_progress' | 'implemented';
}

const STATUS_COLORS: Record<FeedbackItem['status'], string> = {
    new: 'bg-red-500 text-white',
    read: 'bg-gray-500 text-white',
    interesting: 'bg-purple-600 text-white',
    in_progress: 'bg-yellow-500 text-black',
    implemented: 'bg-green-600 text-white',
};

const formatTimeAgo = (timestamp: Timestamp): string => {
    if (!timestamp) return '';
    const now = new Date();
    const past = timestamp.toDate();
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    const MINUTE = 60;
    const HOUR = 3600;
    const DAY = 86400;

    if (diffInSeconds < MINUTE) return "À l'instant";
    if (diffInSeconds < HOUR) return `Il y a ${Math.floor(diffInSeconds / MINUTE)} min`;
    if (diffInSeconds < DAY) return `Il y a ${Math.floor(diffInSeconds / HOUR)} h`;
    if (diffInSeconds < DAY * 30) return `Il y a ${Math.floor(diffInSeconds / DAY)} jours`;
    return past.toLocaleDateString();
};

export default function AdminPage() {
    const { user, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();
    
    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<FeedbackItem['status'] | 'all'>('new');
    const [isUpdatingAll, setIsUpdatingAll] = useState(false);

    useEffect(() => {
        if (!authLoading && user && !isAdmin) {
            router.push('/'); 
        } else if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, isAdmin, router]);

    useEffect(() => {
        if (!user || !isAdmin) {
            if (!authLoading) setLoading(false); 
            return;
        }

        setLoading(true);
        const feedbackQuery = query(collection(db, 'app_feedback'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
            const fetchedFeedback = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FeedbackItem[];
            setFeedback(fetchedFeedback);
            setLoading(false);
        }, (error) => { console.error(error); setLoading(false); });

        return () => unsubscribe();
    }, [user, isAdmin, authLoading]); 

    const filteredFeedback = useMemo(() => {
        if (filterStatus === 'all') return feedback;
        return feedback.filter(item => item.status === filterStatus);
    }, [feedback, filterStatus]);

    const updateStatus = async (itemId: string, newStatus: FeedbackItem['status']) => {
        try { await updateDoc(doc(db, 'app_feedback', itemId), { status: newStatus }); toast.success(`Statut mis à jour`); } catch (e) { console.error(e); toast.error("Erreur"); }
    };

    const deleteFeedback = async (itemId: string) => {
        if (!confirm("Supprimer ?")) return;
        try { await deleteDoc(doc(db, 'app_feedback', itemId)); toast.success("Supprimé"); } catch (e) { console.error(e); }
    };

    const handleGlobalUpdate = async () => {
        if (!confirm("ATTENTION : Mise à jour globale (CMC/Identité Couleur) pour TOUS les utilisateurs. Continuer ?")) return;
        setIsUpdatingAll(true);
        const toastId = toast.loading("Mise à jour en cours...");
        try {
            const result = await forceUpdateAllUsersCardsAction();
            if (result.success) toast.success(result.message || "Terminé !", { id: toastId, duration: 5000 });
            else toast.error(result.error || "Erreur", { id: toastId });
        } catch (e) { console.error(e); toast.error("Erreur fatale", { id: toastId }); }
        finally { setIsUpdatingAll(false); }
    };

    const filterTabs: (FeedbackItem['status'] | 'all')[] = ['new', 'read', 'interesting', 'in_progress', 'implemented', 'all'];

    if (authLoading || (user && !isAdmin)) return null; 

    return (
        <main className="container mx-auto p-4 max-w-6xl min-h-[80vh]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-200 pb-4 gap-4">
                <h1 className="text-3xl font-bold text-red-500">👑 Admin Dashboard</h1>
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex flex-col items-end shadow-sm">
                    <h3 className="text-xs font-bold text-red-700 uppercase mb-2">Maintenance Globale</h3>
                    <button onClick={handleGlobalUpdate} disabled={isUpdatingAll} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm disabled:opacity-50 transition flex items-center gap-2">
                        {isUpdatingAll ? 'Traitement...' : '🔄 Forcer Update Cartes (CMC/Identité)'}
                    </button>
                    <p className="text-[10px] text-red-500 mt-1 max-w-[200px] text-right">Met à jour les données (Identité Couleur) pour corriger les filtres.</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-bold text-gray-700 mr-2">Filtrer :</span>
                {filterTabs.map(status => (
                    <button key={status} onClick={() => setFilterStatus(status)} className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase transition-colors ${filterStatus === status ? (status === 'all' ? 'bg-gray-800 text-white' : STATUS_COLORS[status]) : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {status.replace('_', ' ')} ({status === 'all' ? feedback.length : feedback.filter(f => f.status === status).length})
                    </button>
                ))}
            </div>

            {loading ? <p className="text-center p-10 text-gray-400">Chargement...</p> : filteredFeedback.length === 0 ? (
                 <div className="text-center py-16 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200"><p className="text-gray-400 italic">Aucun feedback.</p></div>
            ) : (
                <div className="space-y-4">
                    {filteredFeedback.map(item => (
                        <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                                <div><span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${STATUS_COLORS[item.status]}`}>{item.status.replace('_', ' ')}</span><p className="text-sm text-gray-500 mt-2">Par <span className="font-semibold text-gray-800">@{item.username}</span></p></div>
                                <span className="text-xs text-gray-400">{formatTimeAgo(item.createdAt)}</span>
                            </div>
                            <p className="text-gray-800 font-medium mb-4 whitespace-pre-wrap">{item.suggestion}</p>
                            <div className="flex flex-wrap items-center gap-2 pt-2 w-full">
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => updateStatus(item.id, 'read')} className="text-xs bg-gray-50 border hover:bg-gray-100 px-3 py-1.5 rounded">Lu</button>
                                    <button onClick={() => updateStatus(item.id, 'interesting')} className="text-xs bg-purple-50 border hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded font-bold">⭐ Intéressant</button>
                                    <button onClick={() => updateStatus(item.id, 'in_progress')} className="text-xs bg-yellow-50 border hover:bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded">En Cours</button>
                                    <button onClick={() => updateStatus(item.id, 'implemented')} className="text-xs bg-green-50 border hover:bg-green-100 text-green-700 px-3 py-1.5 rounded font-bold">✅ Fait</button>
                                </div>
                                <button onClick={() => deleteFeedback(item.id)} className="ml-auto text-xs text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}