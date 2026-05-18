import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';

export type GoodBoyLeaderboardEntry = {
  userId: string;
  username: string;
  score: number;
  updatedAt?: unknown;
};

const GOOD_BOY_COLLECTION = 'good_boy_leaderboard';

export function subscribeToGoodBoyLeaderboard(
  callback: (entries: GoodBoyLeaderboardEntry[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, GOOD_BOY_COLLECTION), orderBy('score', 'desc'), limit(10)),
    (snapshot) => callback(snapshot.docs.map((scoreDoc) => scoreDoc.data() as GoodBoyLeaderboardEntry)),
    (error) => handleFirestoreError(error, OperationType.LIST, GOOD_BOY_COLLECTION),
  );
}

export async function saveGoodBoyHighScore(score: number, username: string) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || score <= 0) return;

  const scoreRef = doc(db, GOOD_BOY_COLLECTION, user.uid);

  try {
    const currentScore = await getDoc(scoreRef);
    const previousBest = currentScore.exists()
      ? (currentScore.data() as GoodBoyLeaderboardEntry).score
      : -1;

    if (score <= previousBest) return;

    await setDoc(scoreRef, {
      userId: user.uid,
      username: username.trim() || user.displayName || 'Player',
      score,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${GOOD_BOY_COLLECTION}/${user.uid}`);
  }
}
