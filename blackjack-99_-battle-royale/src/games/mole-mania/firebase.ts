import { signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from '../../lib/firebase';

export { auth, db };

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google: ', error);
    throw error;
  }
};
