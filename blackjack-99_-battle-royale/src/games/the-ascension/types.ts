export type Rank = 'CHUD' | 'LTN' | 'MTN' | 'HTN' | 'CHADLITE' | 'CHAD';

export interface UserProfile {
  uid: string;
  username: string;
  elo: number;
  rank: Rank;
  wins: number;
  losses: number;
  winStreak?: number;
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
  rtcOffer?: RTCSessionDescriptionInit;
  rtcAnswer?: RTCSessionDescriptionInit;
  player1IceCandidates?: RTCIceCandidateInit[];
  player2IceCandidates?: RTCIceCandidateInit[];
  player1LiveFrame?: string;
  player2LiveFrame?: string;
  player1LiveFrameAt?: number;
  player2LiveFrameAt?: number;
  processedPlayers?: string[];
  status: 'searching' | 'in_progress' | 'finished';
  winnerId?: string | null;
  createdAt: any;
  updatedAt: any;
}

export const getRank = (elo: number): Rank => {
  if (elo < 100) return 'CHUD';
  if (elo < 250) return 'LTN';
  if (elo < 500) return 'MTN';
  if (elo < 750) return 'HTN';
  if (elo < 1000) return 'CHADLITE';
  return 'CHAD';
};

export const calculateAscensionEloChange = (win: boolean, currentWinStreak = 0) => {
  if (!win) return -50;
  return 50 * Math.max(1, currentWinStreak + 1);
};
