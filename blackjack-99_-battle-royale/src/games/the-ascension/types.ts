export type Rank = 'CHUD' | 'LTN' | 'MTN' | 'HTN' | 'CHADLITE' | 'CHAD';

export interface UserProfile {
  uid: string;
  username: string;
  elo: number;
  rank: Rank;
  wins: number;
  losses: number;
  createdAt: any;
  pslScore?: number;
  isVerified?: boolean;
}

export interface Match {
  id: string;
  player1Id: string;
  player2Id?: string;
  player1Username: string;
  player2Username?: string;
  player1Score?: number;
  player2Score?: number;
  player1Analysis?: string;
  player2Analysis?: string;
  status: 'searching' | 'in_progress' | 'finished';
  winnerId?: string | null;
  createdAt: any;
  updatedAt: any;
}

export const getRank = (elo: number): Rank => {
  if (elo < 200) return 'CHUD';
  if (elo < 500) return 'LTN';
  if (elo < 750) return 'MTN';
  if (elo < 1000) return 'HTN';
  if (elo < 1500) return 'CHADLITE';
  return 'CHAD';
};

export const calculateEloChange = (playerElo: number, opponentElo: number, win: boolean) => {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actual = win ? 1 : 0;
  return Math.round(K * (actual - expected));
};
