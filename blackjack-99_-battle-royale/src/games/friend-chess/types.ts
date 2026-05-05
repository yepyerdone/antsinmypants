export type GameStatus = 'waiting' | 'playing' | 'finished';

export type LobbyVariant = 'standard' | 'chess960';

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
  variant?: LobbyVariant;
  winner?: string;
  moveCount: number;
  isQuickMatch?: boolean;
  theme?: string;
  timeControl?: number;
  clocks?: {
    w: number;
    b: number;
    lastTickAt?: unknown;
  };
  moves?: string[];
  createdAt: unknown;
  /** Firestore Timestamp-like */
  updatedAt?: { seconds: number } | null;
}

export interface MoveRecord {
  id?: string;
  move: string;
  player: string;
  index: number;
  timestamp: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  theme?: string;
}

export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
}
