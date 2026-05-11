/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';
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
  hearts: number;
  ammo: number;
  isReloading: boolean;
  reloadEndsAt: number;
  spawnDoorOpen: boolean;
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
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  leaveGame: () => void;
  updateTime: (delta: number) => void;
  hitPlayer: () => void;
  hitEnemy: (id: string, byPlayer?: boolean) => void;
  openSpawnDoor: () => void;
  useAmmo: () => boolean;
  startReload: () => void;
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
const STARTING_HEARTS = 3;
const MAX_AMMO = 5;
const RELOAD_DURATION_MS = 3000;
const ARENA_SPAWN_LIMIT = 82;
const PLAYER_SAFE_RADIUS = 28;
const ENEMY_SPAWN_SPACING = 22;
const MINIMUM_FALLBACK_SPAWN_SPACING = 16;
const OBSTACLE_SPAWN_PADDING = 4.5;
const SPAWN_ROOM_HALF_WIDTH = 8;
const SPAWN_ROOM_HALF_DEPTH = 8;
const SPAWN_ROOM_BUFFER = 14;

type SpawnObstacle = {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
};

function mulberry32(seed: number) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSpawnObstacles(): SpawnObstacle[] {
  const random = mulberry32(12345);
  const obstacles: SpawnObstacle[] = [];

  for (let index = 0; index < 80; index += 1) {
    const x = (random() - 0.5) * 170;
    const z = (random() - 0.5) * 170;

    if (Math.abs(x) < 20 && Math.abs(z) < 20) {
      continue;
    }

    random();
    const isHorizontal = random() > 0.5;
    const width = isHorizontal ? random() * 25 + 10 : random() * 3 + 1;
    const depth = isHorizontal ? random() * 3 + 1 : random() * 25 + 10;
    random();

    obstacles.push({
      x,
      z,
      halfWidth: width / 2,
      halfDepth: depth / 2,
    });
  }

  return obstacles;
}

const SPAWN_OBSTACLES = createSpawnObstacles();

function getEnemyCountForWave(wave: number) {
  return 4 + (wave * 2);
}

function getActiveEnemyCount(enemies: EnemyData[]) {
  return enemies.filter(enemy => enemy.disabledUntil !== Infinity).length;
}

