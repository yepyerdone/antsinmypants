import type { BoardTheme } from './types';

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
