export const CASH_VALUES = [
  0.01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500,
  750, 1000, 5000, 10000, 25000, 50000, 75000, 100000,
  200000, 300000, 400000, 500000, 750000, 1000000
];

export const ROUND_STRUCTURE = [6, 5, 4, 3, 2, 1, 1, 1, 1];

export type GameState = 'START' | 'SELECT_PERSONAL' | 'PLAYING' | 'OFFER' | 'FINAL_SWAP' | 'REVEAL' | 'SUMMARY';

export interface BriefcaseData {
  id: number;
  value: number;
  isOpen: boolean;
  isPersonal: boolean;
}

export interface GameStats {
  wonAmount: number;
  peakOffer: number;
  caseValue: number;
  decisions: { round: number; offer: number; expectedValue: number; decision: 'DEAL' | 'NO_DEAL' }[];
}
