import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  setDoc, 
  doc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  updatedAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const subscribeToLeaderboard = (callback: (entries: LeaderboardEntry[]) => void) => {
  const q = query(collection(db, 'tachymetry_leaderboard'), orderBy('score', 'desc'), limit(10));
  
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => doc.data() as LeaderboardEntry);
    callback(entries);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'leaderboard');
  });
};

export const saveHighScore = async (score: number) => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const userDocRef = doc(db, 'tachymetry_leaderboard', user.uid);
  
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const existingData = docSnap.data() as LeaderboardEntry;
      if (score > existingData.score) {
        await setDoc(userDocRef, {
          userId: user.uid,
          username: user.displayName || 'Anonymous',
          score: score,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } else {
      await setDoc(userDocRef, {
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        score: score,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tachymetry_leaderboard/${user.uid}`);
  }
};

export const getUserHighScore = async (userId: string): Promise<number> => {
    try {
        const docSnap = await getDoc(doc(db, 'tachymetry_leaderboard', userId));
        if (docSnap.exists()) {
            return (docSnap.data() as LeaderboardEntry).score;
        }
        return 0;
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, `tachymetry_leaderboard/${userId}`);
        return 0;
    }
};
