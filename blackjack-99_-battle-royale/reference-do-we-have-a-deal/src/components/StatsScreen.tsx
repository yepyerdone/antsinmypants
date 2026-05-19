import React from 'react';
import { motion } from 'motion/react';
import { GameStats } from '../types';

interface StatsScreenProps {
  stats: GameStats;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const StatsScreen: React.FC<StatsScreenProps> = ({ stats, onRestart, onMainMenu }) => {
  const lucky = stats.wonAmount > stats.caseValue;
  const efficient = stats.wonAmount >= stats.peakOffer * 0.9;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      id="stats-screen"
    >
      <div className="show-card border rounded-3xl p-8 max-w-2xl w-full text-white">
        <h1 className="text-4xl font-extrabold text-center mb-2">Final Reveal</h1>
        <p className="text-center text-slate-400 mb-8 uppercase tracking-widest text-sm">Results Summary</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">Your Winnings</div>
            <div className="text-4xl font-black text-green-400">${stats.wonAmount.toLocaleString()}</div>
          </div>
          
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">Your Case Held</div>
            <div className="text-4xl font-black text-yellow-500">${stats.caseValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <h3 className="text-lg font-bold border-b border-slate-800 pb-2">Analysis</h3>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400 font-medium">Peak Offer Received:</span>
            <span className="font-bold text-blue-400">${stats.peakOffer.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400 font-medium">Decision Quality:</span>
            <span className={`font-bold ${efficient ? 'text-green-400' : 'text-red-400'}`}>
              {efficient ? 'Exceptional' : lucky ? 'Risky but paid off' : 'Sub-optimal'}
            </span>
          </div>
          <p className="text-xs text-slate-500 italic mt-4 text-center">
            {efficient 
              ? "You struck a deal near the peak of the market. The Banker respects your discipline."
              : lucky 
                ? "You gambled and won more than the Banker offered. fortune favors the bold."
                : "You may have left money on the table, but the thrill of the chase is its own reward."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onRestart}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98]"
            id="play-again-button"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={onMainMenu}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] border border-slate-700"
            id="main-menu-button"
          >
            MAIN MENU
          </button>
        </div>
      </div>
    </motion.div>
  );
};
