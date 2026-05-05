import React, { useEffect, useState } from 'react';
import { BoardSize, BOARD_CONFIG, GameMode } from '../lib/constants';
import {
  Calendar,
  ChevronRight,
  Clock,
  Gamepad2,
  Maximize2,
  Minimize2,
  Play,
  Square,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { getScores, LeaderboardEntry } from '../lib/leaderboard';

interface StartScreenProps {
  onStart: () => void;
  onShowLeaderboard: () => void;
  mode: GameMode;
  setMode: (m: GameMode) => void;
  size: BoardSize;
  setSize: (s: BoardSize) => void;
}

const modeOptions = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Balanced arcade pace',
    Icon: Target,
  },
  {
    id: 'chill',
    label: 'Chill',
    description: 'Relaxed practice run',
    Icon: Clock,
  },
  {
    id: 'speed',
    label: 'Speed',
    description: 'Fast and risky',
    Icon: Zap,
  },
] satisfies Array<{
  id: GameMode;
  label: string;
  description: string;
  Icon: typeof Target;
}>;

const boardOptions = [
  {
    id: 'small',
    label: 'Small',
    description: 'Tight turns',
    Icon: Minimize2,
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Arcade default',
    Icon: Square,
  },
  {
    id: 'large',
    label: 'Large',
    description: 'Long chases',
    Icon: Maximize2,
  },
] satisfies Array<{
  id: BoardSize;
  label: string;
  description: string;
  Icon: typeof Target;
}>;

const formatScoreDate = (date: string) => {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return 'Recent';
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getRankTone = (index: number) => {
  if (index === 0) return 'is-gold';
  if (index === 1) return 'is-silver';
  if (index === 2) return 'is-bronze';
  return '';
};

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart, onShowLeaderboard, mode, setMode, size, setSize
}) => {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScores(10).then(data => {
      setScores(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="snake-rush-menu absolute inset-0 z-30 overflow-y-auto">
      <div className="snake-rush-trail" aria-hidden="true">
        <svg viewBox="0 0 1200 760" preserveAspectRatio="none">
          <path d="M-40 528 C 155 430 256 672 438 546 S 650 250 836 336 1012 534 1244 352" />
        </svg>
      </div>

      <div className="snake-rush-menu__inner">
        <section className="snake-rush-hero" aria-labelledby="snake-rush-title">
          <div className="snake-rush-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <i />
          </div>

          <div className="snake-rush-hero__copy">
            <div className="snake-rush-kicker">
              <Gamepad2 size={15} />
              Neon arcade run
            </div>
            <h1 id="snake-rush-title" className="snake-rush-title">
              <span>Snake</span>
              <span>Rush</span>
            </h1>
            <p className="snake-rush-subtitle">High-speed arcade snake with online scores</p>
          </div>
        </section>

        <div className="snake-rush-menu__grid">
          <section className="snake-setup-card snake-card" aria-label="Game setup">
            <div className="snake-card__header">
              <div>
                <p className="snake-card__eyebrow">Setup</p>
                <h2>Choose your run</h2>
              </div>
              <div className="snake-card__status">Ready</div>
            </div>

            <div className="snake-setting-group">
              <div className="snake-setting-label">
                <span>Game Mode</span>
                <small>{modeOptions.find((option) => option.id === mode)?.description}</small>
              </div>

              <div className="snake-mode-grid" role="group" aria-label="Game mode">
                {modeOptions.map((option) => {
                  const Icon = option.Icon;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMode(option.id)}
                      aria-pressed={mode === option.id}
                      className={`snake-mode-option ${mode === option.id ? 'is-selected' : ''}`}
                    >
                      <Icon size={22} aria-hidden="true" />
                      <span>{option.label}</span>
                      <small>{option.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="snake-setting-group">
              <div className="snake-setting-label">
                <span>Board Size</span>
                <small>
                  {BOARD_CONFIG[size].cols} x {BOARD_CONFIG[size].rows} grid
                </small>
              </div>

              <div className="snake-size-grid" role="group" aria-label="Board size">
                {boardOptions.map((option) => {
                  const Icon = option.Icon;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSize(option.id)}
                      aria-pressed={size === option.id}
                      className={`snake-size-option ${size === option.id ? 'is-selected' : ''}`}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{option.label}</span>
                      <small>
                        {BOARD_CONFIG[option.id].cols} x {BOARD_CONFIG[option.id].rows}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="snake-start-panel">
              <button
                type="button"
                onClick={onStart}
                className="snake-start-button"
              >
                <Play size={22} fill="currentColor" aria-hidden="true" />
                <span>Start Game</span>
              </button>

              <div className="snake-run-summary" aria-live="polite">
                <span>{mode}</span>
                <span>{size}</span>
                <span>{BOARD_CONFIG[size].cols * BOARD_CONFIG[size].rows} tiles</span>
              </div>
            </div>
          </section>

          <aside className="snake-leaderboard-card snake-card" aria-label="Top 10 scores">
            <div className="snake-card__header snake-card__header--leaderboard">
              <div>
                <p className="snake-card__eyebrow">Arcade Board</p>
                <h2>Top 10 Scores</h2>
              </div>
              <Trophy size={28} aria-hidden="true" />
            </div>

            <div className="snake-leaderboard-list custom-scrollbar">
              {loading ? (
                <div className="snake-empty-state">Loading scores...</div>
              ) : scores.length === 0 ? (
                <div className="snake-empty-state">
                  <Trophy size={26} aria-hidden="true" />
                  <span>No scores yet. Be the first!</span>
                </div>
              ) : (
                scores.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`snake-score-row ${getRankTone(idx)}`}
                    style={{
                      animationDelay: `${Math.min(idx * 0.045, 0.4)}s`,
                    }}
                  >
                    <div className="snake-score-rank">#{idx + 1}</div>

                    <div className="snake-score-player">
                      <span>{entry.name}</span>
                      <div>
                        <small className="capitalize">
                          {entry.gameMode === 'classic' && <Target size={11} aria-hidden="true" />}
                          {entry.gameMode === 'chill' && <Clock size={11} aria-hidden="true" />}
                          {entry.gameMode === 'speed' && <Zap size={11} aria-hidden="true" />}
                          {entry.gameMode}
                        </small>
                        {entry.boardSize && <small className="capitalize">{entry.boardSize}</small>}
                        <small>
                          <Calendar size={11} aria-hidden="true" />
                          {formatScoreDate(entry.date)}
                        </small>
                      </div>
                    </div>

                    <div className="snake-score-value">
                      <span>{entry.score}</span>
                      <small>pts</small>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={onShowLeaderboard}
              className="snake-secondary-button"
            >
              <span>View Full Leaderboard</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};
