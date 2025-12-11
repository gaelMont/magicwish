// app/contacts/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useFriends, FriendProfile } from '@/hooks/useFriends';
import toast from 'react-hot-toast';

export default function ContactsPage() {
  const { user } = useAuth();
  const { 
    friends, requestsReceived, loading,
    searchUserByUsername, sendFriendRequest, 
    acceptRequest, declineRequest, removeFriend
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  if (!user) return <div className="p-10 text-center">Connectez-vous pour voir vos contacts.</div>;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResult(null);
    try {
      const result = await searchUserByUsername(searchQuery);
      if (result) {
        setSearchResult(result);
      } else {
        toast.error("Utilisateur introuvable.");
      }
    } catch (err: any) {
        toast.error(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="container mx-auto p-4 max-w-4xl min-h-[80vh]">
      <h1 className="text-3xl font-bold mb-8 text-blue-600 dark:text-blue-400 flex items-center gap-2">
        👥 Mes Contacts
      </h1>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* COLONNE GAUCHE : RECHERCHE + DEMANDES */}
        <div className="space-y-8">
            
            {/* 1. RECHERCHE */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="font-bold text-lg mb-4">Ajouter un ami</h2>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <div className="relative flex-grow">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                        <input 
                            type="text" 
                            placeholder="pseudo_exact" 
                            className="w-full pl-7 p-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500 lowercase"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value.toLowerCase())}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={isSearching}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition disabled:opacity-50"
                    >
                        {isSearching ? '...' : '🔍'}
                    </button>
                </form>

                {/* RESULTAT RECHERCHE */}
                {searchResult && (
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg overflow-hidden">
                                {searchResult.photoURL ? <img src={searchResult.photoURL} alt="" /> : searchResult.username[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold text-sm">{searchResult.displayName}</p>
                                <p className="text-xs text-blue-600">@{searchResult.username}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => sendFriendRequest(searchResult)}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 transition shadow-sm"
                        >
                            Ajouter +
                        </button>
                    </div>
                )}
            </div>

            {/* 2. DEMANDES REÇUES */}
            {requestsReceived.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-orange-200 dark:border-orange-900/50">
                    <h2 className="font-bold text-lg mb-4 text-orange-600 dark:text-orange-400 flex items-center gap-2">
                        🔔 Demandes reçues <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">{requestsReceived.length}</span>
                    </h2>
                    <div className="space-y-3">
                        {requestsReceived.map(req => (
                            <div key={req.uid} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
                                        {req.photoURL && <img src={req.photoURL} alt="" className="w-full h-full object-cover"/>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{req.displayName}</p>
                                        <p className="text-xs text-gray-500">@{req.username}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => acceptRequest(req)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-full" title="Accepter">✓</button>
                                    <button onClick={() => declineRequest(req.uid)} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-full" title="Refuser">✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* COLONNE DROITE : LISTE AMIS */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-fit">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                Mes Amis <span className="text-gray-400 font-normal">({friends.length})</span>
            </h2>
            
            {loading ? (
                <p className="text-gray-500 text-sm">Chargement...</p>
            ) : friends.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic">
                    <p>Aucun ami pour l'instant.</p>
                    <p className="text-xs mt-1">Utilisez la recherche pour en ajouter !</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {friends.map(friend => (
                        <div key={friend.uid} className="group flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-sm overflow-hidden">
                                    {friend.photoURL ? <img src={friend.photoURL} alt="" className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-gray-200">{friend.displayName}</p>
                                    <p className="text-xs text-gray-500">@{friend.username}</p>
                                </div>
                            </div>
                            
                            {/* Actions Ami (Plus tard : Voir Collection) */}
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => removeFriend(friend.uid)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1">Retirer</button>
                                {/* C'est ici qu'on ajoutera le bouton "Voir" à l'étape 3 */}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>
    </main>
  );
}