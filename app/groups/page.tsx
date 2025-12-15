// app/groups/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { createGroupAction, addMemberAction, promoteMemberAction, removeMemberAction } from '@/app/actions/groups';
import toast from 'react-hot-toast';
import { FriendProfile, useFriends } from '@/hooks/useFriends'; 

type Group = {
    id: string;
    name: string;
    members: string[];
    admins: string[];
    ownerUid: string;
};

export default function GroupsPage() {
    const { user } = useAuth();
    const { friends } = useFriends(); 
    
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [newGroupName, setNewGroupName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [groupMembersData, setGroupMembersData] = useState<FriendProfile[]>([]);
    
    const [isInviteOpen, setIsInviteOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
        
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
            setGroups(list);
            
            if (selectedGroup) {
                const updated = list.find(g => g.id === selectedGroup.id);
                if (updated) setSelectedGroup(updated);
            }
            setLoading(false);
        });
        
        return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, selectedGroup?.id]);

    useEffect(() => {
        const fetchMembers = async () => {
            if (!selectedGroup) return;
            const profiles: FriendProfile[] = [];
            
            for (const uid of selectedGroup.members) {
                try {
                    const friend = friends.find(f => f.uid === uid);
                    if (friend) {
                        profiles.push(friend);
                    } else {
                        const snap = await getDoc(doc(db, 'users', uid, 'public_profile', 'info'));
                        if (snap.exists()) {
                            const data = snap.data();
                            profiles.push({ 
                                uid, 
                                username: typeof data.username === 'string' ? data.username : '?', 
                                displayName: typeof data.displayName === 'string' ? data.displayName : 'Joueur', 
                                photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined
                            });
                        }
                    }
                } catch (e) { console.error(e); }
            }
            setGroupMembersData(profiles);
        };
        fetchMembers();
    }, [selectedGroup, friends]);

    const handleCreate = async () => {
        if (!user || !newGroupName.trim()) return;
        setIsSubmitting(true);
        const res = await createGroupAction(user.uid, newGroupName);
        if (res.success) {
            toast.success("Playgroup créé !");
            setNewGroupName('');
        } else {
            toast.error("Erreur création");
        }
        setIsSubmitting(false);
    };

    const handleInvite = async (friendUid: string) => {
        if (!user || !selectedGroup) return;
        const res = await addMemberAction(user.uid, selectedGroup.id, friendUid);
        if (res.success) {
            toast.success("Membre ajouté !");
            setIsInviteOpen(false);
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handlePromote = async (targetUid: string) => {
        if (!user || !selectedGroup) return;
        if (!confirm("Donner les droits Admin à ce membre ?")) return;
        
        const res = await promoteMemberAction(user.uid, selectedGroup.id, targetUid);
        if (res.success) toast.success("Membre promu Admin");
        else toast.error("Erreur promotion");
    };

    const handleKickOrLeave = async (targetUid: string) => {
        if (!user || !selectedGroup) return;
        const isSelf = targetUid === user.uid;
        if (!confirm(isSelf ? "Quitter ce playgroup ?" : "Exclure ce membre ?")) return;

        const res = await removeMemberAction(user.uid, selectedGroup.id, targetUid);
        if (res.success) {
            toast.success(isSelf ? "Vous avez quitté le playgroup" : "Membre exclu");
            if (isSelf) setSelectedGroup(null);
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    if (!user) return <div className="p-10 text-center text-muted">Veuillez vous connecter.</div>;

    const isAdmin = selectedGroup?.admins.includes(user.uid);

    return (
        <main className="container mx-auto p-4 max-w-5xl min-h-[85vh] flex flex-col md:flex-row gap-8">
            
            {/* GAUCHE : LISTE & CRÉATION */}
            <div className="w-full md:w-1/3 space-y-6">
                <h1 className="text-2xl font-bold text-primary">Mes Playgroups</h1>

                {/* Créer */}
                <div className="bg-surface p-4 rounded-xl border border-border shadow-sm">
                    <h3 className="text-sm font-bold text-muted uppercase mb-2">Nouveau Playgroup</h3>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Nom (ex: EDH Nantes)" 
                            className="w-full p-2 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                        />
                        <button onClick={handleCreate} disabled={isSubmitting} className="btn-primary text-sm px-3">+</button>
                    </div>
                </div>

                {/* Liste */}
                <div className="space-y-2">
                    {loading ? <p className="text-muted text-sm">Chargement...</p> : groups.map(group => (
                        <div 
                            key={group.id}
                            onClick={() => setSelectedGroup(group)}
                            className={`p-3 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                                selectedGroup?.id === group.id 
                                ? 'bg-primary/10 border-primary' 
                                : 'bg-surface border-border hover:border-primary/50'
                            }`}
                        >
                            <div>
                                <p className="font-bold text-foreground">{group.name}</p>
                                <p className="text-xs text-muted">
                                    {group.members.length} membre(s) 
                                    {group.admins.includes(user.uid) && <span className="ml-2 text-primary font-bold">• Admin</span>}
                                </p>
                            </div>
                            <span className="text-lg text-primary">&gt;</span>
                        </div>
                    ))}
                    {groups.length === 0 && !loading && (
                        <p className="text-sm text-muted italic text-center py-4">Vous n&apos;avez aucun playgroup.</p>
                    )}
                </div>
            </div>

            {/* DROITE : DÉTAILS */}
            <div className="w-full md:w-2/3 bg-surface border border-border rounded-2xl p-6 shadow-sm min-h-[500px] flex flex-col">
                {selectedGroup ? (
                    <div className="animate-in fade-in grow flex flex-col">
                        
                        <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
                            <div>
                                <h2 className="text-3xl font-bold text-foreground mb-1">{selectedGroup.name}</h2>
                                <p className="text-sm text-muted">
                                    {selectedGroup.members.length} joueurs
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {isAdmin && (
                                    <button 
                                        onClick={() => setIsInviteOpen(true)}
                                        className="btn-primary text-xs px-4 py-2"
                                    >
                                        Inviter
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleKickOrLeave(user.uid)}
                                    className="text-xs text-danger border border-danger/20 bg-danger/5 px-3 py-2 rounded hover:bg-danger/10 transition"
                                >
                                    Quitter
                                </button>
                            </div>
                        </div>

                        <h3 className="font-bold text-muted uppercase text-xs mb-4">Membres</h3>
                        
                        <div className="grid grid-cols-1 gap-3 overflow-y-auto custom-scrollbar max-h-[500px]">
                            {groupMembersData.map(member => {
                                const isMemberAdmin = selectedGroup.admins.includes(member.uid);
                                return (
                                    <div key={member.uid} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border hover:bg-secondary/30 transition">
                                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0 overflow-hidden">
                                            {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" alt="" /> : member.username[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0 grow">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-foreground truncate">{member.displayName}</p>
                                                {isMemberAdmin && <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded font-bold uppercase">Admin</span>}
                                            </div>
                                            <p className="text-xs text-muted">@{member.username}</p>
                                        </div>
                                        
                                        {isAdmin && member.uid !== user.uid && (
                                            <div className="flex items-center gap-2">
                                                {!isMemberAdmin && (
                                                    <button onClick={() => handlePromote(member.uid)} className="text-xs text-muted hover:text-primary underline">Promouvoir</button>
                                                )}
                                                <button onClick={() => handleKickOrLeave(member.uid)} className="text-xs text-muted hover:text-danger underline">Exclure</button>
                                            </div>
                                        )}
                                        
                                        {member.uid !== user.uid && (
                                            <div className="ml-2 flex gap-2">
                                                <a 
                                                    href={`/user/${member.uid}`} // <-- CORRECTION ICI
                                                    className="text-xs bg-secondary text-foreground px-2 py-1 rounded hover:bg-border font-bold transition"
                                                >
                                                    Voir
                                                </a>
                                                <a 
                                                    href={`/trades/new/${member.uid}`} 
                                                    className="text-xs bg-success/10 text-success px-2 py-1 rounded hover:bg-success/20 font-bold transition"
                                                >
                                                    Échanger
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted">
                        <p>Sélectionnez un playgroup pour voir les détails.</p>
                    </div>
                )}
            </div>

            {isInviteOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setIsInviteOpen(false)}>
                    <div className="bg-surface p-6 rounded-xl max-w-sm w-full shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4 text-foreground">Ajouter un ami</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {friends.filter(f => !selectedGroup?.members.includes(f.uid)).length === 0 ? (
                                <p className="text-sm text-muted italic text-center">Tous vos amis sont déjà ici.</p>
                            ) : (
                                friends
                                    .filter(f => !selectedGroup?.members.includes(f.uid))
                                    .map(friend => (
                                        <div key={friend.uid} className="flex justify-between items-center p-2 hover:bg-secondary/50 rounded-lg">
                                            <span className="text-sm font-medium text-foreground">{friend.displayName}</span>
                                            <button 
                                                onClick={() => handleInvite(friend.uid)}
                                                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:opacity-90"
                                            >
                                                Ajouter
                                            </button>
                                        </div>
                                    ))
                            )}
                        </div>
                        <button onClick={() => setIsInviteOpen(false)} className="mt-4 w-full text-sm text-muted hover:text-foreground">Fermer</button>
                    </div>
                </div>
            )}

        </main>
    );
}