// app/contacts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';
import { useFriends, FriendProfile } from '@/hooks/useFriends';
import toast from 'react-hot-toast';

const PLANESWALKERS = [
  "Jace", "Liliana", "Chandra", "Ajani", "Garruk", 
  "Teferi", "Nissa", "Gideon", "Nicol_Bolas", "Ugin"
];

export default function ContactsPage() {
  const { user } = useAuth();
  const { 
    friends, requestsReceived, loading,
    searchUsers, sendFriendRequest, acceptRequest, declineRequest, removeFriend
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [randomPlaceholder, setRandomPlaceholder] = useState("ex: Jace...");

  useEffect(() => {
    const randomName = PLANESWALKERS[Math.floor(Math.random() * PLANESWALKERS.length)];
    setRandomPlaceholder(`ex: ${randomName} (pour trouver ${randomName.toLowerCase()}_fan...)`);
  }, []);

  if (!user) return <div className="p-10 text-center text-muted">Veuillez vous connecter.</div>;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      if (results.length === 0) toast("Aucun utilisateur trouve");
    } catch (err) { console.error(err); toast.error("Erreur recherche"); }
    finally { setIsSearching(false); }
  };

  return (
    <main className="container mx-auto p-4 max-w-4xl min-h-[80vh]">
      <h1 className="text-3xl font-bold mb-8 text-primary flex items-center gap-2">
        Mes Contacts
      </h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-8">
            <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
                <h2 className="font-bold text-lg mb-4 text-foreground">Chercher un ami</h2>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <div className="relative grow">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
                        <input 
                            type="text" 
                            placeholder={randomPlaceholder} 
                            className="w-full pl-7 p-2 border border-border rounded-lg bg-background text-foreground outline-none focus:ring-2 focus:ring-primary lowercase"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value.toLowerCase())}
                        />
                    </div>
                    <button type="submit" disabled={isSearching} className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded-lg font-bold transition disabled:opacity-50">
                        {isSearching ? '...' : 'Chercher'}
                    </button>
                </form>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {searchResults.map(result => (
                        <div key={result.uid} className="flex items-center justify-between bg-secondary/50 p-3 rounded-lg border border-border animate-in fade-in">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs overflow-hidden relative">
                                    {result.photoURL ? <Image src={result.photoURL} alt="" fill className="object-cover" /> : result.username[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-foreground">{result.displayName}</p>
                                    <p className="text-xs text-primary">@{result.username}</p>
                                </div>
                            </div>
                            <button onClick={() => sendFriendRequest(result)} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:opacity-90 transition shadow-sm">Ajouter</button>
                        </div>
                    ))}
                </div>
            </div>

            {requestsReceived.length > 0 && (
                <div className="bg-surface p-6 rounded-xl shadow-sm border border-orange-200 dark:border-orange-900/50 animate-in slide-in-from-left-4">
                    <h2 className="font-bold text-lg mb-4 text-orange-600 dark:text-orange-400 flex items-center gap-2">
                        Demandes reçues <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">{requestsReceived.length}</span>
                    </h2>
                    <div className="space-y-3">
                        {requestsReceived.map(req => (
                            <div key={req.uid} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-secondary border border-border overflow-hidden relative">
                                        {req.photoURL ? <Image src={req.photoURL} alt="" fill className="object-cover" /> : <span className="flex items-center justify-center h-full font-bold text-muted">{req.username[0].toUpperCase()}</span>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-foreground">{req.displayName}</p>
                                        <p className="text-xs text-muted">@{req.username}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => acceptRequest(req)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-full transition">V</button>
                                    <button onClick={() => declineRequest(req.uid)} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-full transition">X</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="bg-surface p-6 rounded-xl shadow-sm border border-border h-fit">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
                Mes Amis <span className="text-muted font-normal">({friends.length})</span>
            </h2>
            {loading ? <p className="text-muted text-sm">Chargement...</p> : friends.length === 0 ? (
                <div className="text-center py-10 text-muted italic"><p>Aucun ami pour l&apos;instant.</p></div>
            ) : (
                <div className="space-y-2">
                    {friends.map(friend => (
                        <div key={friend.uid} className="group flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition border border-transparent hover:border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold shadow-sm overflow-hidden relative">
                                    {friend.photoURL ? <Image src={friend.photoURL} alt="" fill className="object-cover" /> : friend.username[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-foreground">{friend.displayName}</p>
                                    <p className="text-xs text-muted">@{friend.username}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Link 
                                    href={`/user/${friend.uid}`} // <-- CORRECTION ICI
                                    className="text-xs bg-secondary text-foreground px-3 py-1.5 rounded hover:bg-border transition font-medium"
                                >
                                    Voir
                                </Link>
                                <Link 
                                    href={`/trades/new/${friend.uid}`} 
                                    className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20 transition font-medium flex items-center gap-1"
                                >
                                    Échanger
                                </Link>
                                <button onClick={() => removeFriend(friend.uid)} className="text-danger hover:text-red-700 text-xs px-2 py-1">X</button>
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