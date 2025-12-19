// components/chat/ChatWindow.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext'; // Chemin corrigé selon repomix
import { useChat } from '@/hooks/useChat';
import { sendMessageAction } from '@/app/actions/chat';

export default function ChatWindow({ chatId, recipientName }: { chatId: string, recipientName: string }) {
  const { user } = useAuth();
  const { messages, loading } = useChat(chatId);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    const textToSend = inputText;
    setInputText(''); 
    
    // On utilise le displayName du contexte
    const name = user.displayName || "Joueur";
    await sendMessageAction(chatId, user.uid, name, textToSend);
  };

  return (
    <div className="flex flex-col h-[450px] bg-surface border border-border rounded-2xl overflow-hidden shadow-xl mb-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="p-4 border-b border-border bg-secondary/10 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Chat avec {recipientName}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] font-bold text-muted uppercase">Canal sécurisé...</span>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-[11px] font-bold shadow-sm ${
                  isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-background border border-border text-foreground rounded-tl-none'
                }`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 bg-background border-t border-border flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Écrire un message..."
          className="flex-1 p-2.5 bg-secondary/20 border border-border rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-primary"
        />
        <button type="submit" className="bg-primary text-white px-4 rounded-xl font-black text-[10px] uppercase transition-transform active:scale-95">
          OK
        </button>
      </form>
    </div>
  );
}