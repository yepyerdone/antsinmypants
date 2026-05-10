/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import * as THREE from 'three';
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

export type GameState = 'menu' | 'playing' | 'gameover';
export type EntityState = 'active' | 'disabled';

export interface EnemyData {
  id: string;
  position: [number, number, number];
  state: EntityState;
  disabledUntil: number;
}

export interface LaserData {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  timestamp: number;
  color: string;
}

export interface ParticleData {
  id: string;
  position: [number, number, number];
  timestamp: number;
  color: string;
}

export interface GameEvent {
  id: string;
  message: string;
  timestamp: number;
}

export interface HighScoreEntry {
  id: string;
  name: string;
  score: number;
  wave: number;
  date: string;
  userId?: string;
}

interface GameStore {
  gameState: GameState;
  score: number;
  wave: number;
  enemiesRemaining: number;
  playerState: EntityState;
  playerDisabledUntil: number;
  enemies: EnemyData[];
  lasers: LaserData[];
  particles: ParticleData[];
  events: GameEvent[];
  sensitivity: number;
  playerName: string;
  highScores: HighScoreEntry[];
  
  startGame: () => void;
  endGame: () => void;
  leaveGame: () => void;
  updateTime: (delta: number) => void;
  hitPlayer: () => void;
  hitEnemy: (id: string, byPlayer?: boolean) => void;
  addLaser: (start: [number, number, number], end: [number, number, number], color: string) => void;
  addParticles: (position: [number, number, number], color: string) => void;
  addEvent: (message: string) => void;
  updateEnemies: (time: number) => void;
  cleanupEffects: (time: number) => void;
  setPlayerState: (state: EntityState) => void;
  setSensitivity: (sensitivity: number) => void;
  setPlayerName: (name: string) => void;
  loadHighScores: () => Promise<void>;
  addHighScore: (score: number, wave: number) => void;
  
  // Mobile Controls
  mobileInput: {
    move: { x: number, y: number };
    look: { x: number, y: number };
    shooting: boolean;
  };
  setMobileInput: (input: Partial<{
    move: { x: number, y: number };
    look: { x: number, y: number };
    shooting: boolean;
  }>) => void;
}

const SETTINGS_KEY = 'fun-house-frenzy-settings';
const SCORES_KEY = 'fun-house-frenzy-high-scores';

function loadSettings() {
  if (typeof window === 'undefined') {
    return { sensitivity: 1, playerName: 'Player' };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<Pick<GameStore, 'sensitivity' | 'playerName'>>;
    return {
      sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : 1,
      playerName: typeof parsed.playerName === 'string' && parsed.playerName.trim() ? parsed.playerName : 'Player',
    };
  } catch {
    return { sensitivity: 1, playerName: 'Player' };
  }
}

function saveSettings(sensitivity: number, playerName: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sensitivity, playerName }));
}

function loadHighScores(): HighScoreEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SCORES_KEY) || '[]') as HighScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(entry => typeof entry.name === 'string' && typeof entry.score === 'number' && typeof entry.wave === 'number')
      .slice(0, 10);
  } catch {
    return [];
  }
}

function saveHighScores(scores: HighScoreEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 10)));
}

const FUN_HOUSE_SCORES_COLLECTION = 'fun_house_frenzy_scores';

async function loadFirebaseHighScores(): Promise<HighScoreEntry[]> {
  const scoresQuery = query(
    collection(db, FUN_HOUSE_SCORES_COLLECTION),
    orderBy('score', 'desc'),
    limit(10)
  );
  const snapshot = await getDocs(scoresQuery);
  return snapshot.docs.map((scoreDoc) => {
    const data = scoreDoc.data();
    return {
      id: scoreDoc.id,
      name: typeof data.name === 'string' ? data.name : 'Player',
      score: typeof data.score === 'number' ? data.score : 0,
      wave: typeof data.wave === 'number' ? data.wave : 1,
      date: typeof data.date === 'string' ? data.date : '',
      userId: typeof data.userId === 'string' ? data.userId : undefined,
    };
  });
}

