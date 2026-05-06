export interface StateData {
  id: string;
  name: string;
  path: string;
}

export interface ScoreEntry {
  id: string;
  playerName: string;
  timeSeconds: number;
  completedAt: Date;
}
