import { doc, getDocFromServer } from 'firebase/firestore';
import { signInWithRedirect } from 'firebase/auth';
import { auth, db, googleProvider, signInWithPopup } from '../../../lib/firebase';

export { auth, db, googleProvider };

export async function signIn() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
}

export const signOut = () => auth.signOut();

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
