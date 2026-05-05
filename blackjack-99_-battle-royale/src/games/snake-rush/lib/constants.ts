export type GameMode = 'classic' | 'chill' | 'speed';
export type BoardSize = 'small' | 'medium' | 'large';

export const BOARD_CONFIG = {
  small: { cols: 15, rows: 15 },
  medium: { cols: 20, rows: 20 },
  large: { cols: 25, rows: 25 }, // Keeping large slightly constrained for mobile
};

export const INITIAL_SPEED = {
  classic: 150,
  chill: 150,
  speed: 120, // starts faster
};

export const SPEED_INCREMENT = {
  classic: 2,
  chill: 2,
  speed: 5, // gets faster much quicker
};

export const MIN_SPEED = {
  classic: 50,
  chill: 50,
  speed: 30,
};

export const FOOD_POINTS = 10;
