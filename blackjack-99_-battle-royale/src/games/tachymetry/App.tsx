/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameBoard } from './components/GameBoard';
import { Sidebar } from './components/Sidebar';
import { useGameLogic } from './hooks/useGameLogic';
import { Play, Pause } from 'lucide-react';

export default function App() {
  const { state, restart, setState } = useGameLogic();
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <div className="tachymetry-stage min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans selection:bg-cyan-500/30 overflow-hidden relative bg-grid-animate">
      {/* Dynamic Glow background */}
      <div className="tachymetry-bg-effects absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="tachymetry-bg-ribbon tachymetry-bg-ribbon--cyan" />
        <div className="tachymetry-bg-ribbon tachymetry-bg-ribbon--violet" />
        <div className="tachymetry-bg-ribbon tachymetry-bg-ribbon--gold" />
        <div className="bg-vibrant-glow absolute top-1/4 left-1/4 w-1/2 h-1/2 opacity-30" />
        <div className="bg-vibrant-glow absolute bottom-1/4 right-1/4 w-1/2 h-1/2 opacity-25 hue-rotate-90" />
      </div>

      {/* CRT Scanline Overlay */}
      <div className="crt-overlay" />

      <div className="relative z-10 flex items-center justify-center gap-8 p-8 h-full w-full max-w-[1280px]">
        
        {/* Left Sidebar */}
        <AnimatePresence>
          {gameStarted && (
            <motion.aside 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden xl:flex flex-col h-[660px]"
            >
              <Sidebar state={state} side="left" />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Board Area */}
        <div className="relative flex items-center justify-center">
          {!gameStarted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="tachymetry-start-panel glass p-12 flex flex-col items-center text-center space-y-8 rounded-[40px] w-full max-w-[520px]"
            >
              <div className="space-y-4 w-full">
                <h1 className="tachymetry-title text-5xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(0,240,240,0.5)]">
                  TACHYMETRY
                </h1>
                <p className="text-white/30 font-mono tracking-[0.3em] text-[10px] w-full">ULTIMATE ARCADE v1.1.0</p>
              </div>

              <button 
                onClick={() => setGameStarted(true)}
                className="group relative px-12 py-4 bg-white text-black font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 hover:bg-cyan-400"
              >
                START MISSION
              </button>

              <div className="pt-4 border-t border-white/10 flex justify-center gap-12">
                <div className="text-center">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">High Score</p>
                  <p className="font-mono text-xl">{state.highScore.toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="relative">
              <GameBoard state={state} />
              
              {/* Overlays (Pause/Game Over) */}
              <AnimatePresence>
                {(state.gameOver || state.paused) && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-[20px]"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      className="text-center p-8 space-y-6"
                    >
                      {state.gameOver ? (
                        <>
                          <h2 className="text-4xl font-black italic text-red-500 tracking-tighter">GAME OVER</h2>
                          <div className="space-y-1">
                            <p className="text-[10px] text-white/40 uppercase">Final Score</p>
                            <p className="text-4xl font-mono font-bold text-cyan-400">{state.score.toLocaleString()}</p>
                          </div>
                          <div className="flex flex-col gap-3">
                            <button 
                              onClick={restart}
                              className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors w-full"
                            >
                              RESTART
                            </button>
                            <button 
                              onClick={() => {
                                restart();
                                setGameStarted(false);
                              }}
                              className="px-8 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-colors w-full border border-white/20"
                            >
                              MENU
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-6">
                           <h2 className="text-4xl font-black italic text-white tracking-tighter">PAUSED</h2>
                           <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => setState(s => ({ ...s, paused: false }))}
                                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors w-full"
                              >
                                RESUME
                              </button>
                              <button 
                                onClick={() => {
                                  restart();
                                  setGameStarted(false);
                                }}
                                className="px-8 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-colors w-full border border-white/20"
                              >
                                MENU
                              </button>
                           </div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <AnimatePresence>
          {gameStarted && (
            <motion.aside 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden xl:flex flex-col h-[660px]"
            >
              <Sidebar state={state} side="right" />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile View Stats Overlay */}
        {gameStarted && (
           <div className="xl:hidden fixed bottom-6 left-1/2 -translate-x-1/2 glass px-8 py-4 rounded-full flex items-center gap-12 z-50">
              <div className="text-center">
                <p className="text-[8px] text-white/40 uppercase tracking-widest">Score</p>
                <p className="font-mono font-bold text-cyan-400">{state.score}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] text-white/40 uppercase tracking-widest">Level</p>
                <p className="font-mono font-bold">{state.level}</p>
              </div>
              <button 
                onClick={() => setState(s => ({ ...s, paused: !s.paused }))}
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              >
                {state.paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>
           </div>
        )}
      </div>
    </div>
  );
}
