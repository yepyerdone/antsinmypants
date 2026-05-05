import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Direction } from '../hooks/useSnakeGame';

interface MobileControlsProps {
  onDirectionChange: (dir: Direction) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onDirectionChange }) => {
  return (
    <div className="mt-8 flex flex-col items-center gap-2 sm:hidden select-none">
      <button 
        className="w-16 h-16 glass-panel rounded-xl flex items-center justify-center active:bg-white/20 active:scale-95 transition-all text-white shadow-lg border-white/20"
        onClick={(e) => { e.preventDefault(); onDirectionChange('UP'); }}
        onTouchStart={(e) => { e.preventDefault(); onDirectionChange('UP'); }} // better touch response
      >
        <ArrowUp size={32} />
      </button>
      <div className="flex gap-2">
        <button 
          className="w-16 h-16 glass-panel rounded-xl flex items-center justify-center active:bg-white/20 active:scale-95 transition-all text-white shadow-lg border-white/20"
          onClick={(e) => { e.preventDefault(); onDirectionChange('LEFT'); }}
          onTouchStart={(e) => { e.preventDefault(); onDirectionChange('LEFT'); }}
        >
          <ArrowLeft size={32} />
        </button>
        <button 
          className="w-16 h-16 glass-panel rounded-xl flex items-center justify-center active:bg-white/20 active:scale-95 transition-all text-white shadow-lg border-white/20"
          onClick={(e) => { e.preventDefault(); onDirectionChange('DOWN'); }}
          onTouchStart={(e) => { e.preventDefault(); onDirectionChange('DOWN'); }}
        >
          <ArrowDown size={32} />
        </button>
        <button 
          className="w-16 h-16 glass-panel rounded-xl flex items-center justify-center active:bg-white/20 active:scale-95 transition-all text-white shadow-lg border-white/20"
          onClick={(e) => { e.preventDefault(); onDirectionChange('RIGHT'); }}
          onTouchStart={(e) => { e.preventDefault(); onDirectionChange('RIGHT'); }}
        >
          <ArrowRight size={32} />
        </button>
      </div>
    </div>
  );
};
