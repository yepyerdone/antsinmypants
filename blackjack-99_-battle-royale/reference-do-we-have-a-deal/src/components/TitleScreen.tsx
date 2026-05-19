import React from 'react';
import { motion } from 'motion/react';
import { audioManager } from '../logic/audioSystem';
import { TrophyCase } from './TrophyCase';

interface TitleScreenProps {
  onStart: () => void;
  collectedPrizes: number[];
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, collectedPrizes }) => {
  return (
    <div className="studio-shell flex flex-col items-center min-h-screen text-center p-6 overflow-y-auto relative scroll-smooth" id="title-screen">
      
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative z-10 py-20 flex flex-col items-center w-full"
      >
        <h2 className="text-amber-300 font-bold tracking-[0.5em] uppercase text-sm mb-4">Tonight's Main Event</h2>
        <h1 className="text-5xl md:text-8xl font-black text-white mb-4 tracking-tight drop-shadow-2xl">
          DO WE HAVE A <span className="text-yellow-400">DEAL?</span>
        </h1>
        <div className="h-1.5 w-32 bg-yellow-600 mx-auto rounded-full mb-8 shadow-[0_0_15px_rgba(202,138,4,0.5)]" />
        
        <p className="max-w-md text-slate-400 mb-12 leading-relaxed">
          Twenty-six sealed briefcases, one stage full of pressure, and a Banker waiting to buy your nerve. Trust your luck or take the money.
        </p>

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            audioManager.playClick();
            onStart();
          }}
          className="px-12 py-5 bg-blue-600 text-white font-black text-xl rounded-2xl shadow-xl transition-colors hover:bg-blue-500 uppercase tracking-widest"
          id="start-button"
        >
          Enter the Studio
        </motion.button>

        {/* Trophy Case Section */}
        <TrophyCase collectedPrizes={collectedPrizes} />
      </motion.div>
      
      <div className="py-12 text-slate-600 text-xs uppercase tracking-widest font-medium relative z-10 w-full">
        Browser-Based Game Show Simulation
      </div>
    </div>
  );
};
