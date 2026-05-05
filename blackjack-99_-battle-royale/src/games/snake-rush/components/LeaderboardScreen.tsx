import React, { useEffect, useState } from 'react';
import { getScores, LeaderboardEntry } from '../lib/leaderboard';
import { Trophy, Clock, Zap, Target, Calendar } from 'lucide-react';

interface LeaderboardScreenProps {
  onClose: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onClose }) => {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Calling without limit fetches all scores
    getScores().then(data => {
      setScores(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center gap-3 mb-6 justify-center">
          <Trophy className="text-emerald-400" size={32} />
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Leaderboard</h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 mb-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading scores...</div>
          ) : scores.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white/5 rounded-xl border border-white/5">
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
                style={{
                  animation: `slideIn 0.3s ease-out ${Math.min(idx * 0.05, 1)}s both`
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                    ${idx === 0 ? 'bg-amber-500 text-black' : 
                      idx === 1 ? 'bg-slate-300 text-black' : 
                      idx === 2 ? 'bg-amber-700 text-white' : 
                      'text-slate-400'}`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className={`font-bold ${idx < 3 ? 'text-white' : 'text-slate-200'}`}>
                      {entry.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <div className="flex items-center gap-1 capitalize">
                        {entry.gameMode === 'classic' && <Target size={12} />}
                        {entry.gameMode === 'chill' && <Clock size={12} />}
                        {entry.gameMode === 'speed' && <Zap size={12} />}
                        {entry.gameMode}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(entry.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`text-xl font-mono font-bold ${idx === 0 ? 'text-amber-400' : idx < 3 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {entry.score}
                </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={onClose}
          className="mt-2 w-full py-3 border border-white/20 hover:bg-white/10 text-white rounded-xl font-bold tracking-wide transition-colors uppercase text-sm"
        >
          Close
        </button>

      </div>
    </div>
  );
};
