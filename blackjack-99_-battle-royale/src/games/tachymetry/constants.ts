/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const INITIAL_FALL_SPEED = 600; // ms
export const SPEED_INCREMENT = 0.92; // Speed multiplier per level factor

export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export interface Tetromino {
  shape: number[][];
  color: string;
  glow: string;
}

export const TETROMINOES: Record<TetrominoType, Tetromino> = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: '#00f0f0', // Cyan
    glow: 'rgba(0, 240, 240, 0.5)',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#0000f0', // Blue
    glow: 'rgba(0, 0, 240, 0.5)',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#f0a000', // Orange
    glow: 'rgba(240, 160, 0, 0.5)',
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#f0f000', // Yellow
    glow: 'rgba(240, 240, 0, 0.5)',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: '#00f000', // Lime
    glow: 'rgba(0, 240, 0, 0.5)',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#a000f0', // Purple
    glow: 'rgba(160, 0, 240, 0.5)',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: '#f00000', // Red
    glow: 'rgba(240, 0, 0, 0.5)',
  },
};

// SRS Wall Kick Data
// https://tetris.wiki/Super_Rotation_System#Wall_Kicks
export const WALL_KICK_DATA: Record<string, number[][][]> = {
  standard: [
    [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], // 0->1
    [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],     // 1->0
    [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],     // 1->2
    [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], // 2->1
    [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],    // 2->3
    [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],  // 3->2
    [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],  // 3->0
    [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],    // 0->3
  ],
  I: [
    [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],   // 0->1
    [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],   // 1->0
    [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],   // 1->2
    [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],   // 2->1
    [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],   // 2->3
    [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],   // 3->2
    [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],   // 3->0
    [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],   // 0->3
  ],
};

export const SCORING = {
  SINGLE: 100,
  DOUBLE: 300,
  TRIPLE: 500,
  TETRIS: 800,
  SOFT_DROP: 1,
  HARD_DROP: 2,
};
