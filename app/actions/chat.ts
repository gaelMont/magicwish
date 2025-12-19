// app/actions/chat.ts
'use server';

import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Créer ou récupérer une discussion privée entre deux utilisateurs
export async function getOrCreateDirectChat(uid1: string, uid2: string) {
  const db = getAdminFirestore();
  const participants = [uid1, uid2].sort();

  // Chercher si elle existe déjà
  const chatQuery = await db.collection('chats')
    .where('type', '==', 'direct')
    .where('participants', '==', participants)
    .limit(1)
    .get();

  if (!chatQuery.empty) {
    return { success: true, chatId: chatQuery.docs[0].id };
  }

  // Sinon, la créer
  const newChat = await db.collection('chats').add({
    type: 'direct',
    participants,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, chatId: newChat.id };
}

// Envoyer un message
export async function sendMessageAction(chatId: string, senderId: string, senderName: string, text: string) {
  const db = getAdminFirestore();
  
  const messageData = {
    senderId,
    senderName,
    text: text.trim(),
    createdAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  
  // 1. Ajouter le message dans la sous-collection
  const msgRef = db.collection('chats').doc(chatId).collection('messages').doc();
  batch.set(msgRef, messageData);

  // 2. Mettre à jour le dernier message dans le document parent
  const chatRef = db.collection('chats').doc(chatId);
  batch.update(chatRef, {
    lastMessage: messageData
  });

  await batch.commit();
  return { success: true };
}