export type GameStatus = 'waiting' | 'playing' | 'finished';

export type LobbyVariant = 'standard' | 'chess960';

export type BotDifficultyId = 'beginner' | 'easy' | 'casual' | 'intermediate' | 'advanced' | 'expert';

export interface BotDifficulty {
  id: BotDifficultyId;
  name: string;
  estimatedElo: string;
  elo: number;
  skill: number;
  depth: number;
  movetime: number;
}

export interface BotGameConfig {
  difficulty: BotDifficulty;
  timeControl: number;
  playerName: string;
  theme?: string;
}

export interface LobbyData {
  id: string;
  code: string;
  playerW: string;
  playerB?: string;
  whiteName: string;
  blackName?: string;
  fen: string;
  initialFen?: string;
  status: GameStatus;
  turn: 'w' | 'b';
  variant?: LobbyVariant;
  winner?: string;
  moveCount: number;
  isQuickMatch?: boolean;
  isBotGame?: boolean;
  botDifficulty?: BotDifficultyId;
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
  fenBefore?: string;
  fenAfter?: string;
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
