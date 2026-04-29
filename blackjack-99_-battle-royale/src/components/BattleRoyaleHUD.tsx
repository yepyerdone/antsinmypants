import { motion, AnimatePresence } from 'motion/react';
import { Player } from '../types';
import { Users, Skull, Crown, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateScore } from '../lib/blackjack';

interface HUDProps {
  players: Player[];
  round: number;
}

export function BattleRoyaleHUD({ players, round }: HUDProps) {
  const aliveCount = players.filter(p => !['eliminated'].includes(p.status)).length;
  const eliminatedCount = players.filter(p => p.status === 'eliminated').length;

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-center bg-bg-accent p-4 rounded-xl border border-white/10 z-50 shadow-xl">
      <div className="flex items-center gap-4">
        <div className="bg-stake-blue px-4 py-2 rounded-lg text-xs font-black text-cyan-accent border border-cyan-accent/30 tracking-tight">
          BATTLE ROYALE
        </div>
        <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>
        <div className="hidden md:flex flex-col">
          <span className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Live Round</span>
          <span className="text-sm font-mono text-stake-green tracking-widest">{round.toString().padStart(2, '0')}</span>
        </div>
      </div>

      <div className="text-xl md:text-2xl font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 uppercase px-4 text-center">
        Blackjack 99
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right flex flex-col items-end">
          <div className="text-[9px] text-gray-500 uppercase font-black tracking-[0.2em]">Survivors</div>
          <div className="text-xl md:text-2xl font-black text-stake-green tabular-nums">
            {aliveCount} <span className="text-xs text-white/30 font-bold tracking-normal italic">/ {players.length}</span>
          </div>
        </div>
        <div className="w-10 h-10 md:w-12 md:h-12 bg-stake-red rounded-full flex items-center justify-center border-2 border-white/20 shadow-lg shadow-stake-red/20">
          <Skull size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export function SidebarPlayerList({ players, side }: { players: Player[]; side: 'left' | 'right' }) {
  const isLeft = side === 'left';
  
  return (
    <div className={cn(
      "absolute top-24 bottom-24 w-64 hidden xl:flex flex-col space-y-2 overflow-y-auto pr-2 pl-2 z-40 transition-all duration-500",
      isLeft ? "left-4 border-r border-white/5" : "right-4 border-l border-white/5"
    )}>
      <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2 pb-2 border-b border-white/5 mb-2">
        {isLeft ? "Arena Alpha" : "Arena Omega"}
      </div>
      <div className="grid grid-cols-3 gap-2 auto-rows-min">
        {players.map((p) => {
          const score = calculateScore(p.hand);
          return (
            <motion.div 
              layout
              key={p.id}
              className={cn(
                "group relative aspect-[3/4] rounded-xl flex flex-col items-center justify-between p-1.5 border transition-all duration-300 overflow-hidden",
                p.status === 'eliminated' 
                  ? "bg-black/40 border-stake-red/10 grayscale opacity-40 shrink-0" 
                  : p.status === 'winner'
                  ? "bg-stake-green/20 border-stake-green shadow-lg shadow-stake-green/20 shrink-0"
                  : p.status === 'standing'
                  ? "bg-stake-blue/30 border-stake-blue shrink-0"
                  : "bg-bg-accent border-white/10 shrink-0"
              )}
            >
              {/* Mini Header */}
              <div className="w-full flex justify-between items-center mb-1">
                 <div className="flex flex-col">
                   <span className="text-[7px] font-black uppercase tracking-tighter truncate w-10 text-gray-400">
                      {p.name}
                   </span>
                   {p.wins !== undefined && p.wins > 0 && (
                     <div className="flex items-center space-x-0.5 text-[6px] text-stake-green font-bold">
                        <Trophy size={6} />
                        <span>{p.wins}</span>
                     </div>
                   )}
                 </div>
                 {p.status === 'standing' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-stake-green animate-pulse" />
                 )}
              </div>

              {/* Mini Cards Container */}
              <div className="flex -space-x-2 mt-auto mb-auto">
                 {p.hand.slice(0, 3).map((c, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-4 h-6 md:w-5 md:h-7 rounded-sm border-[0.5px] border-black/20 flex items-center justify-center text-[8px] font-black shadow-sm",
                        p.status === 'eliminated' ? "bg-gray-300" : "bg-white",
                        (c.suit === 'hearts' || c.suit === 'diamonds') ? "text-stake-red" : "text-black"
                      )}
                    >
                      {c.rank}
                    </div>
                 ))}
                 {p.hand.length > 3 && (
                   <div className="w-4 h-6 md:w-5 md:h-7 rounded-sm bg-gray-200 flex items-center justify-center text-[6px] font-bold text-gray-600">
                      +{p.hand.length - 3}
                   </div>
                 )}
              </div>

              {/* Mini Score / Status */}
              <div className="mt-1 w-full flex justify-center">
                 {p.status === 'eliminated' ? (
                   <Skull size={10} className="text-stake-red" />
                 ) : p.status === 'winner' ? (
                   <Crown size={10} className="text-stake-green" />
                 ) : (
                   <span className={cn(
                     "text-[9px] font-black tabular-nums",
                     score > 21 ? "text-stake-red" : "text-white"
                   )}>
                     {score > 0 ? score : "--"}
                   </span>
                 )}
              </div>

              {/* Overlay for specific actions */}
              {p.status === 'busted' && (
                <div className="absolute inset-0 bg-stake-red/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                   <span className="text-[8px] font-black text-white uppercase tracking-tighter -rotate-12 border border-white/20 px-1 bg-stake-red shadow-xl">BUST</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
