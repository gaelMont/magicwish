'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; // Ajusté selon votre repomix
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { createGroupAction, addMemberAction, promoteMemberAction, removeMemberAction } from '@/app/actions/groups';
import toast from 'react-hot-toast';
import { FriendProfile, useFriends } from '@/hooks/useFriends'; 
import Image from 'next/image';
import Link from 'next/link';
import { Shield, X, Users, ArrowRight, MessageSquare } from 'lucide-react'; // Ajout MessageSquare
import { getOrCreateDirectChat } from '@/app/actions/chat'; // Import Action Chat
import ChatWindow from '@/components/chat/ChatWindow'; // Import Composant Chat

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

    // ÉTAT : Chat actif pour l'intégration
    const [activeChat, setActiveChat] = useState<{ chatId: string; recipientName: string } | null>(null);

    // Écoute des groupes auxquels l'utilisateur appartient
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
    }, [user, selectedGroup]);

    // Chargement des profils détaillés des membres du groupe
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

    const handleOpenChat = async (targetUid: string, targetName: string) => {
        if (!user) return toast.error("Connectez-vous pour discuter");
        if (user.uid === targetUid) return;

        try {
            const res = await getOrCreateDirectChat(user.uid, targetUid);
            if (res.success && res.chatId) {
                setActiveChat({ chatId: res.chatId, recipientName: targetName });
            }
        } catch (error) {
            toast.error("Erreur lors de l'ouverture du chat");
        }
    };

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
        <main className="container mx-auto p-4 max-w-5xl min-h-[85vh] flex flex-col md:flex-row gap-8 pb-32">
            
            {/* GAUCHE : LISTE & CRÉATION */}
            <div className="w-full md:w-1/3 space-y-6">
                <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter">Playgroups</h1>

                {/* Bloc Chat Actif si ouvert */}
                {activeChat && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-end mb-2">
                            <button onClick={() => setActiveChat(null)} className="text-[9px] font-black uppercase text-muted hover:text-danger flex items-center gap-1">
                                <X className="w-3 h-3" /> Fermer le chat
                            </button>
                        </div>
                        <ChatWindow chatId={activeChat.chatId} recipientName={activeChat.recipientName} />
                    </div>
                )}

                <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm">
                    <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Nouveau Groupe</h3>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Nom du groupe..." 
                            className="w-full p-3 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                        />
                        <button onClick={handleCreate} disabled={isSubmitting} className="bg-primary text-white px-4 rounded-xl font-black text-lg transition active:scale-95">+</button>
                    </div>
                </div>

                <div className="grid gap-2">
                    {loading ? (
                        <p className="text-muted text-xs font-bold uppercase animate-pulse">Chargement...</p>
                    ) : groups.map(group => (
                        <div 
                            key={group.id}
                            onClick={() => setSelectedGroup(group)}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${
                                selectedGroup?.id === group.id 
                                ? 'bg-primary/10 border-primary ring-1 ring-primary/20' 
                                : 'bg-surface border-border hover:border-primary/40'
                            }`}
                        >
                            <div className="min-w-0">
                                <p className="font-black text-sm text-foreground truncate uppercase tracking-tight">{group.name}</p>
                                <p className="text-[10px] text-muted font-bold uppercase">
                                    {group.members.length} membre(s) 
                                    {group.admins.includes(user.uid) && <span className="ml-2 text-primary">• Admin</span>}
                                </p>
                            </div>
                            <ArrowRight className={`w-4 h-4 text-primary transition-transform ${selectedGroup?.id === group.id ? 'translate-x-1' : ''}`} />
                        </div>
                    ))}
                    {!loading && groups.length === 0 && (
                        <p className="text-[10px] text-muted font-black uppercase text-center py-8 bg-background rounded-2xl border border-dashed border-border tracking-widest">Aucun playgroup.</p>
                    )}
                </div>
            </div>

            {/* DROITE : DÉTAILS */}
            <div className="w-full md:w-2/3 bg-surface border border-border rounded-3xl p-5 md:p-8 shadow-sm min-h-[500px] flex flex-col overflow-hidden">
                {selectedGroup ? (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 grow flex flex-col">
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 border-b border-border pb-6">
                            <div>
                                <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter leading-none mb-2">{selectedGroup.name}</h2>
                                <p className="text-xs font-bold text-muted uppercase tracking-widest">{selectedGroup.members.length} joueurs actifs</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                {isAdmin && (
                                    <button onClick={() => setIsInviteOpen(true)} className="flex-1 sm:flex-none bg-primary text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-sm">Inviter</button>
                                )}
                                <button onClick={() => handleKickOrLeave(user.uid)} className="flex-1 sm:flex-none text-[10px] font-black uppercase tracking-widest text-danger border border-danger/20 bg-danger/5 px-4 py-2.5 rounded-xl hover:bg-danger/10">Quitter</button>
                            </div>
                        </div>

                        <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4">Membres du groupe</h3>
                        
                        <div className="grid gap-3 overflow-y-auto custom-scrollbar pr-1">
                            {groupMembersData.map(member => {
                                const isMemberAdmin = selectedGroup.admins.includes(member.uid);
                                return (
                                    <div key={member.uid} className="flex flex-col p-4 bg-background rounded-2xl border border-border hover:border-primary/20 transition-all gap-4">
                                        
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-secondary border border-border shrink-0 overflow-hidden relative shadow-sm">
                                                    {member.photoURL && <Image src={member.photoURL} alt="" fill className="object-cover" sizes="40px" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-sm text-foreground truncate tracking-tight">{member.displayName}</p>
                                                    <p className="text-[10px] text-primary font-black uppercase tracking-tighter">@{member.username}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Bouton Chat ajouté par membre */}
                                                {member.uid !== user.uid && (
                                                    <button 
                                                        onClick={() => handleOpenChat(member.uid, member.displayName)}
                                                        className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full transition-colors"
                                                        title="Envoyer un message"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {isMemberAdmin && <span className="text-[8px] bg-primary/20 text-primary px-2 py-1 rounded-lg font-black uppercase tracking-widest">Admin</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link href={`/user/${member.uid}`} className="flex-1 text-center text-[10px] bg-secondary text-foreground py-2 rounded-xl font-black uppercase tracking-tighter border border-border/50">Voir</Link>
                                            <Link href={`/trades/new/${member.uid}`} className="flex-1 text-center text-[10px] bg-primary/10 text-primary py-2 rounded-xl font-black uppercase tracking-tighter border border-primary/20">Échanger</Link>
                                            
                                            {isAdmin && member.uid !== user.uid && (
                                                <div className="flex gap-1 shrink-0">
                                                    {!isMemberAdmin && (
                                                        <button onClick={() => handlePromote(member.uid)} className="p-2 text-muted hover:text-primary transition-colors" title="Promouvoir"><Shield className="w-4 h-4" /></button>
                                                    )}
                                                    <button onClick={() => handleKickOrLeave(member.uid)} className="p-2 text-muted hover:text-danger transition-colors" title="Exclure"><X className="w-4 h-4" /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <Users className="w-12 h-12 text-muted/20 mb-4" />
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Sélectionnez un groupe pour voir les membres</p>
                    </div>
                )}
            </div>

            {/* MODALE INVITATION */}
            {isInviteOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md" onClick={() => setIsInviteOpen(false)}>
                    <div className="bg-surface p-6 rounded-3xl max-w-sm w-full shadow-2xl border border-border animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black text-lg text-foreground uppercase tracking-tighter mb-4">Inviter un ami</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                            {friends.filter(f => !selectedGroup?.members.includes(f.uid)).map(friend => (
                                <div key={friend.uid} className="flex justify-between items-center p-3 bg-background rounded-xl border border-border">
                                    <span className="text-xs font-bold text-foreground truncate mr-2">@{friend.username}</span>
                                    <button onClick={() => handleInvite(friend.uid)} className="text-[10px] bg-primary text-white px-4 py-2 rounded-lg font-black uppercase tracking-widest shrink-0">Ajouter</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setIsInviteOpen(false)} className="mt-4 w-full text-[10px] font-black text-muted uppercase tracking-widest py-2">Fermer</button>
                    </div>
                </div>
            )}
        </main>
    );
}