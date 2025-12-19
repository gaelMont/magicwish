// hooks/useChat.ts
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase'; // Vérifiez bien ce chemin vers votre config client
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Message } from '@/lib/types/chat';

export function useChat(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Référence à la sous-collection : chats/{chatId}/messages
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        setMessages(msgs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erreur Firestore Chat:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  return { messages, loading, error };
}