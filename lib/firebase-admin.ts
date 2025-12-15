// lib/firebase-admin.ts
import 'server-only';
import * as admin from 'firebase-admin';

// Fonction pour nettoyer la clé privée (problème fréquent avec les variables d'env)
function formatPrivateKey(key: string) {
  return key.replace(/\\n/g, '\n');
}

function initAdmin() {
  // On vérifie si une instance existe déjà pour éviter les erreurs de hot-reload
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY || ""),
      }),
    });
  }
}

export function getAdminFirestore() {
  initAdmin();
  return admin.firestore();
}

// NOUVELLE FONCTION EXPORTÉE
export function getAdminAuth() {
  initAdmin();
  return admin.auth();
}