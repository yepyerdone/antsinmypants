import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export const ASCENSION_SCORES_COLLECTION = 'the_ascension_scores';

export type AscensionScoreEntry = {
  id: string;
  name: string;
  score: number;
  uid?: string | null;
  createdAt?: unknown;
};

export async function getAscensionScores(maxRows = 10): Promise<AscensionScoreEntry[]> {
  const scoresQuery = query(collection(db, ASCENSION_SCORES_COLLECTION), orderBy('score', 'desc'), limit(maxRows));
  const snapshot = await getDocs(scoresQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      name: String(data.name || 'Player'),
      score: Number(data.score || 0),
      uid: typeof data.uid === 'string' ? data.uid : null,
      createdAt: data.createdAt,
    };
  });
}

export async function submitAscensionScore(input: { name: string; score: number; uid?: string | null }) {
  if (input.score <= 0) {
    throw new Error('Only completed Ascension scores can be submitted.');
  }

  await addDoc(collection(db, ASCENSION_SCORES_COLLECTION), {
    name: input.name.trim().slice(0, 16) || 'Player',
    score: Number(input.score.toFixed(1)),
    uid: input.uid || null,
    createdAt: serverTimestamp(),
  });
}
