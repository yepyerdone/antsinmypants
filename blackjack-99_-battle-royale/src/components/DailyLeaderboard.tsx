import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getDailyLeaderboard, DailyWin } from "../lib/user";
import { Trophy, Crown, Medal } from "lucide-react";
import { cn } from "../lib/utils";

export function DailyLeaderboard() {
  const [leaders, setLeaders] = useState<DailyWin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaders() {
      const data = await getDailyLeaderboard();
      setLeaders(data);
      setLoading(false);
    }
    fetchLeaders();
  }, []);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center p-4">
        <div className="w-4 h-4 border-2 border-stake-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (leaders.length === 0) {
    return (
      <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">No victories recorded today</p>
      </div>
    );
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Crown size={14} className="text-stake-green" />;
      case 1: return <Medal size={14} className="text-gray-400" />;
      case 2: return <Medal size={14} className="text-amber-600" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 px-2">
        <Trophy size={14} className="text-stake-green" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Daily Top Kings</h3>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {leaders.map((leader, index) => (
          <motion.div
            key={leader.userId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
              index === 0 
                ? "bg-stake-green/10 border-stake-green/20 shadow-lg shadow-stake-green/5" 
                : "bg-white/5 border-white/5 hover:bg-white/10"
            )}
          >
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 flex items-center justify-center font-black text-xs">
                {getRankIcon(index) || <span className="text-gray-500">#{index + 1}</span>}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-tight text-white leading-none">
                  {leader.name}
                </span>
                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                  Active Player
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-white tabular-nums">
                {leader.wins}
              </div>
              <div className="text-[8px] font-black text-stake-green uppercase tracking-tighter">
                Wins
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
