import { motion } from 'motion/react';
import { StateData } from '../types';

interface USMapProps {
  states: StateData[];
  guessedStates: Set<string>;
  hoveredState: string | null;
  onStateHover: (name: string | null) => void;
}

export default function USMap({ states, guessedStates, hoveredState, onStateHover }: USMapProps) {
  return (
    <div className="relative w-full aspect-[1.6/1] bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
      <svg
        viewBox="0 0 975 610"
        className="w-full h-full"
      >
        <g>
          {states.map((state) => {
            const isGuessed = guessedStates.has(state.name.toLowerCase());
            const isHovered = hoveredState === state.name;

            return (
              <motion.path
                key={state.id}
                d={state.path}
                fill={isGuessed ? '#10b981' : '#1e293b'}
                stroke="#334155"
                strokeWidth="0.5"
                initial={false}
                animate={{
                  fill: isGuessed ? '#10b981' : isHovered ? '#334155' : '#1e293b',
                  scale: isHovered ? 1.002 : 1,
                  filter: isHovered ? 'brightness(1.2)' : 'brightness(1)',
                }}
                transition={{ duration: 0.2 }}
                onMouseEnter={() => onStateHover(state.name)}
                onMouseLeave={() => onStateHover(null)}
                className="cursor-default outline-none"
              />
            );
          })}
        </g>
      </svg>
      
      {states.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">
          Loading geography data...
        </div>
      )}
    </div>
  );
}
