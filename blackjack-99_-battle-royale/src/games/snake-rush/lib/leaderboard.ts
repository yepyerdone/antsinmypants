import { db, auth, signInAnonymously } from '../../../lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit as queryLimit,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  date: string;
  gameMode: string;
  boardSize?: string;
  playerId?: string | null;
  isGuest?: boolean;
};

const STORAGE_KEY = 'snake_rush_leaderboard';
const COLLECTION_NAME = 'snake_rush_leaderboard';

const fallbackDelay = () => new Promise((resolve) => setTimeout(resolve, 100));

async function ensureAnonymousAuth() {
  if (auth.currentUser) return;
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.warn('Anonymous Firebase auth failed:', error);
  }
}

export const getScores = async (limit?: number): Promise<LeaderboardEntry[]> => {
  await fallbackDelay();

  try {
    await ensureAnonymousAuth();
    const topN = limit ?? 100;
    const scoresQuery = query(
      collection(db, COLLECTION_NAME),
      orderBy('score', 'desc'),
      queryLimit(topN)
    );

    const snapshot = await getDocs(scoresQuery);
    const results = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;
      return {
        id: doc.id,
        name: typeof data.name === 'string' ? data.name : 'Anonymous',
        score: typeof data.score === 'number' ? data.score : 0,
        date: createdAt instanceof Date
          ? createdAt.toISOString()
          : typeof createdAt?.toDate === 'function'
            ? createdAt.toDate().toISOString()
            : new Date().toISOString(),
        gameMode: typeof data.gameMode === 'string' ? data.gameMode : 'classic',
        boardSize: typeof data.boardSize === 'string' ? data.boardSize : undefined,
        playerId: typeof data.playerId === 'string' ? data.playerId : null,
        isGuest: typeof data.isGuest === 'boolean' ? data.isGuest : undefined,
      } as LeaderboardEntry;
    });

    return results.filter((entry) => Boolean(entry.playerId) && !entry.isGuest);
  } catch (error) {
    console.error('Failed to load leaderboard from Firebase, falling back to localStorage:', error);
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data) as LeaderboardEntry[];
      parsed.sort((a, b) => b.score - a.score);
      return limit ? parsed.slice(0, limit) : parsed;
    } catch (err) {
      console.error('Failed to parse local leaderboard fallback', err);
      return [];
    }
  }
};

export const addScore = async (
  name: string,
  score: number,
  gameMode: string,
  playerId?: string | null,
  isGuest?: boolean
): Promise<void> => {
  await fallbackDelay();
  if (isGuest || !playerId) return;

  const entry: LeaderboardEntry = {
    id: Date.now().toString(),
    name: name.trim().slice(0, 16) || (isGuest ? 'Guest Player' : 'Player'),
    score,
    date: new Date().toISOString(),
    gameMode,
    playerId: playerId ?? null,
    isGuest: false,
  };

  try {
    await ensureAnonymousAuth();
    await addDoc(collection(db, COLLECTION_NAME), {
      name: entry.name,
      score: entry.score,
      gameMode: entry.gameMode,
      playerId: entry.playerId,
      isGuest: entry.isGuest,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to save leaderboard to Firebase, saving locally instead:', error);
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const parsed = existing ? (JSON.parse(existing) as LeaderboardEntry[]) : [];
      const updated = [...parsed, entry];
      updated.sort((a, b) => b.score - a.score);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
    } catch (err) {
      console.error('Failed to save local leaderboard fallback', err);
    }
  }
};
