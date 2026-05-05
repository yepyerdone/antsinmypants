import React, { useEffect, useState } from 'react';
import { GameMode, BoardSize } from '../lib/constants';
import { Target, Clock, Zap, Trophy, Calendar } from 'lucide-react';
import { getScores, LeaderboardEntry } from '../lib/leaderboard';

interface StartScreenProps {
  onStart: () => void;
  onShowLeaderboard: () => void;
  mode: GameMode;
  setMode: (m: GameMode) => void;
  size: BoardSize;
  setSize: (s: BoardSize) => void;
}

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
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start my-auto py-8">
        
        <div className="flex flex-col items-center md:items-stretch">
          {/* Logo/Title */}
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-5xl sm:text-6xl font-black lowercase tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
              <span className="text-emerald-400">snake</span>
              <span className="text-white">rush</span>
            </h1>
            <p className="text-slate-400 uppercase tracking-widest text-xs font-bold mt-2">
              High-Speed Arcade Action
            </p>
          </div>

          {/* Mode Selector */}
          <div className="w-full glass-panel p-6 mb-6">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Game Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['classic', 'chill', 'speed'] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all
                    ${mode === m 
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100' 
                      : 'border-transparent text-slate-300 hover:bg-white/5'
                    }`}
                >
                  {m === 'classic' && <Target size={20} className="mb-1" />}
                  {m === 'chill' && <Clock size={20} className="mb-1" />}
                  {m === 'speed' && <Zap size={20} className="mb-1" />}
                  <span className="text-[10px] sm:text-xs font-bold uppercase">{m}</span>
                </button>
              ))}
            </div>

            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-6">Board Size</label>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'medium', 'large'] as BoardSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-all
                    ${size === s 
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100'  
                      : 'border-transparent text-slate-300 hover:bg-white/5'
                    }`}
                >
                  <span className="text-[10px] sm:text-xs font-bold uppercase">{s}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="w-full space-y-4">
            <button 
              onClick={onStart}
              className="w-full btn-arcade py-4 text-white rounded-2xl font-black tracking-widest text-xl uppercase transition-all shadow-lg active:scale-95 block"
            >
              Start Game
            </button>
            <p className="text-center text-slate-400 text-xs">
              <strong className="text-slate-200">WASD / Arrows</strong> to move &bull; <strong className="text-slate-200">Space</strong> to pause
            </p>
          </div>
        </div>

        {/* Top 10 Leaderboard directly on start screen */}
        <div className="glass-panel p-6 w-full flex flex-col h-full max-h-[600px]">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">Top 10 Scores</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 mb-4">
             {loading ? (
                <div className="text-center py-8 text-slate-400 text-sm">Loading scores...</div>
              ) : scores.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-white/5 rounded-xl border border-white/5">
                   No scores yet. Be the first!
                </div>
              ) : (
                scores.map((entry, idx) => (
                  <div 
                    key={entry.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors
                      ${idx === 0 ? 'bg-amber-500/10 border-amber-500/30' : 
                        idx === 1 ? 'bg-slate-300/10 border-slate-300/30' : 
                        idx === 2 ? 'bg-amber-700/10 border-amber-700/30' : 
                        'bg-white/5 border-transparent hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs
                        ${idx === 0 ? 'bg-amber-500 text-black' : 
                          idx === 1 ? 'bg-slate-300 text-black' : 
                          idx === 2 ? 'bg-amber-700 text-white' : 
                          'text-slate-400'}`}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-bold text-sm ${idx < 3 ? 'text-white' : 'text-slate-200'}`}>
                          {entry.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                           <span className="flex items-center gap-0.5 capitalize">
                             {entry.gameMode === 'classic' && <Target size={10} />}
                             {entry.gameMode === 'chill' && <Clock size={10} />}
                             {entry.gameMode === 'speed' && <Zap size={10} />}
                             {entry.gameMode}
                           </span>
                           <span className="flex items-center gap-0.5">
                             <Calendar size={10} />
                             {new Date(entry.date).toLocaleDateString()}
                           </span>
                        </div>
                      </div>
                    </div>
                    <div className={`font-mono font-bold ${idx === 0 ? 'text-amber-400 text-lg' : idx < 3 ? 'text-emerald-400 text-base' : 'text-slate-300 text-sm'}`}>
                      {entry.score}
                    </div>
                  </div>
                ))
              )}
          </div>
          
          <button 
            onClick={onShowLeaderboard}
            className="w-full py-3 text-white border border-white/20 hover:bg-white/10 rounded-xl font-bold tracking-wide uppercase transition-colors text-sm"
          >
            View Full Leaderboard
          </button>
        </div>

      </div>
    </div>
  );
};
