export type BallType = 'cue' | 'black' | 'solid' | 'stripe';

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: BallType;
  number: number;
  isPocketed: boolean;
  pocketedIn?: Vector | null;
  // Physics refinement: Spin
  spinX?: number; // Forward/Back spin (vertical relative to cue)
  spinY?: number; // Left/Right spin (horizontal relative to cue)
  rotation?: number; // For visual rotation and side-spin effects
}

export interface Vector {
  x: number;
  y: number;
}

export interface TableConfig {
  width: number;
  height: number;
  ballRadius: number;
  pocketRadius: number;
  friction: number;
  wallBounce: number;
  cushionWidth: number;
  pockets: Vector[];
}

export const TABLE_CONFIG: TableConfig = {
  width: 800,
  height: 400,
  ballRadius: 10,
  pocketRadius: 18,
  friction: 0.99,
  wallBounce: 0.7,
  cushionWidth: 20,
  pockets: [
    { x: 18, y: 18 }, // TL
    { x: 400, y: 15 }, // TM
    { x: 782, y: 18 }, // TR
    { x: 18, y: 382 }, // BL
    { x: 400, y: 385 }, // BM
    { x: 782, y: 382 }, // BR
  ],
};

export type PlayerGroup = 'solids' | 'stripes' | null;

export interface GamePlayer {
  uid: string;
  name: string;
  group: PlayerGroup;
  violations?: number;
}

export type GameMode = 'local' | 'online' | 'bot';
export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface GameState {
  mode: GameMode;
  difficulty?: BotDifficulty;
  players: [GamePlayer, GamePlayer];
  turnIndex: number;
  balls: Ball[];
  firstBallHit: Ball | null;
  ballsPocketedThisTurn: Ball[];
  isMoving: boolean;
  isFoul: boolean;
  foulReason: string | null;
  isBallInHand: boolean;
  nominatedPocket: Vector | null;
  turnStartTime?: number;
  winner: string | null;
  status: 'playing' | 'finished';
}
