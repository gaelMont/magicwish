// app/contacts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';
import { useFriends, FriendProfile } from '@/hooks/useFriends';
import toast from 'react-hot-toast';
import { Search, UserPlus, Eye, X, UserMinus, Check } from 'lucide-react';

const PLANESWALKERS = ["Jace", "Liliana", "Chandra", "Ajani", "Garruk", "Teferi", "Nissa", "Gideon"];

export default function ContactsPage() {
  const { user } = useAuth();
  const { 
    friends, requestsReceived, loading,
    searchUsers, sendFriendRequest, acceptRequest, declineRequest, removeFriend
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [randomPlaceholder, setRandomPlaceholder] = useState("Chercher...");

  useEffect(() => {
    const randomName = PLANESWALKERS[Math.floor(Math.random() * PLANESWALKERS.length)];
    setRandomPlaceholder(`@${randomName.toLowerCase()}...`);
  }, []);

  if (!user) return <div className="p-10 text-center text-muted font-bold uppercase text-xs">Veuillez vous connecter.</div>;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      if (results.length === 0) toast("Aucun utilisateur trouvé");
    } catch (err) { console.error(err); toast.error("Erreur recherche"); }
    finally { setIsSearching(false); }
  };

  return (
    <main className="container mx-auto p-4 max-w-5xl min-h-[80vh] pb-32">
      <h1 className="text-3xl font-black mb-8 text-foreground uppercase tracking-tighter">Mes Contacts</h1>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        
        {/* RECHERCHE */}
        <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
          <h2 className="font-black text-[10px] uppercase tracking-[0.2em] mb-4 text-muted flex items-center gap-2">
            <Search className="w-3 h-3" /> Chercher un ami
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder={randomPlaceholder} 
              className="grow p-3 border border-border rounded-xl bg-background text-foreground outline-none focus:ring-2 focus:ring-primary font-bold text-sm lowercase"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value.toLowerCase())}
            />
            <button type="submit" disabled={isSearching} className="bg-primary text-white px-5 rounded-xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50 transition-transform active:scale-95">
              {isSearching ? '...' : 'OK'}
            </button>
          </form>
          
          <div className="space-y-2">
            {searchResults.map(result => (
              <div key={result.uid} className="flex items-center justify-between bg-background p-3 rounded-xl border border-border animate-in fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-black text-xs shrink-0 overflow-hidden relative">
                    {result.photoURL ? <Image src={result.photoURL} alt="" fill className="object-cover" /> : result.username[0].toUpperCase()}
                  </div>
                  <p className="font-bold text-xs truncate">@{result.username}</p>
                </div>
                <button onClick={() => sendFriendRequest(result)} className="p-2 bg-primary text-white rounded-lg transition-transform active:scale-90 shadow-sm" title="Ajouter">
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* LISTE D'AMIS */}
        <div className="bg-surface p-5 rounded-2xl shadow-sm border border-border">
          <h2 className="font-black text-[10px] uppercase tracking-[0.2em] mb-6 text-muted">Mes Amis ({friends.length})</h2>

          {/* Demandes reçues */}
          {requestsReceived.length > 0 && (
            <div className="mb-8 space-y-2">
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2">Demandes en attente</p>
              {requestsReceived.map(req => (
                <div key={req.uid} className="flex items-center justify-between p-3 bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200 dark:border-orange-900/30 rounded-xl">
                  <p className="font-bold text-xs truncate grow mr-2">@{req.username}</p>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => acceptRequest(req)} className="w-8 h-8 bg-success text-white rounded-lg flex items-center justify-center"><Check className="w-4 h-4" /></button>
                    <button onClick={() => declineRequest(req.uid)} className="w-8 h-8 bg-danger text-white rounded-lg flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liste principale */}
          <div className="grid gap-3">
            {loading ? (
              <p className="text-muted text-[10px] font-bold uppercase p-4 text-center animate-pulse tracking-widest">Chargement...</p>
            ) : friends.length === 0 ? (
              <p className="text-muted italic text-[10px] p-8 text-center bg-background rounded-xl border border-dashed border-border uppercase">Aucun ami.</p>
            ) : (
              friends.map(friend => (
                <div key={friend.uid} className="flex flex-col p-4 bg-background rounded-2xl border border-border hover:border-primary/40 transition-all gap-4 shadow-xs">
                  
                  {/* Ligne 1 : Profil et Suppression Rapide */}
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-secondary border border-border shrink-0 overflow-hidden relative shadow-sm">
                        {friend.photoURL && <Image src={friend.photoURL} alt="" fill className="object-cover" sizes="40px" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-foreground truncate tracking-tight">{friend.displayName}</p>
                        <p className="text-[10px] text-primary font-black uppercase tracking-tighter">@{friend.username}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFriend(friend.uid)} 
                      className="w-8 h-8 flex items-center justify-center text-muted hover:text-danger transition-colors"
                      title="Retirer des amis"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Ligne 2 : Actions Stacking (Comme Playgroup) */}
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/user/${friend.uid}`} 
                      className="flex-1 flex items-center justify-center gap-2 text-[10px] bg-secondary text-foreground py-2.5 rounded-xl font-black uppercase tracking-tighter border border-border/50 hover:bg-border transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Voir
                    </Link>
                    <Link 
                      href={`/trades/new/${friend.uid}`} 
                      className="flex-1 flex items-center justify-center gap-2 text-[10px] bg-primary text-white py-2.5 rounded-xl font-black uppercase tracking-tighter shadow-sm active:scale-95 transition-transform"
                    >
                        Échanger
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}