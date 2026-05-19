import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BriefcaseData } from '../types';

interface BriefcaseProps {
  data: BriefcaseData;
  onClick: () => void;
  disabled: boolean;
}

const formatCaseValue = (value: number) => {
  if (value === 0.01) return '$0.01';
  if (value >= 1000000) return `$${value / 1000000}M`;
  if (value >= 1000) return `$${value / 1000}K`;
  return `$${value}`;
};

export const Briefcase: React.FC<BriefcaseProps> = ({ data, onClick, disabled }) => {
  return (
    <motion.div
      variants={{
        hover: { scale: 1.05 }
      }}
      whileHover={!disabled && !data.isOpen ? "hover" : ""}
      whileTap={!disabled && !data.isOpen ? { scale: 0.95 } : {}}
      onClick={!disabled && !data.isOpen ? onClick : undefined}
      className={`
        relative w-20 h-32 sm:w-[5.25rem] sm:h-36 md:w-[5.5rem] md:h-40 lg:w-[4.75rem] lg:h-36 2xl:w-28 2xl:h-48 cursor-pointer transition-all duration-500 perspective-1000
        ${data.isPersonal ? 'scale-110 z-10' : ''}
      `}
      id={`briefcase-${data.id}`}
    >
      <img
        src="/assets/presenter-model.png"
        alt=""
        className={`
          pointer-events-none absolute bottom-0 left-1/2 z-0 h-full w-[145%] -translate-x-1/2 object-contain object-bottom opacity-95 drop-shadow-[0_14px_18px_rgba(0,0,0,0.5)]
          ${data.id % 2 === 0 ? 'scale-x-[-1]' : ''}
        `}
      />

      {/* Subtle pulsing glow on hover */}
      {!disabled && !data.isOpen && (
        <motion.div 
          variants={{
            hover: {
              opacity: [0, 0.6, 0],
              scale: [0.9, 1.2, 0.9],
              transition: { 
                duration: 2, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }
            }
          }}
          className="absolute bottom-0 left-1/2 h-16 w-24 -translate-x-1/2 bg-yellow-500/20 blur-2xl rounded-full z-0 pointer-events-none"
        />
      )}

      <div className="absolute bottom-5 left-1/2 z-20 h-[42%] w-full -translate-x-1/2 lg:bottom-4 2xl:bottom-6">
        <AnimatePresence mode="wait">
          {!data.isOpen ? (
            <motion.div
              key="closed"
              initial={false}
              exit={{ rotateX: -110, y: -20, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeIn" }}
              className="absolute inset-0 z-20"
            >
              {/* Handle */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-1/3 h-5 border-2 border-[#6a4a1f] rounded-t-lg bg-gradient-to-b from-[#e3c06b] to-[#8f6926] z-0 shadow-md" />
              
              {/* Front of Case */}
              <div className={`
                absolute inset-0 rounded-lg shadow-2xl border-2 border-[#6a4a1f] font-bold flex flex-col items-center justify-center text-xl md:text-2xl
                bg-[linear-gradient(135deg,#f4d788_0%,#b78b39_18%,#f5dfa0_38%,#8e6521_68%,#d1ad60_100%)] text-[#2c1805]
                ${data.isPersonal ? 'ring-4 ring-amber-200 shadow-[0_0_24px_rgba(255,214,102,0.7)]' : ''}
              `}>
                <div className="absolute inset-x-0 top-1/2 h-px bg-[#6a4a1f]/70" />
                <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#f7e1a3] shadow-inner" />
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#f7e1a3] shadow-inner" />
                <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-[#7c5518] shadow-inner" />
                <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-[#7c5518] shadow-inner" />
                
                <div className="absolute top-0 left-4 w-4 h-2 bg-[#5d3d12] rounded-b" />
                <div className="absolute top-0 right-4 w-4 h-2 bg-[#5d3d12] rounded-b" />

                <span className="drop-shadow-sm border border-[#6a4a1f]/60 bg-[#f7e4ab]/80 px-3 py-0.5 rounded-sm">{data.id}</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotateX: 90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              className="absolute inset-0 z-10"
            >
              <div className={`
                absolute inset-0 rounded-lg shadow-2xl border-2 border-amber-500 font-bold flex items-center justify-center
                bg-[radial-gradient(circle_at_center,#2d2110,#090709_70%)] text-amber-300 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]
              `}>
                <div className="max-w-full px-1 text-center text-[10px] md:text-xs 2xl:text-base font-black leading-none">
                  {formatCaseValue(data.value)}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
