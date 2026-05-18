export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Score {
  playerName: string;
  score: number;
  timestamp: number;
  userId?: string;
}

export interface Mole {
  id: number;
  active: boolean;
  type: 'standard' | 'golden' | 'red';
}
