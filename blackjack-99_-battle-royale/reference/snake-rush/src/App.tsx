import React, { useState } from 'react';
import { useSnakeGame } from './hooks/useSnakeGame';
import { useAudio } from './hooks/useAudio';
import { GameBoard } from './components/GameBoard';
import { MobileControls } from './components/MobileControls';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { GameMode, BoardSize } from './lib/constants';
import { Volume2, VolumeX, Trophy } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 overflow-hidden relative selection:bg-emerald-500/30">
      
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ background: 'radial-gradient(circle at 50% -20%, rgba(52, 211, 153, 0.2) 0%, transparent 70%)' }} />

      {/* Header UI */}
      {gameState !== 'START' && (
        <div className="glass-panel p-6 rounded-2xl w-full max-w-[500px] flex items-center justify-between z-10 mb-6 border-b-0 shadow-lg">
          <div className="flex flex-col">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Score</span>
            <span className="text-3xl font-mono font-black text-white leading-none">{score}</span>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full mb-1 border border-white/5">
              {mode} &bull; {size} &bull; Lvl {Math.floor(score / 50) + 1}
            </span>
          </div>

          <div className="flex flex-col items-end">
             <span className="text-slate-400 flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
               <Trophy size={12}/> High
             </span>
             <span className="text-2xl font-mono font-bold text-emerald-400 leading-none">{highScore}</span>
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <div className="relative z-10 w-full flex flex-col items-center">
        
        {/* The Board */}
        {(gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER' || gameState === 'COUNTDOWN') && (
          <div className="relative w-full max-w-[500px]">
            <GameBoard 
               snake={snake} 
               food={food} 
               boardSize={size} 
               gameState={gameState} 
               currentSpeed={currentSpeed} 
               direction={direction}
               score={score}
            />
            
            {/* Overlays on top of the board */}
            {gameState === 'COUNTDOWN' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm z-20">
                <span className="text-8xl font-black text-white animate-pulse font-mono tracking-tighter">
                  {countdown}
                </span>
              </div>
            )}

            {gameState === 'PAUSED' && (
              <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center rounded-[8px] z-20">
                <span className="text-[64px] font-black text-white tracking-widest mb-4 leading-none">PAUSED</span>
                <button 
                  onClick={togglePause}
                  className="btn-arcade px-8 py-3 rounded-xl font-bold text-white uppercase tracking-wide"
                >
                  Resume
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile Controls */}
        {(gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'COUNTDOWN') && (
           <MobileControls onDirectionChange={changeDirection} />
        )}

      </div>

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
          className="w-10 h-10 glass-panel flex items-center justify-center text-slate-400 hover:text-white transition-colors border-0 shadow-none hover:-translate-y-0.5"
          title="Toggle Sound"
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

    </div>
  );
}
