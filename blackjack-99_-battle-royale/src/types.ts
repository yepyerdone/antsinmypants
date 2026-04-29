
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerStatus = 'playing' | 'standing' | 'busted' | 'eliminated' | 'winner' | 'blackjack';

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  status: PlayerStatus;
  isBot: boolean;
  score: number;
  wins?: number;
}

export interface GameState {
  players: Player[];
  dealer: {
    hand: Card[];
    score: number;
    hidden: boolean;
  };
  deck: Card[];
  round: number;
  phase: 'betting' | 'dealing' | 'player-turn' | 'dealer-turn' | 'round-end' | 'game-over';
  currentPlayerIndex: number;
  timeLeft: number;
  winnerId: string | null;
}
