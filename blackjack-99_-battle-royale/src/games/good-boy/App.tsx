import { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Game } from './game.ts';
import {
  saveGoodBoyHighScore,
  subscribeToGoodBoyLeaderboard,
  type GoodBoyLeaderboardEntry,
} from './leaderboard';
import './good-boy.css';

export default function GoodBoy() {
  const { displayName } = useAuth();
  const gameRef = useRef<Game | null>(null);
  const [leaderboard, setLeaderboard] = useState<GoodBoyLeaderboardEntry[]>([]);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const handleGameOver = useCallback((score: number) => {
    setLastScore(score);
    void saveGoodBoyHighScore(score, displayName);
  }, [displayName]);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Game('game-canvas', handleGameOver);
    }
  }, [handleGameOver]);

  useEffect(() => subscribeToGoodBoyLeaderboard(setLeaderboard), []);

  return (
    <div className="good-boy-page">
      <div className="good-boy-layout">
        <div id="game-container">
          <canvas id="game-canvas" />
        </div>

        <aside className="good-boy-leaderboard" aria-label="Good Boy leaderboard">
          <div className="good-boy-leaderboard-title">
            <Trophy size={20} />
            <h2>Leaderboard</h2>
          </div>

          {lastScore !== null && (
            <p className="good-boy-last-score">
              Last run <strong>{lastScore.toLocaleString()}</strong>
            </p>
          )}

          <ol>
            {leaderboard.map((entry, index) => (
              <li key={entry.userId}>
                <span>{index + 1}</span>
                <strong>{entry.username}</strong>
                <em>{entry.score.toLocaleString()}</em>
              </li>
            ))}
          </ol>

          {leaderboard.length === 0 && <p className="good-boy-empty">No scores yet.</p>}
        </aside>
      </div>
    </div>
  );
}
