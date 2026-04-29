import React from 'react';
import { motion } from 'motion/react';
import { Card as CardType } from '../types';
import { cn } from '../lib/utils';
import { Heart, Diamond, Club, Spade } from 'lucide-react';

interface CardProps {
  key?: React.Key;
  card: CardType;
  hidden?: boolean;
  className?: string;
  index?: number;
}

export function CardComponent({ card, hidden, className, index = 0 }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  
  const SuitIcon = {
    hearts: Heart,
    diamonds: Diamond,
    clubs: Club,
    spades: Spade,
  }[card.suit];

  if (hidden) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0, x: 50, y: -50 }}
        animate={{ rotateY: 0, opacity: 1, x: 0, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.5, type: 'spring' }}
        className={cn(
          "relative w-20 h-28 md:w-24 md:h-36 rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-900 border-2 border-white/20 flex items-center justify-center shadow-2xl overflow-hidden",
          className
        )}
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/20 flex items-center justify-center opacity-50">
          <Spade size={20} className="text-white" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, x: 50, y: -50 }}
      animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, type: 'spring' }}
      className={cn(
        "relative w-20 h-28 md:w-24 md:h-36 rounded-lg bg-white shadow-2xl flex flex-col p-2 select-none border-2 border-gray-200",
        isRed ? "text-stake-red" : "text-gray-900",
        className
      )}
    >
      <div className="flex flex-col items-start self-start">
        <span className="font-black text-xl md:text-2xl leading-none">{card.rank}</span>
        <SuitIcon size={18} className="fill-current" />
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <SuitIcon size={32} className={cn("md:w-10 md:h-10 fill-current opacity-10")} />
      </div>
      
      <div className="flex flex-col items-start self-end rotate-180">
        <span className="font-black text-xl md:text-2xl leading-none">{card.rank}</span>
        <SuitIcon size={18} className="fill-current" />
      </div>
    </motion.div>
  );
}
