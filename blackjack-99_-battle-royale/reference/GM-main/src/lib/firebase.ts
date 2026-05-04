import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, updateProfile } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const signIn = () => signInAnonymously(auth);
export const signOut = () => auth.signOut();
export const setDisplayName = (name: string) => {
  if (auth.currentUser) {
    return updateProfile(auth.currentUser, { displayName: name });
  }
};
