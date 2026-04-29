import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export type DealerMood = 'neutral' | 'happy' | 'sad' | 'shocked' | 'smug' | 'thinking';

interface DealerAvatarProps {
  mood: DealerMood;
  className?: string;
}

export function DealerAvatar({ mood, className }: DealerAvatarProps) {
  return (
    <div className={cn("relative w-32 h-32 flex items-center justify-center", className)}>
      {/* Background Glow */}
      <motion.div 
        animate={{ 
          scale: mood === 'thinking' ? [1, 1.1, 1] : 1,
          opacity: mood === 'shocked' ? [0.4, 0.8, 0.4] : 0.4
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={cn(
          "absolute inset-0 rounded-full blur-2xl",
          mood === 'neutral' && "bg-white/10",
          mood === 'happy' && "bg-stake-green/30",
          mood === 'sad' && "bg-red-500/20",
          mood === 'shocked' && "bg-yellow-500/30",
          mood === 'smug' && "bg-indigo-500/30",
          mood === 'thinking' && "bg-blue-500/20"
        )}
      />

      {/* The Head */}
      <motion.div 
        animate={{ 
          y: mood === 'thinking' ? [0, -4, 0] : 0,
          rotate: mood === 'smug' ? 5 : 0
        }}
        className="relative z-10 w-24 h-24 bg-[#111] border-2 border-white/10 rounded-full flex flex-col items-center justify-center p-4 ring-1 ring-white/5 shadow-2xl"
      >
        {/* Mysterious Suit/Collar Detail */}
        <div className="absolute -bottom-1 w-12 h-6 bg-white/5 rounded-t-full" />
        
        {/* Eyes Area */}
        <div className="flex justify-center space-x-6 mb-3 w-full">
          {/* Left Eye */}
          <motion.div 
            animate={{ 
              height: mood === 'shocked' ? 12 : mood === 'sad' ? 2 : mood === 'smug' ? 4 : 8,
              scaleY: mood === 'thinking' ? [1, 0.1, 1] : 1
            }}
            transition={{ duration: mood === 'thinking' ? 3 : 0.3, repeat: mood === 'thinking' ? Infinity : 0 }}
            className="w-3 h-2 bg-stake-green rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" 
          />
          {/* Right Eye */}
          <motion.div 
            animate={{ 
              height: mood === 'shocked' ? 12 : mood === 'sad' ? 2 : mood === 'smug' ? 4 : 8,
              scaleY: mood === 'thinking' ? [1, 0.1, 1] : 1
            }}
            transition={{ duration: mood === 'thinking' ? 3.2 : 0.3, repeat: mood === 'thinking' ? Infinity : 0 }}
            className="w-3 h-2 bg-stake-green rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" 
          />
        </div>

        {/* Mouth/Expression */}
        <motion.div 
          animate={{ 
            width: mood === 'shocked' ? 16 : mood === 'thinking' ? 8 : 20,
            height: mood === 'shocked' ? 16 : 2,
            borderRadius: mood === 'shocked' ? '50%' : '1px',
            scaleY: (mood === 'happy' || mood === 'smug') ? -1 : 1
          }}
          className={cn(
            "bg-white/20 transition-all duration-300",
            (mood === 'happy' || mood === 'smug') && "border-t-2 border-white/40 bg-transparent h-4 !bg-none rounded-b-full w-12"
          )}
        />
      </motion.div>

      {/* Decorative Floating Elements */}
      <AnimatePresence>
        {mood === 'thinking' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute -right-4 -top-4 w-8 h-8 flex items-center justify-center text-blue-400 font-bold text-xl"
          >
            ?
          </motion.div>
        )}
        {mood === 'shocked' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: -20 }}
            exit={{ opacity: 0 }}
            className="absolute -top-12 text-red-500 font-black text-xs uppercase tracking-widest"
          >
            BUST!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
