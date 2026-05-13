/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const WORDS = [
  "APPLE", "BEACH", "BRAIN", "BREAD", "BRUSH", "CHAIR", "CHEST", "CHORD", "CLICK", "CLOCK",
  "CLOUD", "DANCE", "DIARY", "DRINK", "DRIVE", "EARTH", "FEAST", "FIELD", "FLAME", "FLUTE",
  "FRUIT", "GLASS", "GRAPE", "GREEN", "GREET", "GRIND", "GUIDE", "HEART", "HOUSE", "JUICE",
  "LIGHT", "LEMON", "MUSIC", "NIGHT", "OCEAN", "PARTY", "PIANO", "PILOT", "PLANE", "PLANT",
  "PLATE", "POUND", "PRIDE", "QUEEN", "QUIET", "RADIO", "RAISE", "RIVER", "ROBOT", "ROUND",
  "SHAKE", "SHARP", "SHEET", "SHIRT", "SHOCK", "SHOUT", "SLEEP", "SMALL", "SMILE", "SMOKE",
  "SOUND", "SPACE", "SPOON", "STAGE", "STAMP", "STAND", "STARE", "STEAM", "STEEL", "STICK",
  "STONE", "STORE", "STORM", "STORY", "STUDY", "TABLE", "TASTE", "THING", "THINK", "TIGER",
  "TOAST", "TOUCH", "TRACK", "TRAIN", "TREAT", "TRICK", "TRUCK", "VOICE", "WATER", "WHEEL",
  "WHERE", "WHICH", "WORLD", "WRITE", "YOUTH", "ZEBRA", "ALIVE", "BRAVE", "CANDY", "DREAM"
];

export const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DELETE"]
];

export type Status = "ABSENT" | "PRESENT" | "CORRECT" | "EMPTY";

export interface GameStats {
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  totalGames: number;
  totalWins: number;
  distribution: Record<number, number>;
  unlockedLevels: number;
}

export interface LevelResult {
  level: number;
  word: string;
  guesses: string[];
  status: "won" | "lost";
  tries: number;
  completedAt: number;
}

export interface LevelAttempt {
  level: number;
  word: string;
  guesses: string[];
  startedAt: number;
  updatedAt: number;
}

export const INITIAL_STATS: GameStats = {
  winRate: 0,
  currentStreak: 0,
  maxStreak: 0,
  totalGames: 0,
  totalWins: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  unlockedLevels: 1
};
