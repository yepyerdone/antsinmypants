/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE } from './types';

interface GameState {
  status: GameStatus;
  score: number;
  speed: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;
  highestScore: number;
  
  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  
  // Shop / Abilities
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL', cost: number) => boolean;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
}

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  score: 0,
  speed: 0,
  laneCount: 5, // Start with a wider lane setup for endless mode
  gemsCollected: 0,
  distance: 0,
  highestScore: Number(localStorage.getItem('neon-rush-high-score')) || 0,
  
  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,

  startGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    speed: RUN_SPEED_BASE,
    laneCount: 5,
    gemsCollected: 0,
    distance: 0,
    hasDoubleJump: false,
    hasImmortality: false,
    isImmortalityActive: false
  }),

  restartGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    speed: RUN_SPEED_BASE,
    laneCount: 5,
    gemsCollected: 0,
    distance: 0,
    hasDoubleJump: false,
    hasImmortality: false,
    isImmortalityActive: false
  }),

  takeDamage: () => {
    const { isImmortalityActive, score, highestScore } = get();
    if (isImmortalityActive) return; // No damage if skill is active

    const newHighScore = Math.max(score, highestScore);
    localStorage.setItem('neon-rush-high-score', newHighScore.toString());
    set({ status: GameStatus.GAME_OVER, speed: 0, highestScore: newHighScore });
  },

  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  
  collectGem: (value) => set((state) => ({ 
    score: state.score + value, 
    gemsCollected: state.gemsCollected + 1 
  })),

  setDistance: (dist) => {
    const { speed, score } = get();
    // Increase score based on distance (roughly 10 points per second if speed is 20)
    // distance is cumulative. Let's just track it.
    // We can increase score by computing delta distance or just updating score on every frame.
    // It's probably better to update the speed based on distance here.
    
    // Increase speed slowly based on distance
    const baseSpeed = RUN_SPEED_BASE;
    // Every 500 units of distance, increase speed by 2
    const speedIncrease = Math.floor(dist / 500) * 2;
    const nextSpeed = baseSpeed + speedIncrease;
    
    set((state) => ({ 
        distance: dist,
        speed: nextSpeed > state.speed ? nextSpeed : state.speed 
    }));
  },

  openShop: () => set({ status: GameStatus.SHOP }),
  
  closeShop: () => set({ status: GameStatus.PLAYING }),

  buyItem: (type, cost) => {
      const { score } = get();
      
      if (score >= cost) {
          set({ score: score - cost });
          
          switch (type) {
              case 'DOUBLE_JUMP':
                  set({ hasDoubleJump: true });
                  break;
              case 'MAX_LIFE':
              case 'HEAL':
                  // Removed from game, but keeping cases to avoid breaking old types if any
                  break;
              case 'IMMORTAL':
                  set({ hasImmortality: true });
                  break;
          }
          return true;
      }
      return false;
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive } = get();
      if (hasImmortality && !isImmortalityActive) {
          set({ isImmortalityActive: true });
          
          // Lasts 5 seconds
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  setStatus: (status) => set({ status }),
}));
