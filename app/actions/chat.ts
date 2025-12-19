// app/actions/chat.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function getOrCreateDirectChat(uid1: string, uid2: string) {
  const db = getAdminFirestore();
  const participants = [uid1, uid2].sort();

  try {
    const chatsRef = db.collection('chats');
    const q = await chatsRef
      .where('type', '==', 'direct')
      .where('participants', '==', participants)
      .limit(1)
      .get();

    if (!q.empty) {
      return { success: true, chatId: q.docs[0].id };
    }

    // Création du document parent avec les participants
    const newChatRef = await chatsRef.add({
      type: 'direct',
      participants,
      createdAt: FieldValue.serverTimestamp(),
      lastMessage: null
    });

    return { success: true, chatId: newChatRef.id };
  } catch (error) {
    console.error("Action getOrCreateDirectChat Error:", error);
    return { success: false, error: "Erreur création chat" };
  }
}

export async function sendMessageAction(chatId: string, senderId: string, senderName: string, text: string) {
  const db = getAdminFirestore();
  
  try {
    const messageData = {
      senderId,
      senderName,
      text: text.trim(),
      createdAt: FieldValue.serverTimestamp(),
    };

    const batch = db.batch();
    const chatRef = db.collection('chats').doc(chatId);
    const msgRef = chatRef.collection('messages').doc();

    batch.set(msgRef, messageData);
    batch.update(chatRef, { lastMessage: messageData });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Action sendMessage Error:", error);
    return { success: false };
  }
}