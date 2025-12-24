// lib/types.ts
import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isPremium: boolean;         // Statut Premium
  dailyCredits: number;       // Crédits restants aujourd'hui
  lastCreditReset: string;    // Date du dernier reset (format YYYY-MM-DD)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreGroup {
  name: string;
  ownerUid: string;
  members: string[];
  admins: string[];
  createdAt?: unknown;
}

export type ActionResponse = {
  success: boolean;
  error?: string;
  data?: unknown;
};