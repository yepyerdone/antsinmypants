/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { Zap, Trophy, MapPin, Diamond, Shield, Play } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, RUN_SPEED_BASE } from '../../types';
import { audio } from '../System/Audio';

export const HUD: React.FC = () => {
  const { score, status, restartGame, startGame, gemsCollected, distance, isImmortalityActive, speed, highestScore } = useStore();

  const containerClass = "absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-50";

  if (status === GameStatus.MENU) {
      return (
          <div className="absolute inset-0 flex items-center justify-center z-[100] bg-white/40 backdrop-blur-md p-4 pointer-events-auto">
              {/* Card Container */}
              <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/50 bg-white">
                
                <div className="relative w-full bg-gradient-to-b from-sky-400 to-sky-200 flex justify-center items-center py-20 min-h-[300px] overflow-hidden">
                     
                     <h1 className="text-5xl md:text-6xl font-black text-white z-10 font-cyber drop-shadow-md text-center tracking-widest relative">
                        <span className="block mb-2 text-yellow-300 drop-shadow-sm">NEON</span>
                        <span className="block text-white drop-shadow-sm">RUSH</span>
                     </h1>
                     
                     <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end items-center p-6 pb-8 text-center z-10 bg-gradient-to-t from-white to-transparent">
                        <button 
                          onClick={() => { audio.init(); startGame(); }}
                          className="w-full group relative px-6 py-4 bg-yellow-400 shadow-lg text-white font-black text-xl rounded-xl hover:bg-yellow-300 transition-all overflow-hidden"
                        >
                            <span className="relative z-10 tracking-widest flex items-center justify-center drop-shadow-md">
                                START GAME <Play className="ml-2 w-5 h-5 fill-white" />
                            </span>
                        </button>

                        <p className="text-gray-600 text-sm font-bold mt-4 tracking-wider">
                            Run as far as you can before you get caught!
                        </p>
                        <p className="text-gray-500 text-xs font-bold mt-2 tracking-wider uppercase">
                            [ Arrows / Swipe to Move ]
                        </p>
                        {highestScore > 0 && (
                            <p className="text-orange-500 text-sm font-black mt-2 tracking-widest uppercase">
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
          <div className="absolute inset-0 bg-white/80 z-[100] text-gray-800 pointer-events-auto backdrop-blur-md overflow-y-auto">
              <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                <h1 className="text-4xl md:text-6xl font-black text-red-500 mb-6 font-cyber text-center drop-shadow-sm uppercase">Caught!</h1>
                
                <div className="grid grid-cols-1 gap-3 md:gap-4 text-center mb-8 w-full max-w-md">
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-md flex items-center justify-between border border-gray-100">
                        <div className="flex items-center text-gray-500 font-bold text-sm md:text-base"><MapPin className="mr-2 w-4 h-4 md:w-5 md:h-5 text-green-500"/> DISTANCE</div>
                        <div className="text-xl md:text-2xl font-black">{Math.floor(distance)} M</div>
                    </div>
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-md flex items-center justify-between border border-gray-100">
                        <div className="flex items-center text-gray-500 font-bold text-sm md:text-base"><Diamond className="mr-2 w-4 h-4 md:w-5 md:h-5 text-cyan-500"/> GEMS</div>
                        <div className="text-xl md:text-2xl font-black">{gemsCollected}</div>
                    </div>
                     <div className="bg-blue-50 p-4 rounded-xl shadow-md flex flex-col items-center justify-center mt-2 border border-blue-100">
                        <div className="text-blue-500 font-black text-sm md:text-base mb-1">TOTAL SCORE</div>
                        <div className="text-3xl md:text-5xl font-black text-blue-600">{Math.floor(score).toLocaleString()}</div>
                    </div>
                     <div className="bg-yellow-50 p-4 rounded-xl shadow-md flex items-center justify-between mt-2 border border-yellow-200">
                        <div className="flex items-center text-yellow-600 text-sm md:text-base font-black">HIGH SCORE</div>
                        <div className="text-2xl md:text-3xl font-black text-yellow-600">{Math.floor(highestScore).toLocaleString()}</div>
                    </div>
                </div>

                <button 
                  onClick={() => { audio.init(); restartGame(); }}
                  className="px-8 md:px-10 py-3 md:py-4 bg-green-500 text-white font-black text-xl rounded-xl shadow-lg hover:bg-green-400 hover:scale-105 transition-all"
                >
                    PLAY AGAIN
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
                    HIGH: {Math.floor(highestScore).toLocaleString()}
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
                 <Shield className="mr-2 fill-yellow-400" /> IMMORTAL
             </div>
        )}

        {/* Bottom Overlay */}
        <div className="w-full flex justify-end items-end">
             <div className="flex items-center space-x-2 text-white/80 font-black bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                 <Zap className="w-4 h-4 fill-white" />
                 <span>SPEED {Math.round((speed / RUN_SPEED_BASE) * 100)}%</span>
             </div>
        </div>
    </div>
  );
};

