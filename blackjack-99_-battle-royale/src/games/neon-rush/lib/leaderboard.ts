import { addDoc, collection, getDocs, limit as queryLimit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

export type SpaceRunnerLeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  distance: number;
  gems: number;
  playerId?: string | null;
  createdAt?: string;
};

export const SPACE_RUNNER_COLLECTION = 'neon_rush_leaderboard';

export async function getSpaceRunnerScores(limit = 10): Promise<SpaceRunnerLeaderboardEntry[]> {
  const scoresQuery = query(collection(db, SPACE_RUNNER_COLLECTION), orderBy('score', 'desc'), queryLimit(limit));
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

export async function addSpaceRunnerScore(name: string, score: number, distance: number, gems: number) {
  const cleanScore = Math.floor(score);
  if (cleanScore <= 0) {
    throw new Error('Finish a run with a score before submitting.');
  }

  await addDoc(collection(db, SPACE_RUNNER_COLLECTION), {
    name: name.trim().slice(0, 16) || 'Pilot',
    score: cleanScore,
    distance: Math.floor(distance),
    gems: Math.floor(gems),
    playerId: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });
}
