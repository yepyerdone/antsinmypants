import React from 'react';
import { CASH_VALUES } from '../types';

interface MoneyLadderProps {
  revealedValues: number[];
}

export const MoneyLadder: React.FC<MoneyLadderProps> = ({ revealedValues }) => {
  const leftColumn = CASH_VALUES.slice(0, 13);
  const rightColumn = CASH_VALUES.slice(13);

  return (
    <div className="show-card rounded-2xl p-4 flex gap-4 md:gap-8 justify-center select-none" id="money-ladder">
      <div className="flex flex-col">
        {leftColumn.map(value => {
          const isRevealed = revealedValues.includes(value);
          return (
            <div 
              key={value}
              className={`
                w-32 md:w-40 py-1 px-3 border rounded mb-1 text-sm md:text-base font-semibold transition-all duration-500
                ${isRevealed 
                  ? 'bg-black/30 border-white/5 text-slate-600 line-through' 
                  : 'bg-gradient-to-r from-[#73440d] via-[#d4a13a] to-[#ffe0a2] border-amber-200/30 text-black shadow-[0_0_10px_rgba(202,138,4,0.3)]'}
              `}
            >
              ${value.toLocaleString()}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col">
        {rightColumn.map(value => {
          const isRevealed = revealedValues.includes(value);
          return (
            <div 
              key={value}
              className={`
                w-32 md:w-40 py-1 px-3 border rounded mb-1 text-sm md:text-base font-semibold transition-all duration-500
                ${isRevealed 
                  ? 'bg-black/30 border-white/5 text-slate-600 line-through' 
                  : 'bg-gradient-to-r from-[#73440d] via-[#d4a13a] to-[#ffe0a2] border-amber-200/30 text-black shadow-[0_0_10px_rgba(202,138,4,0.3)]'}
              `}
            >
              ${value.toLocaleString()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
