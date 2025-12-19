// lib/types/chat.ts
import { FieldValue, Timestamp } from 'firebase/firestore';

export type ChatType = 'direct' | 'group';

export interface Chat {
  id: string;
  type: ChatType;
  participants: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: Timestamp | FieldValue;
  };
  playgroupId?: string; // Optionnel : lien avec un playgroup
  createdAt: Timestamp | FieldValue;
}

export interface Message {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Timestamp | FieldValue;
}