async function saveFirebaseHighScore(score: number, wave: number, name: string) {
  const user = auth.currentUser;
  if (!user || score <= 0) return;

  await addDoc(collection(db, FUN_HOUSE_SCORES_COLLECTION), {
    userId: user.uid,
    name: name.trim() || user.displayName || 'Player',
    score,
    wave,
    date: new Date().toLocaleDateString(),
    createdAt: serverTimestamp(),
  });
}

const initialSettings = loadSettings();

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: 'menu',
  score: 0,
  wave: 1,
  enemiesRemaining: 0,
  playerState: 'active',
  playerDisabledUntil: 0,
  enemies: [],
  lasers: [],
  particles: [],
  events: [],
  sensitivity: initialSettings.sensitivity,
  playerName: initialSettings.playerName,
  highScores: loadHighScores(),

  mobileInput: {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    shooting: false
  },

  setMobileInput: (input) => set((state) => ({
    mobileInput: { ...state.mobileInput, ...input }
  })),

  startGame: () => {
    const startWave = 1;
    const enemyCount = 4 + (startWave * 2);
    const newEnemies: EnemyData[] = [];
    
    for (let i = 0; i < enemyCount; i++) {
        let x, z;
        do {
            x = (Math.random() - 0.5) * 150;
            z = (Math.random() - 0.5) * 150;
        } while (Math.abs(x) < 20 && Math.abs(z) < 20);

        newEnemies.push({
            id: `enemy-${i}`,
            position: [x, 1, z],
            state: 'active',
            disabledUntil: 0
        });
    }

    set({
      gameState: 'playing',
      score: 0,
      wave: startWave,
      enemiesRemaining: enemyCount,
      playerState: 'active',
      playerDisabledUntil: 0,
      enemies: newEnemies,
      lasers: [],
      particles: [],
      events: [{ id: 'start', message: `WAVE ${startWave} START!`, timestamp: Date.now() }],
    });
  },

  endGame: () => {
    const state = get();
    get().addHighScore(state.score, state.wave);
    set({ gameState: 'gameover' });
  },

  leaveGame: () => {
    const state = get();
    if (state.score > 0) {
      get().addHighScore(state.score, state.wave);
    }

    set({
      gameState: 'menu',
      enemies: [],
      lasers: [],
      particles: [],
      events: [],
      score: 0,
      wave: 1,
      enemiesRemaining: 0,
      playerState: 'active'
    });
  },

  updateTime: (delta) => set((state) => {
    if (state.gameState !== 'playing') return state;
    return state; // In offline mode, time doesn't necessarily end the game unless we want it to
  }),

  hitPlayer: () => set((state) => {
    if (state.playerState === 'disabled' || state.gameState !== 'playing') return state;
    
    const newScore = Math.max(0, state.score - 25);
    // If player health was a thing, we'd handle it here. 
    // For now, laser tag style: just disable for a bit.
    return {
      playerState: 'disabled',
      playerDisabledUntil: Date.now() + 2000,
      score: newScore,
    };
  }),

  hitEnemy: (id, byPlayer = false) => set((state) => {
    if (state.gameState !== 'playing') return state;
    
    const targetEnemy = state.enemies.find(e => e.id === id);
    if (!targetEnemy || targetEnemy.state === 'disabled') return state;

    const newEnemies = state.enemies.map(e => {
      if (e.id === id) {
        return { ...e, state: 'disabled' as EntityState, disabledUntil: Infinity }; // Permanently disable for this wave
      }
      return e;
    });

    const activeEnemies = newEnemies.filter(e => e.disabledUntil !== Infinity).length;
    const newScore = byPlayer ? state.score + 100 : state.score;
    
    // Check if wave is cleared
    if (activeEnemies === 0) {
        const nextWave = state.wave + 1;
        const nextEnemyCount = 4 + (nextWave * 2);
        const spawnedEnemies: EnemyData[] = [];
        
        for (let i = 0; i < nextEnemyCount; i++) {
            let x, z;
            do {
                x = (Math.random() - 0.5) * 150;
                z = (Math.random() - 0.5) * 150;
            } while (Math.abs(x) < 20 && Math.abs(z) < 20);

            spawnedEnemies.push({
                id: `enemy-w${nextWave}-${i}`,
                position: [x, 1, z],
                state: 'active',
                disabledUntil: 0
            });
        }

        return {
            enemies: spawnedEnemies,
            enemiesRemaining: nextEnemyCount,
            wave: nextWave,
            score: newScore + (state.wave * 500), // Wave bonus
            events: [...state.events, { id: Math.random().toString(), message: `WAVE ${nextWave} STARTING!`, timestamp: Date.now() }]
        };
    }

    return {
      enemies: newEnemies,
      enemiesRemaining: activeEnemies,
      score: newScore,
      events: byPlayer ? [...state.events, { id: Math.random().toString(), message: `Enemy neutralised!`, timestamp: Date.now() }] : state.events
    };
  }),

  addLaser: (start, end, color) => {
    set((state) => ({
      lasers: [...state.lasers, { id: Math.random().toString(36).substr(2, 9), start, end, timestamp: Date.now(), color }]
    }));
  },

  addParticles: (position, color) => set((state) => ({
    particles: [...state.particles, { id: Math.random().toString(36).substr(2, 9), position, timestamp: Date.now(), color }]
  })),

  addEvent: (message) => set((state) => ({
    events: [...state.events, { id: Math.random().toString(), message, timestamp: Date.now() }]
  })),

  updateEnemies: (time) => set((state) => {
    let changed = false;
    const enemies = state.enemies.map(e => {
        // Only recover standard disabled enemies, not those marked with Infinity (dead in wave)
      if (e.state === 'disabled' && e.disabledUntil !== Infinity && time > e.disabledUntil) {
        changed = true;
        return { ...e, state: 'active' as EntityState };
      }
      return e;
    });
    
    if (state.playerState === 'disabled' && time > state.playerDisabledUntil) {
      return { enemies, playerState: 'active' };
    }
    return changed ? { enemies } : state;
  }),

  cleanupEffects: (time) => set((state) => {
    const lasers = state.lasers.filter(l => time - l.timestamp < 200);
    const particles = state.particles.filter(p => time - p.timestamp < 500);
    const events = state.events.filter(e => time - e.timestamp < 5000);
    if (lasers.length !== state.lasers.length || particles.length !== state.particles.length || events.length !== state.events.length) {
      return { lasers, particles, events };
    }
    return state;
  }),

  setPlayerState: (playerState) => set({ playerState }),

  setSensitivity: (sensitivity) => set((state) => {
    const nextSensitivity = Math.min(2, Math.max(0.25, sensitivity));
    saveSettings(nextSensitivity, state.playerName);
    return { sensitivity: nextSensitivity };
  }),

  setPlayerName: (name) => set((state) => {
    const playerName = name.slice(0, 16);
    saveSettings(state.sensitivity, playerName);
    return { playerName };
  }),

  loadHighScores: async () => {
    try {
      const scores = await loadFirebaseHighScores();
      set({ highScores: scores });
      saveHighScores(scores);
    } catch (error) {
      console.error('Failed to load Fun House Frenzy scores:', error);
    }
  },

  addHighScore: (score, wave) => set((state) => {
    if (score <= 0) return state;

    const nextScores = [
      ...state.highScores,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: state.playerName.trim() || 'Player',
        score,
        wave,
        date: new Date().toLocaleDateString(),
      },
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    saveHighScores(nextScores);
    void saveFirebaseHighScore(score, wave, state.playerName).catch((error) => {
      console.error('Failed to save Fun House Frenzy score:', error);
    });
    return { highScores: nextScores };
  })
}));
