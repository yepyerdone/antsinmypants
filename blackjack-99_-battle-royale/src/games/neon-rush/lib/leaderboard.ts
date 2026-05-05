import { addDoc, collection, getDocs, limit as queryLimit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export type NeonRushLeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  distance: number;
  gems: number;
  playerId?: string | null;
  createdAt?: string;
};

export const NEON_RUSH_COLLECTION = 'neon_rush_leaderboard';

export async function getNeonRushScores(limit = 10): Promise<NeonRushLeaderboardEntry[]> {
  const scoresQuery = query(collection(db, NEON_RUSH_COLLECTION), orderBy('score', 'desc'), queryLimit(limit));
  const snapshot = await getDocs(scoresQuery);

  return snapshot.docs.map((scoreDoc) => {
    const data = scoreDoc.data();
    const createdAt = data.createdAt;

    return {
      id: scoreDoc.id,
      name: typeof data.name === 'string' ? data.name : 'Player',
      score: typeof data.score === 'number' ? data.score : 0,
      distance: typeof data.distance === 'number' ? data.distance : 0,
      gems: typeof data.gems === 'number' ? data.gems : 0,
      playerId: typeof data.playerId === 'string' ? data.playerId : null,
      createdAt: typeof createdAt?.toDate === 'function' ? createdAt.toDate().toISOString() : undefined,
    };
  });
}

export async function addNeonRushScore(name: string, score: number, distance: number, gems: number) {
  const cleanScore = Math.floor(score);
  if (cleanScore <= 0) {
    throw new Error('Finish a run with a score before submitting.');
  }

  await addDoc(collection(db, NEON_RUSH_COLLECTION), {
    name: name.trim().slice(0, 16) || 'Runner',
    score: cleanScore,
    distance: Math.floor(distance),
    gems: Math.floor(gems),
    playerId: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });
}
