import type { BoardTheme, BotDifficulty } from './types';

/** Firestore paths — isolated from blackjack `rooms` / online data */
export const FC_COLLECTIONS = {
  lobbies: 'friendChessLobbies',
  users: 'friendChessUsers',
} as const;

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    name: 'Classic Black',
    light: '#ffffff',
    dark: '#333333',
  },
  {
    id: 'gold',
    name: 'Royal Gold',
    light: '#f5f5f5',
    dark: '#d4af37',
  },
  {
    id: 'wood',
    name: 'Classic Wood',
    light: '#ebecd0',
    dark: '#779556',
  },
  {
    id: 'marble',
    name: 'Grey Marble',
    light: '#e8e8e8',
    dark: '#5c5c5c',
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    light: '#dee3e6',
    dark: '#2d4b64',
  },
  {
    id: 'vintage',
    name: 'Vintage Red',
    light: '#f2f2f2',
    dark: '#8b0000',
  },
];

export const DEFAULT_THEME = BOARD_THEMES[0];

export const BOT_DIFFICULTIES: BotDifficulty[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    estimatedElo: '~400 ELO',
    elo: 1320,
    skill: 0,
    depth: 1,
    movetime: 120,
  },
  {
    id: 'easy',
    name: 'Easy',
    estimatedElo: '~700 ELO',
    elo: 1350,
    skill: 2,
    depth: 2,
    movetime: 180,
  },
  {
    id: 'casual',
    name: 'Casual',
    estimatedElo: '~1000 ELO',
    elo: 1400,
    skill: 4,
    depth: 4,
    movetime: 260,
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    estimatedElo: '~1300 ELO',
    elo: 1500,
    skill: 7,
    depth: 6,
    movetime: 420,
  },
  {
    id: 'advanced',
    name: 'Advanced',
    estimatedElo: '~1600 ELO',
    elo: 1600,
    skill: 10,
    depth: 8,
    movetime: 650,
  },
  {
    id: 'expert',
    name: 'Expert',
    estimatedElo: '2000+ ELO',
    elo: 2000,
    skill: 16,
    depth: 12,
    movetime: 1000,
  },
];
