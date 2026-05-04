export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface LobbyData {
  id: string;
  code: string;
  playerW: string;
  playerB?: string;
  whiteName: string;
  blackName?: string;
  fen: string;
  status: GameStatus;
  turn: 'w' | 'b';
  winner?: string;
  moveCount: number;
  isQuickMatch?: boolean;
  theme?: string;
  timeControl?: number; // Total seconds per player
  clocks?: {
    w: number;
    b: number;
    lastTickAt?: any;
  };
  moves?: string[]; // Legacy history format
  createdAt: any;
  updatedAt: any;
}

export interface MoveRecord {
  id?: string;
  move: string; // The notation (SAN)
  player: string; // User ID
  index: number; // Order of move
  timestamp: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  theme?: string;
}

export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
}
