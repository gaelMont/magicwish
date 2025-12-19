// app/actions/chat.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function getOrCreateDirectChat(uid1: string, uid2: string) {
  const db = getAdminFirestore();
  const participants = [uid1, uid2].sort();

  try {
    const chatsRef = db.collection('chats');
    
    // On cherche un chat existant avec ces exacts participants
    const q = await chatsRef
      .where('type', '==', 'direct')
      .where('participants', '==', participants)
      .limit(1)
      .get();

    if (!q.empty) {
      return { success: true, chatId: q.docs[0].id };
    }

    // CRUCIAL : On crée le document avec le champ 'participants'
    // sinon les Security Rules bloqueront la lecture côté client.
    const newChat = await chatsRef.add({
      type: 'direct',
      participants: participants, 
      createdAt: FieldValue.serverTimestamp(),
      lastMessage: null
    });

    return { success: true, chatId: newChat.id };
  } catch (error) {
    console.error("Erreur action chat:", error);
    return { success: false };
  }
}

export async function sendMessageAction(chatId: string, senderId: string, senderName: string, text: string) {
  const db = getAdminFirestore();
  
  try {
    const chatRef = db.collection('chats').doc(chatId);
    const msgRef = chatRef.collection('messages').doc();

    const messageData = {
      senderId,
      senderName,
      text: text.trim(),
      createdAt: FieldValue.serverTimestamp(),
    };

    const batch = db.batch();
    batch.set(msgRef, messageData);
    // On met à jour le parent pour les listes de discussion
    batch.update(chatRef, { lastMessage: messageData });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Erreur envoi message:", error);
    return { success: false };
  }
}