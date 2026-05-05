import React, { useState } from 'react';
import { addScore } from '../lib/leaderboard';
import { GameMode } from '../lib/constants';

interface GameOverScreenProps {
  score: number;
  gameMode: GameMode;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, gameMode, onRestart, onMainMenu }) => {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitted) return;
    
    setSaving(true);
    await addScore(name, score, gameMode);
    setSaving(false);
    setSubmitted(true);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-panel p-8 rounded-2xl w-full max-w-md shadow-2xl flex flex-col items-center">
        
        <h2 className="text-4xl font-black text-red-500 mb-2 uppercase tracking-tight">Game Over</h2>
        
        <div className="text-center mb-8">
          <div className="text-slate-400 text-lg uppercase tracking-widest text-xs mb-1">Final Score</div>
          <div className="text-6xl font-mono font-bold text-white">{score}</div>
        </div>

        {score > 0 && !submitted && (
          <form onSubmit={handleSubmit} className="w-full mb-8 space-y-3">
            <label className="block text-sm font-medium text-slate-300 uppercase text-center tracking-wide">
              New High Score! Enter Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                maxLength={15}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Player 1"
                className="flex-1 bg-black/30 border-2 border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-white font-bold outline-none transition-colors"
                disabled={saving}
              />
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="btn-arcade disabled:opacity-50 text-white px-6 font-bold rounded-xl transition-colors uppercase text-sm"
              >
                {saving ? '...' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {submitted && (
          <div className="mb-8 text-emerald-400 font-bold bg-emerald-500/10 px-6 py-3 rounded-xl w-full text-center border border-emerald-500/20">
            Score Saved!
          </div>
        )}

        <div className="w-full space-y-3">
          <button 
            onClick={onRestart}
            className="w-full py-4 btn-arcade text-white rounded-xl font-black tracking-widest text-lg uppercase transition-transform active:scale-95"
          >
            Play Again
          </button>
          <button 
            onClick={onMainMenu}
            className="w-full py-3 border border-white/20 text-white hover:bg-white/10 rounded-xl font-bold tracking-wide uppercase transition-colors"
          >
            Main Menu
          </button>
        </div>

      </div>
    </div>
  );
};
