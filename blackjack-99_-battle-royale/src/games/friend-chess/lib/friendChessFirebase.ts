import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously, signOut, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { app as mainApp, auth as mainAuth, db as mainDb } from '../../../lib/firebase';

const FRIEND_APP_NAME = 'friend-chess';

export type FriendChessClient = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  usesDedicatedFirebase: boolean;
};

function readDedicatedConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FRIEND_CHESS_FIREBASE_API_KEY as string | undefined;
  const projectId = import.meta.env.VITE_FRIEND_CHESS_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    authDomain: (import.meta.env.VITE_FRIEND_CHESS_FIREBASE_AUTH_DOMAIN as string) || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: import.meta.env.VITE_FRIEND_CHESS_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FRIEND_CHESS_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId: import.meta.env.VITE_FRIEND_CHESS_FIREBASE_APP_ID as string | undefined,
  };
}

let cached: FriendChessClient | null = null;

/**
 * Friend Chess Firebase:
 * - If `VITE_FRIEND_CHESS_FIREBASE_API_KEY` and `VITE_FRIEND_CHESS_FIREBASE_PROJECT_ID` are set,
 *   uses a separate named Firebase app (see `.env.example`).
 * - Otherwise reuses the main site Firebase app; chess data must live in `friendChessLobbies` /
 *   `friendChessUsers` collections only.
 */
export function getFriendChessFirebase(): FriendChessClient {
  if (cached) return cached;

  const dedicated = readDedicatedConfig();
  if (dedicated) {
    const existing = getApps().find((a) => a.name === FRIEND_APP_NAME);
    const app = existing ?? initializeApp(dedicated, FRIEND_APP_NAME);
    const dbId = import.meta.env.VITE_FRIEND_CHESS_FIRESTORE_DATABASE_ID as string | undefined;
    const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
    const auth = getAuth(app);
    cached = { app, auth, db, usesDedicatedFirebase: true };
    return cached;
  }

  cached = { app: mainApp, auth: mainAuth, db: mainDb, usesDedicatedFirebase: false };
  return cached;
}

export function signInFriendChessAnonymous() {
  return signInAnonymously(getFriendChessFirebase().auth);
}

export function signOutFriendChess() {
  return signOut(getFriendChessFirebase().auth);
}
