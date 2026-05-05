export type GameStatus = "lobby" | "playing" | "elimination" | "ended";

export interface Game {
  id: string;
  status: GameStatus;
  hostId: string;
  isPublic: boolean;
  currentRound: number;
  timerValue: number;
  timerStartTime: number | null;
  winnerId: string | null;
  lastEliminatedId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Player {
  uid: string;
  displayName: string;
  isEliminated: boolean;
  isReady: boolean;
  chairId: string | null;
  color: string;
  joinedAt: number;
}

export interface Chair {
  id: string;
  claimedBy: string | null;
  angle: number;
}
