/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TETROMINOES, TetrominoType } from '../constants';
import { GameState } from '../types';
import { subscribeToLeaderboard, LeaderboardEntry } from '../services/leaderboardService';
import { auth, signInWithGoogle } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface SidebarProps {
  state: GameState;
  side: 'left' | 'right';
}

export const PiecePreview: React.FC<{ type: TetrominoType | null; label: string }> = ({ type, label }) => {
  const tetromino = type ? TETROMINOES[type] : null;

  return (
    <div className="glass p-4 flex flex-col items-center justify-center h-40 rounded-none mb-4">
      <span className="text-[8px] uppercase tracking-[1px] text-white/50 mb-4 font-sans text-center">{label}</span>
      <div className="h-20 flex items-center justify-center translate-y-[-10px]">
        {tetromino ? (
          <div 
            className="grid gap-[2px]"
            style={{ 
              gridTemplateColumns: `repeat(${tetromino.shape[0].length}, 1fr)`,
            }}
          >
            {tetromino.shape.map((row, y) => 
              row.map((cell, x) => (
                <div 
                  key={`${y}-${x}`}
                  className="w-4 h-4"
                  style={{ 
                    backgroundColor: cell ? tetromino.color : 'transparent',
                    boxShadow: cell ? `inset 2px 2px 0 rgba(255,255,255,0.4), inset -2px -2px 0 rgba(0,0,0,0.4)` : 'none'
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <div className="text-white/10 font-mono text-[8px] italic">NONE</div>
        )}
      </div>
    </div>
  );
};

export const StatBox: React.FC<{ label: string; value: number | string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="flex flex-col gap-2 mb-6">
    <span className="text-[8px] uppercase tracking-[1px] text-white/50 font-sans">{label}</span>
    <motion.div 
      key={value}
      initial={{ scale: 1.1, color: '#fff' }}
      animate={{ scale: 1, color: highlight ? '#00f0f0' : '#fff' }}
      className={`text-lg font-mono font-bold tracking-tight ${highlight ? 'text-cyan-400' : 'text-white'}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
    </motion.div>
  </div>
);

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard(setEntries);
    return () => unsubscribe();
  }, []);

  return (
    <div className="border-4 border-cyan-500/30 bg-cyan-500/5 p-3 flex flex-col gap-2 mb-4 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
      <span className="text-[8px] uppercase tracking-[2px] text-cyan-400 font-bold font-sans">LEADERBOARD</span>
      <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
        {entries.map((entry, i) => (
          <div key={entry.userId} className="flex justify-between items-center text-[8px] font-mono border-b border-cyan-500/10 pb-1">
            <span className="text-cyan-500/40 mr-2">{i + 1}.</span>
            <span className="truncate flex-1 text-white/90">{entry.username}</span>
            <span className="text-cyan-400 font-bold ml-2">{entry.score}</span>
          </div>
        ))}
        {entries.length === 0 && <div className="text-[8px] text-white/20 italic text-center py-2">NO DATA</div>}
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ state, side }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  if (side === 'left') {
    return (
      <div className="flex flex-col gap-2 w-48">
        <PiecePreview type={state.holdPiece} label="HELD" />
        <div className="glass p-6 flex flex-col flex-grow rounded-none">
          <StatBox label="SCORE" value={state.score.toString().padStart(6, '0')} highlight />
          <StatBox label="BEST" value={state.highScore.toString().padStart(6, '0')} />
          <StatBox label="LEVEL" value={state.level.toString().padStart(2, '0')} />
          <StatBox label="LINES" value={state.lines} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-48">
      <PiecePreview type={state.nextPiece} label="NEXT" />
      <div className="glass p-4 flex flex-col flex-grow rounded-none h-full">
        <Leaderboard />

        <span className="text-[8px] uppercase tracking-[1px] text-white/50 mb-2 font-sans">CONTROLS</span>
        <div className="space-y-1 opacity-60 text-[8px] font-medium leading-normal mb-4">
          <p>ARROWS: MOVE</p>
          <p>SPACE: PAUSE</p>
          <p>C: HOLD | P: PAUSE</p>
          <p>Z/X: SPIN</p>
        </div>
        
        <div className="mt-auto pt-4 space-y-4">
            {!user ? (
                <button 
                    onClick={signInWithGoogle}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-[8px] font-sans border border-white/10 transition-colors uppercase tracking-widest text-white/70"
                >
                    Sign In
                </button>
            ) : (
                <div className="text-[8px] font-sans text-center text-white/40 uppercase">
                    Hi, {user.displayName?.split(' ')[0]}
                </div>
            )}
            <div className="font-mono text-[8px] text-center opacity-30">
                SYS v1.1.0
            </div>
        </div>
      </div>
    </div>
  );
};

