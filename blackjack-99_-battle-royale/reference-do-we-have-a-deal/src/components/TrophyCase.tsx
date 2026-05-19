import React from 'react';
import { CASH_VALUES } from '../types';

interface TrophyCaseProps {
  collectedPrizes: number[];
}

export const TrophyCase: React.FC<TrophyCaseProps> = ({ collectedPrizes }) => {
  return (
    <div className="mt-12 max-w-5xl w-full relative group" id="trophy-case">
      <div className="absolute -inset-5 rounded-[28px] bg-[linear-gradient(135deg,#160b07,#6a3d16,#170c08)] border-[10px] border-[#1a0d08] shadow-[0_30px_80px_rgba(0,0,0,0.9)]" />
      <div className="relative overflow-hidden rounded-2xl border-4 border-[#2d180b] bg-[linear-gradient(180deg,#32190c,#170b07)] p-6 md:p-8 min-h-[430px] shadow-inner">
        <div className="absolute inset-0 opacity-25 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_58px)]" />
        <div className="absolute inset-x-8 top-0 h-24 bg-[radial-gradient(circle_at_center,rgba(255,224,161,0.24),transparent_70%)]" />

        <div className="relative z-10 flex items-center justify-center gap-4 mb-7">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300/50" />
          <h2 className="text-2xl md:text-3xl font-black text-amber-100 uppercase whitespace-nowrap drop-shadow-md">
            Grand Trophy Case
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300/50" />
        </div>

        <div className="relative z-10 rounded-2xl border border-amber-200/10 bg-black/20 p-4 md:p-5">
          <div className="absolute inset-x-4 top-[33%] h-3 bg-[linear-gradient(180deg,#7d4d1d,#3a1d0c)] shadow-[0_8px_10px_rgba(0,0,0,0.55)]" />
          <div className="absolute inset-x-4 top-[66%] h-3 bg-[linear-gradient(180deg,#7d4d1d,#3a1d0c)] shadow-[0_8px_10px_rgba(0,0,0,0.55)]" />
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-4 relative z-10">
          {CASH_VALUES.map((value) => {
            const isCollected = collectedPrizes.includes(value);
            return (
              <div
                key={value}
                className={`
                  relative aspect-square flex flex-col items-center justify-center p-1 transition-all duration-700
                  ${isCollected 
                    ? 'translate-y-[-2px]' 
                    : 'opacity-55'}
                `}
                title={`$${value.toLocaleString()}`}
              >
                <div className={`
                  absolute inset-x-2 bottom-2 h-[54%] rounded-md border
                  ${isCollected
                    ? 'border-[#6a4718] bg-[linear-gradient(135deg,#f7dfa1,#b8862d,#6c4313)] shadow-[0_8px_14px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.6)]'
                    : 'border-white/5 bg-black/25'}
                `} />
                <div className={`
                  absolute bottom-[48%] left-1/2 h-4 w-8 -translate-x-1/2 rounded-t-md border-x border-t
                  ${isCollected ? 'border-[#6a4718]' : 'border-white/5'}
                `} />
                <div className={`
                  relative z-10 mt-auto mb-4 rounded px-2 py-0.5 text-[10px] md:text-xs font-black leading-tight
                  ${isCollected ? 'bg-amber-100/85 text-[#241303]' : 'bg-white/5 text-amber-100/20'}
                `}>
                  {value >= 1000000 ? '1M' : value >= 1000 ? `${value / 1000}K` : value === 0.01 ? '1¢' : value}
                </div>
                {isCollected && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-100 shadow-[0_0_12px_rgba(255,236,179,0.9)]" />
                )}
              </div>
            );
          })}
          </div>
        </div>
        
        <div className="mt-8 text-center relative z-10">
          <p className="text-amber-100/60 text-[10px] uppercase tracking-widest font-bold drop-shadow">
            Collected: {collectedPrizes.length} / {CASH_VALUES.length} Prizes
          </p>
          <div className="mt-2 w-full h-2 bg-black/40 rounded-full overflow-hidden border border-[#2d1e15]">
            <div 
              className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-all duration-1000" 
              style={{ width: `${(collectedPrizes.length / CASH_VALUES.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none rounded-2xl border border-white/20 bg-[linear-gradient(120deg,rgba(255,255,255,0.18),transparent_25%,transparent_65%,rgba(255,255,255,0.08))] shadow-inner">
        <div className="absolute inset-0 rounded-2xl border-[12px] border-[#3a1e0d]/60" />
        <div className="absolute -inset-y-24 -inset-x-12 w-48 rotate-45 bg-white/8 blur-3xl translate-x-[-120%] transition-transform duration-[2000ms] ease-in-out group-hover:translate-x-[430%]" />
        <div className="absolute right-5 top-1/2 h-20 w-2 -translate-y-1/2 rounded-full border border-yellow-400/30 bg-gradient-to-b from-yellow-200 via-yellow-600 to-yellow-900 shadow-lg" />
      </div>
    </div>
  );
};