function getDistance2D(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function isInsideObstacle(position: [number, number, number]) {
  const [x, , z] = position;
  return SPAWN_OBSTACLES.some(obstacle => (
    Math.abs(x - obstacle.x) < obstacle.halfWidth + OBSTACLE_SPAWN_PADDING
    && Math.abs(z - obstacle.z) < obstacle.halfDepth + OBSTACLE_SPAWN_PADDING
  ));
}

function isNearSpawnRoom(position: [number, number, number]) {
  const [x, , z] = position;
  return (
    Math.abs(x) < SPAWN_ROOM_HALF_WIDTH + SPAWN_ROOM_BUFFER
    && Math.abs(z) < SPAWN_ROOM_HALF_DEPTH + SPAWN_ROOM_BUFFER
  );
}

function isValidSpawnPosition(position: [number, number, number], selectedPositions: [number, number, number][], spacing = ENEMY_SPAWN_SPACING) {
  const distanceFromPlayer = Math.hypot(position[0], position[2]);
  if (distanceFromPlayer < PLAYER_SAFE_RADIUS) return false;
  if (isNearSpawnRoom(position)) return false;
  if (isInsideObstacle(position)) return false;

  return selectedPositions.every(selectedPosition => (
    getDistance2D(position, selectedPosition) >= spacing
  ));
}

function createRandomSpawnPosition(): [number, number, number] {
  return [
    (Math.random() * 2 - 1) * ARENA_SPAWN_LIMIT,
    1,
    (Math.random() * 2 - 1) * ARENA_SPAWN_LIMIT,
  ];
}

function createFallbackSpawnPosition(index: number, count: number, wave: number): [number, number, number] {
  const ring = Math.floor(index / 8);
  const ringIndex = index % 8;
  const ringCount = Math.min(8, count - (ring * 8));
  const angle = wave * 0.43 + ring * 0.29 + (ringIndex / ringCount) * Math.PI * 2;
  const radius = Math.min(ARENA_SPAWN_LIMIT, PLAYER_SAFE_RADIUS + 12 + ring * 13);

  return [
    Math.cos(angle) * radius,
    1,
    Math.sin(angle) * radius,
  ];
}

function createSectorSpawnPosition(index: number, count: number, wave: number): [number, number, number] {
  const angle = wave * 0.41 + (index / count) * Math.PI * 2;
  const radiusBand = index % 3;
  const radius = Math.min(ARENA_SPAWN_LIMIT, 34 + radiusBand * 20);

  return [
    Math.cos(angle) * radius,
    1,
    Math.sin(angle) * radius,
  ];
}

function getSafeSpawnPosition(index: number, count: number, wave: number, selectedPositions: [number, number, number][]): [number, number, number] {
  const sectorPosition = createSectorSpawnPosition(index, count, wave);
  if (isValidSpawnPosition(sectorPosition, selectedPositions)) {
    return sectorPosition;
  }

  for (let attempt = 0; attempt < 250; attempt += 1) {
    const position = createRandomSpawnPosition();
    if (isValidSpawnPosition(position, selectedPositions)) {
      return position;
    }
  }

  for (let fallbackIndex = 0; fallbackIndex < 48; fallbackIndex += 1) {
    const position = createFallbackSpawnPosition(index + fallbackIndex, count + fallbackIndex, wave);
    if (isValidSpawnPosition(position, selectedPositions)) {
      return position;
    }
  }

  for (let fallbackIndex = 0; fallbackIndex < 80; fallbackIndex += 1) {
    const position = createFallbackSpawnPosition(index + fallbackIndex, count + fallbackIndex, wave);
    if (isValidSpawnPosition(position, selectedPositions, MINIMUM_FALLBACK_SPAWN_SPACING)) {
      return position;
    }
  }

  return createSectorSpawnPosition(index, count, wave);
}

function createWaveEnemies(wave: number): EnemyData[] {
  const enemyCount = getEnemyCountForWave(wave);
  const selectedPositions: [number, number, number][] = [];

  return Array.from({ length: enemyCount }, (_, index) => {
    const position = getSafeSpawnPosition(index, enemyCount, wave, selectedPositions);
    selectedPositions.push(position);

    return {
      id: `enemy-w${wave}-${index}`,
      position,
      state: 'active',
      disabledUntil: 0,
    };
  });
}

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

function dedupeHighScores(scores: HighScoreEntry[]) {
  const bestScores = new Map<string, HighScoreEntry>();

  scores.forEach((score) => {
    const key = score.userId || score.name.trim().toLowerCase();
    const current = bestScores.get(key);
    if (!current || score.score > current.score) {
      bestScores.set(key, score);
    }
  });

  return Array.from(bestScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

async function loadFirebaseHighScores(): Promise<HighScoreEntry[]> {
  const scoresQuery = query(
    collection(db, FUN_HOUSE_SCORES_COLLECTION),
    orderBy('score', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(scoresQuery);
  return dedupeHighScores(snapshot.docs.map((scoreDoc) => {
    const data = scoreDoc.data();
    return {
      id: scoreDoc.id,
      name: typeof data.name === 'string' ? data.name : 'Player',
      score: typeof data.score === 'number' ? data.score : 0,
      wave: typeof data.wave === 'number' ? data.wave : 1,
      date: typeof data.date === 'string' ? data.date : '',
      userId: typeof data.userId === 'string' ? data.userId : undefined,
    };
  }));
}

async function saveFirebaseHighScore(score: number, wave: number, name: string) {
  const user = auth.currentUser;
  if (!user || score <= 0) return;

  const scoreRef = doc(db, FUN_HOUSE_SCORES_COLLECTION, user.uid);
  const currentScore = await getDoc(scoreRef);
  const previousScore = currentScore.exists() && typeof currentScore.data().score === 'number'
    ? currentScore.data().score
    : 0;

  if (previousScore >= score) return;

  await setDoc(scoreRef, {
    userId: user.uid,
    name: name.trim() || user.displayName || 'Player',
    score,
    wave,
    date: new Date().toLocaleDateString(),
    updatedAt: serverTimestamp(),
  });
}

const initialSettings = loadSettings();

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: 'menu',
  score: 0,
  wave: 1,
  hearts: STARTING_HEARTS,
  ammo: MAX_AMMO,
  isReloading: false,
  reloadEndsAt: 0,
  spawnDoorOpen: false,
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
    const newEnemies = createWaveEnemies(startWave);

    set({
      gameState: 'playing',
      score: 0,
      wave: startWave,
      hearts: STARTING_HEARTS,
      ammo: MAX_AMMO,
      isReloading: false,
      reloadEndsAt: 0,
      spawnDoorOpen: false,
      enemiesRemaining: getActiveEnemyCount(newEnemies),
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
    if ((state.gameState === 'playing' || state.gameState === 'paused') && state.score > 0) {
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
      hearts: STARTING_HEARTS,
      ammo: MAX_AMMO,
      isReloading: false,
      reloadEndsAt: 0,
      spawnDoorOpen: false,
      enemiesRemaining: 0,
      playerState: 'active'
    });
  },

  pauseGame: () => set((state) => (
    state.gameState === 'playing' ? { gameState: 'paused' } : state
  )),

  resumeGame: () => set((state) => (
    state.gameState === 'paused' ? { gameState: 'playing' } : state
  )),

  updateTime: (delta) => set((state) => {
    if (state.gameState !== 'playing') return state;
    if (state.isReloading && Date.now() >= state.reloadEndsAt) {
      return {
        ammo: MAX_AMMO,
        isReloading: false,
        reloadEndsAt: 0,
        events: [...state.events, { id: Math.random().toString(), message: 'Reload complete!', timestamp: Date.now() }],
      };
    }
    return state; // In offline mode, time doesn't necessarily end the game unless we want it to
  }),

  hitPlayer: () => {
    const state = get();
    if (state.playerState === 'disabled' || state.gameState !== 'playing') return state;
    
    const nextHearts = Math.max(0, state.hearts - 1);
    const newScore = Math.max(0, state.score - 25);
    const nextEvents = [
      ...state.events,
      {
        id: Math.random().toString(),
        message: nextHearts > 0 ? `${nextHearts} HEARTS LEFT!` : 'NO HEARTS LEFT!',
        timestamp: Date.now(),
      },
    ];

    if (nextHearts === 0) {
      get().addHighScore(newScore, state.wave);
      set({
        gameState: 'gameover',
        playerState: 'disabled',
        playerDisabledUntil: Infinity,
        hearts: 0,
        score: newScore,
        events: nextEvents,
      });
      return;
    }

    set({
      playerState: 'disabled',
      playerDisabledUntil: Date.now() + 2000,
      hearts: nextHearts,
      score: newScore,
      events: nextEvents,
    });
  },

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

    const activeEnemies = getActiveEnemyCount(newEnemies);
    const newScore = byPlayer ? state.score + 100 : state.score;
    
    // Check if wave is cleared
    if (activeEnemies === 0) {
        const nextWave = state.wave + 1;
        const spawnedEnemies = createWaveEnemies(nextWave);

        return {
            enemies: spawnedEnemies,
            enemiesRemaining: getActiveEnemyCount(spawnedEnemies),
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

  openSpawnDoor: () => set((state) => {
    if (state.spawnDoorOpen || state.gameState !== 'playing') return state;

    return {
      spawnDoorOpen: true,
      events: [...state.events, { id: Math.random().toString(), message: 'Spawn door opened!', timestamp: Date.now() }],
    };
  }),

  useAmmo: () => {
    const state = get();
    if (state.gameState !== 'playing' || state.isReloading) return false;
    if (state.ammo <= 0) {
      get().startReload();
      return false;
    }

    set({ ammo: state.ammo - 1 });
    return true;
  },

  startReload: () => set((state) => {
    if (state.gameState !== 'playing' || state.isReloading || state.ammo === MAX_AMMO) return state;

    return {
      isReloading: true,
      reloadEndsAt: Date.now() + RELOAD_DURATION_MS,
      events: [...state.events, { id: Math.random().toString(), message: 'Reloading!', timestamp: Date.now() }],
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

    const nextScores = dedupeHighScores([
      ...state.highScores,
      {
        id: auth.currentUser?.uid || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: state.playerName.trim() || 'Player',
        score,
        wave,
        date: new Date().toLocaleDateString(),
        userId: auth.currentUser?.uid,
      },
    ]);

    saveHighScores(nextScores);
    void saveFirebaseHighScore(score, wave, state.playerName).catch((error) => {
      console.error('Failed to save Fun House Frenzy score:', error);
    });
    return { highScores: nextScores };
  })
}));
