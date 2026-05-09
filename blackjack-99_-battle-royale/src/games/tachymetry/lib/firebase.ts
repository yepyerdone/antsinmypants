import { signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider, testConnection } from '../../../lib/firebase';

export { auth, db, googleProvider };

export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error("Error signing in with Google", error);
        return null;
    }
};

testConnection();
