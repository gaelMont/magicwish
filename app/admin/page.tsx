'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, DocumentData, Timestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

// 1. Définition des types incluant 'interesting'
interface FeedbackItem extends DocumentData {
    id: string;
    userId: string;
    username: string;
    suggestion: string;
    createdAt: Timestamp;
    status: 'new' | 'read' | 'interesting' | 'in_progress' | 'implemented';
}

// 2. Couleurs des badges
const STATUS_COLORS: Record<FeedbackItem['status'], string> = {
    new: 'bg-red-500 text-white',
    read: 'bg-gray-500 text-white',
    interesting: 'bg-purple-600 text-white',
    in_progress: 'bg-yellow-500 text-black',
    implemented: 'bg-green-600 text-white',
};

// Fonction utilitaire de temps
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

    // Guard : Redirection si pas admin
    useEffect(() => {
        if (!authLoading && user && !isAdmin) {
            router.push('/'); 
        } else if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, isAdmin, router]);

    // Lecture des données
    useEffect(() => {
        if (!user || !isAdmin) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (!authLoading) setLoading(false); 
            return;
        }

        setLoading(true);

        const feedbackQuery = query(
            collection(db, 'app_feedback'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
            const fetchedFeedback = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as FeedbackItem[];

            setFeedback(fetchedFeedback);
            setLoading(false);
        }, (error) => {
            console.error("Erreur lecture feedback admin:", error);
            toast.error("Échec du chargement.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, isAdmin, authLoading]); 

    // Filtrage local
    const filteredFeedback = useMemo(() => {
        if (filterStatus === 'all') return feedback;
        return feedback.filter(item => item.status === filterStatus);
    }, [feedback, filterStatus]);

    if (authLoading || (user && !isAdmin)) {
        return <div className="flex h-screen items-center justify-center text-primary animate-pulse">Chargement Admin...</div>;
    }

    if (!user || !isAdmin) return null; 

    // --- ACTIONS ---

    const updateStatus = async (itemId: string, newStatus: FeedbackItem['status']) => {
        try {
            const itemRef = doc(db, 'app_feedback', itemId);
            await updateDoc(itemRef, { status: newStatus });
            toast.success(`Statut mis à jour : ${newStatus}`);
        } catch (e) {
            console.error(e);
            toast.error("Erreur mise à jour statut");
        }
    };

    const deleteFeedback = async (itemId: string) => {
        if (!confirm("Supprimer définitivement ce feedback ?")) return;
        try {
            await deleteDoc(doc(db, 'app_feedback', itemId));
            toast.success("Feedback supprimé");
        } catch (e) {
            console.error(e);
            toast.error("Erreur suppression");
        }
    };

    // Liste des onglets de filtre
    const filterTabs: (FeedbackItem['status'] | 'all')[] = ['new', 'read', 'interesting', 'in_progress', 'implemented', 'all'];

    return (
        <main className="container mx-auto p-4 max-w-6xl min-h-[80vh]">
            <h1 className="text-3xl font-bold text-red-500 mb-8 border-b border-gray-200 pb-4">
                👑 Tableau de Bord Admin
            </h1>

            {/* --- BARRE DE FILTRES --- */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-bold text-gray-700 mr-2">Filtrer par :</span>
                
                {filterTabs.map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase transition-colors ${
                            filterStatus === status 
                                ? (status === 'all' ? 'bg-gray-800 text-white' : STATUS_COLORS[status]) 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                    >
                        {status.replace('_', ' ')} ({status === 'all' ? feedback.length : feedback.filter(f => f.status === status).length})
                    </button>
                ))}
            </div>

            <p className="text-gray-500 mb-6 text-sm">
                Suggestions affichées : {filteredFeedback.length}
            </p>

            {loading ? (
                 <p className="text-center p-10 text-gray-400">Chargement...</p>
            ) : filteredFeedback.length === 0 ? (
                 <div className="text-center py-16 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                    <p className="text-gray-400 italic">Aucun feedback dans cette catégorie.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredFeedback.map(item => (
                        <div 
                            key={item.id} 
                            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition"
                        >
                            
                            {/* En-tête de la carte */}
                            <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${STATUS_COLORS[item.status]}`}>
                                        {item.status.replace('_', ' ')}
                                    </span>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Par <span className="font-semibold text-gray-800">@{item.username}</span>
                                    </p>
                                </div>
                                <span className="text-xs text-gray-400">
                                    {formatTimeAgo(item.createdAt)}
                                </span>
                            </div>

                            {/* Contenu */}
                            <p className="text-gray-800 font-medium mb-4 whitespace-pre-wrap">
                                {item.suggestion}
                            </p>

                            {/* Barre d'actions (CORRIGÉE : TOUT A GAUCHE) */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 w-full">
                                
                                {/* TOUS LES STATUTS REGROUPÉS ICI */}
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => updateStatus(item.id, 'read')} className="text-xs bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 px-3 py-1.5 rounded shadow-sm transition">
                                        Lu
                                    </button>
                                    <button onClick={() => updateStatus(item.id, 'interesting')} className="text-xs bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded shadow-sm font-semibold transition">
                                        ⭐ Intéressant
                                    </button>
                                    <button onClick={() => updateStatus(item.id, 'in_progress')} className="text-xs bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded shadow-sm transition">
                                        En Cours
                                    </button>
                                    <button onClick={() => updateStatus(item.id, 'implemented')} className="text-xs bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded shadow-sm font-bold transition">
                                        ✅ Fait
                                    </button>
                                </div>

                                {/* LA POUBELLE (POUSSÉE À DROITE PAR ml-auto) */}
                                <button 
                                    onClick={() => deleteFeedback(item.id)} 
                                    className="ml-auto text-xs text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition"
                                    title="Supprimer définitivement"
                                >
                                    🗑️
                                </button>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}