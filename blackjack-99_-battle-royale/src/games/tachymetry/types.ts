/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TetrominoType } from './constants';

export interface Piece {
  type: TetrominoType;
  pos: { x: number; y: number };
  rotation: number;
  shape: number[][];
}

export type BoardCell = string | null;
export type Board = BoardCell[][];

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface GameState {
  board: Board;
  currentPiece: Piece | null;
  nextPiece: TetrominoType;
  holdPiece: TetrominoType | null;
  canHold: boolean;
  score: number;
  level: number;
  lines: number;
  gameOver: boolean;
  paused: boolean;
  highScore: number;
  combo: number;
}
