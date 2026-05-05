import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Direction } from '../hooks/useSnakeGame';

interface MobileControlsProps {
  onDirectionChange: (dir: Direction) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onDirectionChange }) => {
  return (
    <div className="snake-mobile-controls sm:hidden select-none" aria-label="Mobile direction controls">
      <button 
        type="button"
        className="snake-mobile-button"
        aria-label="Move up"
        onClick={(e) => { e.preventDefault(); onDirectionChange('UP'); }}
        onTouchStart={(e) => { e.preventDefault(); onDirectionChange('UP'); }} // better touch response
      >
        <ArrowUp size={32} />
      </button>
      <div>
        <button 
          type="button"
          className="snake-mobile-button"
          aria-label="Move left"
          onClick={(e) => { e.preventDefault(); onDirectionChange('LEFT'); }}
          onTouchStart={(e) => { e.preventDefault(); onDirectionChange('LEFT'); }}
        >
          <ArrowLeft size={32} />
        </button>
        <button 
          type="button"
          className="snake-mobile-button"
          aria-label="Move down"
          onClick={(e) => { e.preventDefault(); onDirectionChange('DOWN'); }}
          onTouchStart={(e) => { e.preventDefault(); onDirectionChange('DOWN'); }}
        >
          <ArrowDown size={32} />
        </button>
        <button 
          type="button"
          className="snake-mobile-button"
          aria-label="Move right"
          onClick={(e) => { e.preventDefault(); onDirectionChange('RIGHT'); }}
          onTouchStart={(e) => { e.preventDefault(); onDirectionChange('RIGHT'); }}
        >
          <ArrowRight size={32} />
        </button>
      </div>
    </div>
  );
};
