/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { Zap, MapPin, Diamond, Shield, Play } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, RUN_SPEED_BASE } from '../../types';
import { audio } from '../System/Audio';

export const HUD: React.FC = () => {
  const { score, status, restartGame, startGame, gemsCollected, distance, isImmortalityActive, speed, highestScore } = useStore();

  const containerClass = "absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-50";

  if (status === GameStatus.MENU) {
      return (
          <div className="absolute inset-0 flex items-center justify-center z-[100] bg-slate-950/58 backdrop-blur-md p-4 pointer-events-auto">
              <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-cyan-300/30 bg-slate-950/92">
                
                <div className="relative w-full bg-[radial-gradient(circle_at_50%_12%,rgba(34,211,238,0.36),transparent_28%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] flex justify-center items-center py-20 min-h-[300px] overflow-hidden">
                     <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_20%_26%,rgba(250,204,21,0.9)_0_2px,transparent_3px),radial-gradient(circle_at_74%_18%,rgba(125,211,252,0.9)_0_1px,transparent_2px),radial-gradient(circle_at_64%_68%,rgba(244,114,182,0.7)_0_2px,transparent_3px)]" />
                     
                     <h1 className="text-5xl md:text-6xl font-black text-white z-10 font-cyber drop-shadow-md text-center tracking-widest relative">
                        <span className="block mb-2 text-cyan-200 drop-shadow-sm">SPACE</span>
                        <span className="block text-fuchsia-200 drop-shadow-sm">RUNNER</span>
                     </h1>
                     
                     <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end items-center p-6 pb-8 text-center z-10 bg-gradient-to-t from-slate-950 via-slate-950/72 to-transparent">
                        <button 
                          onClick={() => { audio.init(); startGame(); }}
                          className="w-full group relative px-6 py-4 bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 shadow-lg shadow-cyan-500/25 text-slate-950 font-black text-xl rounded-xl hover:scale-[1.02] transition-all overflow-hidden"
                        >
                            <span className="relative z-10 tracking-widest flex items-center justify-center">
                                LAUNCH RUN <Play className="ml-2 w-5 h-5 fill-slate-950" />
                            </span>
                        </button>

                        <p className="text-cyan-100 text-sm font-bold mt-4 tracking-wider">
                            Outrun the alien through an orbital hazard lane.
                        </p>
                        <p className="text-slate-400 text-xs font-bold mt-2 tracking-wider uppercase">
                            [ Arrows / Swipe to Strafe | Up to Jump | Space to Boost ]
                        </p>
                        {highestScore > 0 && (
                            <p className="text-yellow-300 text-sm font-black mt-2 tracking-widest uppercase">
                                High Score: {highestScore.toLocaleString()}
                            </p>
                        )}
                     </div>
                </div>
              </div>
          </div>
      );
  }

  if (status === GameStatus.GAME_OVER) {
      return (
          <div className="absolute inset-0 bg-slate-950/86 z-[100] text-cyan-50 pointer-events-auto backdrop-blur-md overflow-y-auto">
              <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                <h1 className="text-4xl md:text-6xl font-black text-fuchsia-300 mb-6 font-cyber text-center drop-shadow-sm uppercase">Mission Lost</h1>
                
                <div className="grid grid-cols-1 gap-3 md:gap-4 text-center mb-8 w-full max-w-md">
                    <div className="bg-slate-900/82 p-3 md:p-4 rounded-xl shadow-md flex items-center justify-between border border-cyan-300/20">
                        <div className="flex items-center text-cyan-200 font-bold text-sm md:text-base"><MapPin className="mr-2 w-4 h-4 md:w-5 md:h-5 text-cyan-300"/> ORBITAL DISTANCE</div>
                        <div className="text-xl md:text-2xl font-black">{Math.floor(distance)} M</div>
                    </div>
                    <div className="bg-slate-900/82 p-3 md:p-4 rounded-xl shadow-md flex items-center justify-between border border-cyan-300/20">
                        <div className="flex items-center text-cyan-200 font-bold text-sm md:text-base"><Diamond className="mr-2 w-4 h-4 md:w-5 md:h-5 text-yellow-300"/> STAR CRYSTALS</div>
                        <div className="text-xl md:text-2xl font-black">{gemsCollected}</div>
                    </div>
                     <div className="bg-cyan-400/10 p-4 rounded-xl shadow-md flex flex-col items-center justify-center mt-2 border border-cyan-300/25">
                        <div className="text-cyan-200 font-black text-sm md:text-base mb-1">MISSION SCORE</div>
                        <div className="text-3xl md:text-5xl font-black text-cyan-100">{Math.floor(score).toLocaleString()}</div>
                    </div>
                     <div className="bg-yellow-300/10 p-4 rounded-xl shadow-md flex items-center justify-between mt-2 border border-yellow-300/25">
                        <div className="flex items-center text-yellow-200 text-sm md:text-base font-black">BEST RUN</div>
                        <div className="text-2xl md:text-3xl font-black text-yellow-200">{Math.floor(highestScore).toLocaleString()}</div>
                    </div>
                </div>

                <button 
                  onClick={() => { audio.init(); restartGame(); }}
                  className="px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-slate-950 font-black text-xl rounded-xl shadow-lg shadow-cyan-500/25 hover:scale-105 transition-all"
                >
                    LAUNCH AGAIN
                </button>
              </div>
          </div>
      );
  }

  return (
    <div className={containerClass}>
        {/* Top Bar */}
        <div className="flex justify-between items-start w-full">
            <div className="flex flex-col">
                <div className="text-3xl md:text-5xl font-black text-white drop-shadow-md">
                    {Math.floor(score).toLocaleString()}
                </div>
                <div className="text-sm font-bold text-white drop-shadow-md mt-1">
                    BEST: {Math.floor(highestScore).toLocaleString()}
                </div>
            </div>
            
            <div className="flex items-center bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                <Diamond className="w-5 h-5 text-cyan-400 mr-2" />
                <span className="font-black text-white">{gemsCollected}</span>
            </div>
        </div>

        {/* Active Skill Indicator */}
        {isImmortalityActive && (
             <div className="absolute top-24 left-1/2 transform -translate-x-1/2 text-yellow-400 font-black text-xl md:text-2xl animate-pulse flex items-center drop-shadow-md">
                 <Shield className="mr-2 fill-yellow-400" /> SHIELD ACTIVE
             </div>
        )}

        {/* Bottom Overlay */}
        <div className="w-full flex justify-end items-end">
             <div className="flex items-center space-x-2 text-white/80 font-black bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                 <Zap className="w-4 h-4 fill-white" />
                 <span>THRUST {Math.round((speed / RUN_SPEED_BASE) * 100)}%</span>
             </div>
        </div>
    </div>
  );
};
