import { signInAnonymously, signOut } from 'firebase/auth';
import { app, auth, db } from '../../../lib/firebase';

/**
 * Friend Chess uses the same Firebase app, Auth, and Firestore as the rest of the site.
 * Data is isolated by collection names: `friendChessLobbies`, `friendChessUsers`.
 */

export type FriendChessClient = {
  app: typeof app;
  auth: typeof auth;
  db: typeof db;
};

export function getFriendChessFirebase(): FriendChessClient {
  return { app, auth, db };
}

export function signInFriendChessAnonymous() {
  return signInAnonymously(auth);
}

export function signOutFriendChess() {
  return signOut(auth);
}
