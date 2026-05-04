import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type MolarScore = {
  id?: string;
  playerName: string;
  score: number;
  createdAt?: unknown;
};

const SCORES_COLLECTION = 'molarMadnessScores';

export async function saveMolarScore(playerName: string, score: number) {
  if (!playerName || score <= 0) return;

  await addDoc(collection(db, SCORES_COLLECTION), {
    playerName,
    score,
    createdAt: serverTimestamp(),
  });
}

export async function getTopMolarScores(): Promise<MolarScore[]> {
  const q = query(
    collection(db, SCORES_COLLECTION),
    orderBy('score', 'desc'),
    limit(10)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<MolarScore, 'id'>),
  }));
}
