import React, { useState } from 'react';
import './index.css';
import { useSnakeGame } from './hooks/useSnakeGame';
import { useAudio } from './hooks/useAudio';
import { GameBoard } from './components/GameBoard';
import { MobileControls } from './components/MobileControls';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { GameMode, BoardSize } from './lib/constants';
import { Activity, Gauge, Grid3X3, Pause, Trophy, Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<GameMode>('classic');
  const [size, setSize] = useState<BoardSize>('medium');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const { playSound, soundEnabled, toggleSound } = useAudio();

  const {
    gameState,
    countdown,
    snake,
    food,
    score,
    highScore,
    startGame,
    togglePause,
    boardConfig,
    changeDirection,
    setGameState,
    currentSpeed,
    direction
  } = useSnakeGame(mode, size, playSound);

  const level = Math.floor(score / 50) + 1;
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
  const sizeLabel = size.charAt(0).toUpperCase() + size.slice(1);
  const pointsToRecord = Math.max(highScore - score, 0);

  return (
    <div className="snake-rush-root min-h-screen text-white flex flex-col items-center justify-center p-4 overflow-hidden relative selection:bg-emerald-500/30">
      <div className="snake-game-backdrop" aria-hidden="true">
        <svg viewBox="0 0 1200 760" preserveAspectRatio="none">
          <path d="M-80 232 C 142 124 304 326 470 218 S 696 84 864 190 1040 352 1280 206" />
          <path d="M-120 642 C 118 540 252 698 440 596 S 674 378 866 466 1018 622 1280 488" />
        </svg>
      </div>

      {gameState !== 'START' && (
        <section className="snake-game-shell" aria-label="Snake Rush gameplay">
          <div className="snake-game-machine">
            <header className="snake-game-hud">
              <div className="snake-hud-stat snake-hud-stat--primary">
                <span className="snake-hud-label">
                  <Activity size={15} aria-hidden="true" />
                  Score
                </span>
                <strong>{score}</strong>
                <small>Level {level}</small>
              </div>

              <div className="snake-hud-center">
                <div className="snake-hud-logo">
                  <span>Snake</span>
                  <span>Rush</span>
                </div>
                <div className="snake-hud-pills" aria-label="Current run settings">
                  <span>
                    <Gauge size={13} aria-hidden="true" />
                    {modeLabel}
                  </span>
                  <span>
                    <Grid3X3 size={13} aria-hidden="true" />
                    {sizeLabel} {boardConfig.cols}x{boardConfig.rows}
                  </span>
                  <span>Lvl {level}</span>
                </div>
              </div>

              <div className="snake-hud-stat snake-hud-stat--high">
                <span className="snake-hud-label">
                  <Trophy size={15} aria-hidden="true" />
                  High
                </span>
                <strong>{highScore}</strong>
                <small>{pointsToRecord > 0 ? `${pointsToRecord} to beat` : 'Record pace'}</small>
              </div>
            </header>

            <div className="snake-board-stage">
              <GameBoard
                 snake={snake}
                 food={food}
                 boardSize={size}
                 gameState={gameState}
                 currentSpeed={currentSpeed}
                 direction={direction}
                 score={score}
              />

              {gameState === 'COUNTDOWN' && (
                <div className="snake-countdown-overlay">
                  <span>{countdown}</span>
                </div>
              )}

              {gameState === 'PAUSED' && (
                <div className="snake-pause-overlay">
                  <div className="snake-pause-card">
                    <span className="snake-overlay-kicker">
                      <Pause size={15} aria-hidden="true" />
                      Run held
                    </span>
                    <strong>Paused</strong>
                    <button
                      type="button"
                      onClick={togglePause}
                      className="snake-overlay-button"
                    >
                      Resume
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'COUNTDOWN') && (
             <MobileControls onDirectionChange={changeDirection} />
          )}
        </section>
      )}

      {/* Screens */}
      {gameState === 'START' && (
        <StartScreen 
          mode={mode} setMode={setMode} 
          size={size} setSize={setSize} 
          onStart={startGame} 
          onShowLeaderboard={() => setShowLeaderboard(true)} 
        />
      )}

      {gameState === 'GAMEOVER' && (
        <GameOverScreen 
          score={score}
          highScore={highScore}
          gameMode={mode}
          onRestart={startGame}
          onMainMenu={() => setGameState('START')}
        />
      )}

      {showLeaderboard && (
        <LeaderboardScreen onClose={() => setShowLeaderboard(false)} />
      )}

      {/* Global Controls (Sound, Pause) */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button 
          onClick={toggleSound}
          className="snake-sound-button"
          title="Toggle Sound"
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

    </div>
  );
}
