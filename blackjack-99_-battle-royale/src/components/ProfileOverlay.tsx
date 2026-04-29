import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Swords, Zap, LogOut, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { getUserStats, UserStats } from '../lib/user';

interface ProfileOverlayProps {
  onClose: () => void;
}

export function ProfileOverlay({ onClose }: ProfileOverlayProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.currentUser) {
      getUserStats(auth.currentUser.uid).then(s => {
        setStats(s);
        setLoading(false);
      });
    }
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    onClose();
    window.location.reload();
  };

  const calculateWinRate = (wins: number, games: number) => {
    if (games === 0) return '0%';
    return `${Math.round((wins / games) * 100)}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg bg-bg-accent rounded-3xl border border-white/5 p-8 shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center space-x-4 mb-10">
          <div className="w-20 h-20 bg-stake-green/20 rounded-full flex items-center justify-center border-2 border-stake-green/50 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <Trophy size={40} className="text-stake-green" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white italic truncate max-w-[250px]">
              {stats?.username || auth.currentUser?.displayName || 'PLAYER'}
            </h2>
            <p className="text-[10px] uppercase font-black text-gray-500 tracking-[0.3em]">Lifetime Legend</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 text-stake-green animate-spin" />
            <p className="text-gray-500 text-xs font-black uppercase tracking-widest">Retrieving Records...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 rounded-2xl p-5 border border-white/5">
                <div className="flex items-center space-x-2 mb-4">
                  <Zap size={16} className="text-cyan-accent" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Offline Mode</span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-black text-white">{stats?.winsOffline || 0} <span className="text-xs text-gray-500 uppercase">Wins</span></div>
                  <div className="flex justify-between items-center bg-white/5 rounded-lg px-2 py-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase">Accuracy</span>
                    <span className="text-xs font-black text-cyan-accent">{calculateWinRate(stats?.winsOffline || 0, stats?.gamesOffline || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-5 border border-white/5">
                <div className="flex items-center space-x-2 mb-4">
                  <Swords size={16} className="text-indigo-accent" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Online Arena</span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-black text-white">{stats?.winsOnline || 0} <span className="text-xs text-gray-500 uppercase">Wins</span></div>
                  <div className="flex justify-between items-center bg-white/5 rounded-lg px-2 py-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase">Win Rate</span>
                    <span className="text-xs font-black text-indigo-accent">{calculateWinRate(stats?.winsOnline || 0, stats?.gamesOnline || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Footer */}
            <div className="bg-gradient-to-r from-stake-green/10 to-transparent rounded-2xl p-6 border border-stake-green/10 flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black text-stake-green uppercase tracking-widest mb-1">Total Career Wins</p>
                <p className="text-4xl font-black text-white italic">{stats?.totalWins || 0}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors text-[10px] font-black uppercase tracking-widest"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
