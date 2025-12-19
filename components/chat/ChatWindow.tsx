// components/chat/ChatWindow.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useChat } from '@/hooks/useChat';
import { sendMessageAction } from '@/app/actions/chat';

export default function ChatWindow({ chatId, recipientName }: { chatId: string, recipientName: string }) {
  const { user, username } = useAuth();
  const { messages, loading } = useChat(chatId);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    const textToSend = inputText;
    setInputText(''); // Clear input immédiatement (UI optimiste)
    
    await sendMessageAction(chatId, user.uid, username || 'Anonyme', textToSend);
  };

  return (
    <div className="flex flex-col h-[500px] bg-surface border border-border rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
        <h3 className="font-bold text-foreground">Discussion avec {recipientName}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {loading ? (
          <p className="text-center text-muted text-sm italic">Chargement...</p>
        ) : messages.map((msg, i) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-foreground rounded-tl-none border border-border'
              }`}>
                {!isMe && <p className="text-[10px] font-bold mb-1 opacity-70">{msg.senderName}</p>}
                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Écrivez votre message..."
          className="flex-1 p-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Envoyer</button>
      </form>
    </div>
  );
}