export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  date: string;
  gameMode: string;
};

const STORAGE_KEY = 'snake_rush_leaderboard';

// Structure to easily swap to Firebase later:
// - getScores: fetches top N from "DB"
// - addScore: adds a row to "DB"

export const getScores = async (limit?: number): Promise<LeaderboardEntry[]> => {
  // Simulate network delay
  await new Promise(res => setTimeout(res, 100));
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data) as LeaderboardEntry[];
    parsed.sort((a, b) => b.score - a.score);
    return limit ? parsed.slice(0, limit) : parsed;
  } catch (err) {
    console.error('Failed to parse leaderboard', err);
    return [];
  }
};

export const addScore = async (
  name: string,
  score: number,
  gameMode: string
): Promise<void> => {
  // Simulate network delay
  await new Promise(res => setTimeout(res, 100));
  
  const entry: LeaderboardEntry = {
    id: Date.now().toString(),
    name: name.trim().slice(0, 15) || 'Anonymous',
    score,
    date: new Date().toISOString(),
    gameMode,
  };

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const parsed = existing ? JSON.parse(existing) : [];
    const updated = [...parsed, entry];
    // Sort and keep top 50 in local storage so it doesn't grow infinitely
    updated.sort((a, b) => b.score - a.score);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch (err) {
    console.error('Failed to save score', err);
  }
};
