import React, { useEffect, useRef, useState } from 'react';
import { addScore } from '../lib/leaderboard';
import { GameMode } from '../lib/constants';
import { BadgeCheck, Home, Loader2, RotateCcw, Trophy } from 'lucide-react';
import { usePlayerIdentity } from '../../../hooks/usePlayerIdentity';

interface GameOverScreenProps {
  score: number;
  highScore: number;
  gameMode: GameMode;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, highScore, gameMode, onRestart, onMainMenu }) => {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveStartedRef = useRef(false);
  const { playerName, playerId, isGuest } = usePlayerIdentity();

  useEffect(() => {
    if (score <= 0 || saveStartedRef.current) return;

    saveStartedRef.current = true;
    setSaving(true);
    setSaveError(null);

    addScore(playerName, score, gameMode, playerId, isGuest)
      .then(() => setSubmitted(true))
      .catch((error) => {
        console.error('Failed to save Snake Rush score:', error);
        setSaveError('Score could not be saved. You can still play again.');
      })
      .finally(() => setSaving(false));
  }, [gameMode, isGuest, playerId, playerName, score]);

  return (
    <div className="snake-gameover-overlay">
      <div className="snake-gameover-card">
        <div className="snake-gameover-header">
          <p className="snake-card__eyebrow">Run Complete</p>
          <h2>Game Over</h2>
          <span className="capitalize">{gameMode} mode</span>
        </div>

        <div className="snake-gameover-score-grid">
          <div className="snake-gameover-score snake-gameover-score--final">
            <span>Final Score</span>
            <strong>{score}</strong>
          </div>
          <div className="snake-gameover-score">
            <span>
              <Trophy size={14} aria-hidden="true" />
              High Score
            </span>
            <strong>{highScore}</strong>
          </div>
        </div>

        {score > 0 && saving && (
          <div className="snake-score-saved">
            <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            <span>Saving as {playerName}</span>
          </div>
        )}

        {score > 0 && submitted && (
          <div className="snake-score-saved">
            <BadgeCheck size={18} aria-hidden="true" />
            <span>Saved as {playerName}</span>
          </div>
        )}

        {saveError && <div className="snake-score-error">{saveError}</div>}

        <div className="snake-gameover-actions">
          <button 
            type="button"
            onClick={onRestart}
            className="snake-start-button"
          >
            <RotateCcw size={20} aria-hidden="true" />
            <span>Play Again</span>
          </button>
          <button 
            type="button"
            onClick={onMainMenu}
            className="snake-secondary-button"
          >
            <Home size={17} aria-hidden="true" />
            <span>Main Menu</span>
          </button>
        </div>

      </div>
    </div>
  );
};
