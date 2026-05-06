import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Heart, Home, Pause, Play, RotateCcw, Volume2, VolumeX, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Tile, TILE_SIZE, COLORS, COLORS_L2, INITIAL_MAZE, INITIAL_MAZE_2, GRID_WIDTH, GRID_HEIGHT } from './game/constants';
import { db, auth } from './lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';
type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'TRANSITION' | 'GAMEOVER' | 'WIN';
type FeedbackKind = 'power' | 'caught' | 'bonus';

interface Entity {
  x: number;
  y: number;
  dir: Direction;
  nextDir: Direction;
  speed: number;
  type?: string;
  isDead?: boolean;
}

interface Feedback {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  kind: FeedbackKind;
}

const BOARD_WIDTH = GRID_WIDTH * TILE_SIZE;
const BOARD_HEIGHT = GRID_HEIGHT * TILE_SIZE;
const MAX_LIVES = 1;
const PLAYER_SPEED = {
  levelOne: 1.42,
  levelTwo: 1.54
};
const CANDY_SPEED = {
  levelOne: 0.98,
  levelTwo: 1.08
};

const cloneMaze = (source: number[][]) => source.map((row) => [...row]);

const createPlayer = (level: number): Entity => ({
  x: 9 * TILE_SIZE,
  y: 15 * TILE_SIZE,
  dir: 'NONE',
  nextDir: 'NONE',
  speed: level === 2 ? PLAYER_SPEED.levelTwo : PLAYER_SPEED.levelOne
});

const createGhosts = (level: number): Entity[] => {
  const speed = level === 2 ? CANDY_SPEED.levelTwo : CANDY_SPEED.levelOne;
  return [
    { x: 9 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'LEFT', nextDir: 'NONE', speed, type: 'RED', isDead: false },
    { x: 8 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed, type: 'PINK', isDead: false },
    { x: 10 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'RIGHT', nextDir: 'NONE', speed, type: 'CYAN', isDead: false },
    { x: 9 * TILE_SIZE, y: 6 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed, type: 'ORANGE', isDead: false },
  ];
};

const directionAngle: Record<Direction, number> = {
  RIGHT: 0,
  DOWN: Math.PI / 2,
  LEFT: Math.PI,
  UP: -Math.PI / 2,
  NONE: 0
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

export const Game: React.FC = () => {
  const { playerName, playerId, isGuest } = usePlayerIdentity();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(parseInt(localStorage.getItem('molar_madness_highscore') || '0'));
  const [gameState, setGameState] = useState<GameState>('START');
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [maze, setMaze] = useState<number[][]>(cloneMaze(INITIAL_MAZE));
  const [powerTimer, setPowerTimer] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number, id: string}[]>([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<Entity>(createPlayer(1));
  const ghostsRef = useRef<Entity[]>(createGhosts(1));
  const hasStartedRef = useRef(false);
  const cheatBufferRef = useRef('');
  const requestRef = useRef<number>(0);
  const effectsRef = useRef<Feedback[]>([]);
  const hitCooldownRef = useRef(0);
  const scoreRef = useRef(score);
  const levelRef = useRef(level);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const addFeedback = useCallback((x: number, y: number, kind: FeedbackKind, maxAge = 34) => {
    effectsRef.current.push({ x, y, age: 0, maxAge, kind });
  }, []);

  const maybeSaveHighScore = useCallback(() => {
    const finalScore = scoreRef.current;
    setHighScore((prev) => {
      const newHigh = Math.max(prev, finalScore);
      localStorage.setItem('molar_madness_highscore', newHigh.toString());
      return newHigh;
    });
    if (finalScore > (leaderboard.length < 10 ? 0 : leaderboard[leaderboard.length - 1].score)) {
      setShowNameInput(true);
    }
  }, [leaderboard]);

  const resetActors = useCallback((nextLevel = levelRef.current) => {
    playerRef.current = createPlayer(nextLevel);
    ghostsRef.current = createGhosts(nextLevel);
    hasStartedRef.current = false;
    hitCooldownRef.current = 90;
  }, []);

  const isWall = useCallback((nx: number, ny: number) => {
    const gridX = Math.round(nx / TILE_SIZE);
    const gridY = Math.round(ny / TILE_SIZE);

    if (gridY === 9 && (gridX < 0 || gridX >= GRID_WIDTH)) return false;
    if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) return true;
    return maze[gridY][gridX] === Tile.WALL;
  }, [maze]);

  const getValidDirs = useCallback((x: number, y: number, currentDir: string) => {
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const valid = dirs.filter((d) => {
      let nx = x;
      let ny = y;
      if (d === 'UP') ny -= TILE_SIZE;
      if (d === 'DOWN') ny += TILE_SIZE;
      if (d === 'LEFT') nx -= TILE_SIZE;
      if (d === 'RIGHT') nx += TILE_SIZE;
      return !isWall(nx, ny);
    });
    const opposite: Record<string, string> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    const filtered = valid.filter((d) => d !== opposite[currentDir]);
    return filtered.length > 0 ? filtered : valid;
  }, [isWall]);

  const loseLife = useCallback(() => {
    addFeedback(playerRef.current.x + TILE_SIZE / 2, playerRef.current.y + TILE_SIZE / 2, 'caught', 54);
    setLives(0);
    setGameState('GAMEOVER');
    maybeSaveHighScore();
  }, [addFeedback, maybeSaveHighScore]);

  const completeBoard = useCallback(() => {
    if (levelRef.current === 1) {
      setGameState('TRANSITION');
    } else {
      setGameState('WIN');
      maybeSaveHighScore();
      confetti({ particleCount: 140, spread: 72, origin: { y: 0.52 } });
    }
  }, [maybeSaveHighScore]);

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    if (hitCooldownRef.current > 0) hitCooldownRef.current -= 1;

    const player = playerRef.current;
    if (player.dir !== 'NONE') hasStartedRef.current = true;
    const pGridX = Math.round(player.x / TILE_SIZE);
    const pGridY = Math.round(player.y / TILE_SIZE);
    const pCenterX = pGridX * TILE_SIZE;
    const pCenterY = pGridY * TILE_SIZE;

    if (Math.abs(player.x - pCenterX) < player.speed * 0.7 && Math.abs(player.y - pCenterY) < player.speed * 0.7) {
      if (player.nextDir !== 'NONE') {
        let nx = pCenterX;
        let ny = pCenterY;
        if (player.nextDir === 'UP') ny -= TILE_SIZE;
        else if (player.nextDir === 'DOWN') ny += TILE_SIZE;
        else if (player.nextDir === 'LEFT') nx -= TILE_SIZE;
        else if (player.nextDir === 'RIGHT') nx += TILE_SIZE;

        if (!isWall(nx, ny)) {
          player.dir = player.nextDir;
          player.nextDir = 'NONE';
          player.x = pCenterX;
          player.y = pCenterY;
        }
      }

      let wx = pCenterX;
      let wy = pCenterY;
      if (player.dir === 'UP') wy -= TILE_SIZE;
      else if (player.dir === 'DOWN') wy += TILE_SIZE;
      else if (player.dir === 'LEFT') wx -= TILE_SIZE;
      else if (player.dir === 'RIGHT') wx += TILE_SIZE;

      if (isWall(wx, wy)) {
        player.dir = 'NONE';
        player.x = pCenterX;
        player.y = pCenterY;
      }
    }

    if (player.dir === 'UP') player.y -= player.speed;
    else if (player.dir === 'DOWN') player.y += player.speed;
    else if (player.dir === 'LEFT') player.x -= player.speed;
    else if (player.dir === 'RIGHT') player.x += player.speed;

    if (player.x <= -TILE_SIZE) player.x = (GRID_WIDTH - 1) * TILE_SIZE + TILE_SIZE - 2;
    if (player.x >= GRID_WIDTH * TILE_SIZE) player.x = -TILE_SIZE + 2;

    const curX = Math.round(player.x / TILE_SIZE);
    const curY = Math.round(player.y / TILE_SIZE);
    const currentTile = maze[curY]?.[curX];
    if (currentTile === Tile.PELLET || currentTile === Tile.POWER_PELLET) {
      const newMaze = maze.map((row, y) => (y === curY ? row.map((tile, x) => (x === curX ? Tile.EMPTY : tile)) : row));
      setMaze(newMaze);

      if (currentTile === Tile.PELLET) {
        setScore((s) => s + 10);
      } else {
        setScore((s) => s + 50);
        setPowerTimer(600);
        addFeedback(curX * TILE_SIZE + TILE_SIZE / 2, curY * TILE_SIZE + TILE_SIZE / 2, 'power', 58);
      }

      if (!newMaze.some((row) => row.some((tile) => tile === Tile.PELLET || tile === Tile.POWER_PELLET))) {
        completeBoard();
      }
    }

    if (hasStartedRef.current) {
      if (powerTimer > 0) setPowerTimer((prev) => prev - 1);

      ghostsRef.current.forEach((ghost) => {
        const gGridX = Math.round(ghost.x / TILE_SIZE);
        const gGridY = Math.round(ghost.y / TILE_SIZE);
        const gCenterX = gGridX * TILE_SIZE;
        const gCenterY = gGridY * TILE_SIZE;
        const effectiveSpeed = ghost.isDead ? ghost.speed * 2 : (powerTimer > 0 ? ghost.speed * 0.62 : ghost.speed);

        if (Math.abs(ghost.x - gCenterX) < effectiveSpeed * 0.7 && Math.abs(ghost.y - gCenterY) < effectiveSpeed * 0.7) {
          ghost.x = gCenterX;
          ghost.y = gCenterY;

          if (ghost.isDead && gGridX === 9 && (gGridY === 7 || gGridY === 6)) {
            ghost.isDead = false;
          }

          const validDirs = getValidDirs(ghost.x, ghost.y, ghost.dir);
          if (validDirs.length > 0) {
            let bestDir = validDirs[0];
            let targetX = player.x;
            let targetY = player.y;

            if (ghost.isDead) {
              targetX = 9 * TILE_SIZE;
              targetY = 7 * TILE_SIZE;
            }

            let compareDist = ghost.isDead || powerTimer === 0 ? Infinity : -1;

            validDirs.forEach((d) => {
              let nx = ghost.x;
              let ny = ghost.y;
              if (d === 'UP') ny -= TILE_SIZE;
              else if (d === 'DOWN') ny += TILE_SIZE;
              else if (d === 'LEFT') nx -= TILE_SIZE;
              else if (d === 'RIGHT') nx += TILE_SIZE;

              const dist = Math.sqrt((nx - targetX) ** 2 + (ny - targetY) ** 2);
              if (ghost.isDead || powerTimer === 0) {
                if (dist < compareDist) {
                  compareDist = dist;
                  bestDir = d;
                }
              } else if (dist > compareDist) {
                compareDist = dist;
                bestDir = d;
              }
            });
            ghost.dir = bestDir;
          }
        }

        if (ghost.dir === 'UP') ghost.y -= effectiveSpeed;
        else if (ghost.dir === 'DOWN') ghost.y += effectiveSpeed;
        else if (ghost.dir === 'LEFT') ghost.x -= effectiveSpeed;
        else if (ghost.dir === 'RIGHT') ghost.x += effectiveSpeed;

        if (ghost.x <= -TILE_SIZE) ghost.x = (GRID_WIDTH - 1) * TILE_SIZE + TILE_SIZE - 2;
        if (ghost.x >= GRID_WIDTH * TILE_SIZE) ghost.x = -TILE_SIZE + 2;

        if (
          hitCooldownRef.current <= 0 &&
          Math.abs(player.x - ghost.x) < TILE_SIZE * 0.72 &&
          Math.abs(player.y - ghost.y) < TILE_SIZE * 0.72
        ) {
          if (powerTimer > 0 && !ghost.isDead) {
            ghost.isDead = true;
            setScore((s) => s + 200);
            addFeedback(ghost.x + TILE_SIZE / 2, ghost.y + TILE_SIZE / 2, 'bonus', 46);
          } else if (!ghost.isDead) {
            loseLife();
          }
        }
      });
    }
  }, [addFeedback, completeBoard, gameState, getValidDirs, isWall, loseLife, maze, powerTimer]);

  const drawTooth = (ctx: CanvasRenderingContext2D, entity: Entity) => {
    const cx = entity.x + TILE_SIZE / 2;
    const cy = entity.y + TILE_SIZE / 2;
    const bob = Math.sin(Date.now() / 130) * 1.2;

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(directionAngle[entity.dir] * 0.06);
    ctx.imageSmoothingEnabled = false;

    const glow = powerTimer > 0 ? '#00ff88' : '#ffffff';
    ctx.shadowColor = glow;
    ctx.shadowBlur = powerTimer > 0 ? 10 : 5;

    // === MOLAR TOOTH PIXEL ART (20x20 centered, 2px per pixel) ===
    const px = 2; // pixel scale
    const drawPixel = (dx: number, dy: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(dx * px, dy * px, px, px);
    };

    // Molar crown - wide top with two cusps (bumps)
    // Row by row pixel placement for authentic pixel-art look
    const white = '#ffffff';
    const lightGray = '#e8e8e8';
    const midGray = '#d0d0d0';
    const darkGray = '#a0a0a0';
    const eyeColor = '#11313c';

    // Crown top row (cusps/bumps)
    drawPixel(-4, -6, white); drawPixel(-3, -6, white); drawPixel(-2, -7, white); // left cusp
    drawPixel(2, -7, white); drawPixel(3, -6, white); drawPixel(4, -6, white); // right cusp

    // Upper crown
    for (let x = -5; x <= 5; x++) drawPixel(x, -5, white);
    for (let x = -6; x <= 6; x++) drawPixel(x, -4, white);
    for (let x = -6; x <= 6; x++) drawPixel(x, -3, x === -6 || x === 6 ? lightGray : white);

    // Mid body with eyes
    for (let x = -6; x <= 6; x++) {
      let color = white;
      if (x === -6 || x === 6) color = lightGray;
      if (x === -5) color = midGray;
      if (x === 5) color = midGray;
      drawPixel(x, -2, color);
    }

    // Eyes row
    for (let x = -6; x <= 6; x++) {
      let color = white;
      if (x === -4 || x === -3) color = eyeColor; // left eye
      if (x === 3 || x === 4) color = eyeColor; // right eye
      if (x === -6 || x === 6) color = lightGray;
      drawPixel(x, -1, color);
    }

    // Eye highlights
    drawPixel(-3, -1, white);
    drawPixel(4, -1, white);

    // Smile row
    for (let x = -6; x <= 6; x++) {
      let color = white;
      if (x === -2 || x === 2) color = eyeColor; // smile corners
      if (x === -1 || x === 0 || x === 1) color = eyeColor; // smile bottom
      if (x === -6 || x === 6) color = lightGray;
      drawPixel(x, 0, color);
    }

    // Lower body narrowing to neck
    for (let x = -5; x <= 5; x++) drawPixel(x, 1, x === -5 || x === 5 ? lightGray : white);
    for (let x = -5; x <= 5; x++) drawPixel(x, 2, x === -5 || x === 5 ? midGray : white);

    // Neck
    for (let x = -4; x <= 4; x++) drawPixel(x, 3, x === -4 || x === 4 ? lightGray : white);
    for (let x = -4; x <= 4; x++) drawPixel(x, 4, x === -4 || x === 4 ? midGray : lightGray);

    // Split to roots
    for (let x = -4; x <= -1; x++) drawPixel(x, 5, x === -4 ? midGray : white); // left root start
    for (let x = 1; x <= 4; x++) drawPixel(x, 5, x === 4 ? midGray : white); // right root start
    drawPixel(0, 5, darkGray); // gap between roots

    // Roots extending down
    for (let x = -3; x <= -1; x++) drawPixel(x, 6, white);
    for (let x = 1; x <= 3; x++) drawPixel(x, 6, white);
    drawPixel(-4, 6, midGray); drawPixel(4, 6, midGray);

    for (let x = -3; x <= -1; x++) drawPixel(x, 7, x === -3 ? midGray : white);
    for (let x = 1; x <= 3; x++) drawPixel(x, 7, x === 3 ? midGray : white);

    // Root tips (rounded)
    drawPixel(-2, 8, white); drawPixel(-1, 8, white);
    drawPixel(1, 8, white); drawPixel(2, 8, white);

    // Shading/highlight details
    drawPixel(-5, -4, lightGray);
    drawPixel(5, -4, lightGray);
    drawPixel(-5, -3, midGray);
    drawPixel(5, -3, midGray);

    // Power glow outline
    if (powerTimer > 0) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -16, 28, 36);
      ctx.strokeRect(-12, -14, 24, 32);
    }

    ctx.restore();
  };

  const drawPixelCandy = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    candyType: string,
    outlineColor: string = '#000000'
  ) => {
    ctx.imageSmoothingEnabled = false;
    const px = 2;
    const drawPixel = (dx: number, dy: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x + dx * px, y + dy * px, px, px);
    };

    if (candyType === 'LOLLIPOP') {
      // === PIXEL ART LOLLIPOP ===
      const stick = '#8B6914';
      const stickDark = '#5C440E';
      const brightColor = color;
      const darkColor = outlineColor;
      const white = '#ffffff';

      // Stick handle (vertical)
      for (let sy = 3; sy <= 8; sy++) {
        drawPixel(0, sy, stick);
        drawPixel(1, sy, stickDark);
      }
      // Stick bottom rounded
      drawPixel(0, 9, stickDark);

      // Candy head - round circle pixel art (radius ~4)
      // Top row
      drawPixel(-1, -5, darkColor); drawPixel(0, -5, darkColor); drawPixel(1, -5, darkColor); drawPixel(2, -5, darkColor);
      // Upper rows
      drawPixel(-3, -4, darkColor); drawPixel(-2, -4, brightColor); drawPixel(-1, -4, brightColor); 
      drawPixel(0, -4, white); drawPixel(1, -4, brightColor); drawPixel(2, -4, brightColor); drawPixel(3, -4, darkColor);
      
      drawPixel(-4, -3, darkColor); drawPixel(-3, -3, brightColor); drawPixel(-2, -3, brightColor); 
      drawPixel(-1, -3, white); drawPixel(0, -3, brightColor); drawPixel(1, -3, white); 
      drawPixel(2, -3, brightColor); drawPixel(3, -3, brightColor); drawPixel(4, -3, darkColor);

      drawPixel(-4, -2, darkColor); drawPixel(-3, -2, brightColor); drawPixel(-2, -2, white); 
      drawPixel(-1, -2, brightColor); drawPixel(0, -2, brightColor); drawPixel(1, -2, brightColor); 
      drawPixel(2, -2, white); drawPixel(3, -2, brightColor); drawPixel(4, -2, darkColor);

      // Center row (widest)
      drawPixel(-5, -1, darkColor); drawPixel(-4, -1, brightColor); drawPixel(-3, -1, brightColor); 
      drawPixel(-2, -1, brightColor); drawPixel(-1, -1, white); drawPixel(0, -1, white); 
      drawPixel(1, -1, brightColor); drawPixel(2, -1, brightColor); drawPixel(3, -1, brightColor); 
      drawPixel(4, -1, brightColor); drawPixel(5, -1, darkColor);

      drawPixel(-5, 0, darkColor); drawPixel(-4, 0, brightColor); drawPixel(-3, 0, white); 
      drawPixel(-2, 0, brightColor); drawPixel(-1, 0, brightColor); drawPixel(0, 0, brightColor); 
      drawPixel(1, 0, brightColor); drawPixel(2, 0, white); drawPixel(3, 0, brightColor); 
      drawPixel(4, 0, brightColor); drawPixel(5, 0, darkColor);

      drawPixel(-5, 1, darkColor); drawPixel(-4, 1, brightColor); drawPixel(-3, 1, brightColor); 
      drawPixel(-2, 1, white); drawPixel(-1, 1, brightColor); drawPixel(0, 1, brightColor); 
      drawPixel(1, 1, white); drawPixel(2, 1, brightColor); drawPixel(3, 1, brightColor); 
      drawPixel(4, 1, brightColor); drawPixel(5, 1, darkColor);

      drawPixel(-4, 2, darkColor); drawPixel(-3, 2, brightColor); drawPixel(-2, 2, brightColor); 
      drawPixel(-1, 2, brightColor); drawPixel(0, 2, white); drawPixel(1, 2, brightColor); 
      drawPixel(2, 2, brightColor); drawPixel(3, 2, brightColor); drawPixel(4, 2, darkColor);

      drawPixel(-3, 3, darkColor); drawPixel(-2, 3, brightColor); drawPixel(-1, 3, brightColor); 
      drawPixel(0, 3, brightColor); drawPixel(1, 3, brightColor); drawPixel(2, 3, brightColor); drawPixel(3, 3, darkColor);

      // Bottom row
      drawPixel(-1, 4, darkColor); drawPixel(0, 4, darkColor); drawPixel(1, 4, darkColor); drawPixel(2, 4, darkColor);

      // Swirl detail in center
      drawPixel(-1, 0, white); drawPixel(0, -1, white); drawPixel(1, 1, white);

    } else if (candyType === 'GUMMY') {
      // === PIXEL ART GUMMY BEAR ===
      const body = color;
      const dark = outlineColor;
      const belly = '#ffffff';
      const eye = '#000000';
      const white = '#ffffff';

      // Ears (top)
      drawPixel(-4, -8, dark); drawPixel(-3, -8, dark);
      drawPixel(-5, -7, dark); drawPixel(-4, -7, body); drawPixel(-3, -7, body); drawPixel(-2, -7, dark);
      
      drawPixel(2, -8, dark); drawPixel(3, -8, dark);
      drawPixel(2, -7, dark); drawPixel(3, -7, body); drawPixel(4, -7, body); drawPixel(5, -7, dark);

      // Head
      drawPixel(-5, -6, dark); drawPixel(-4, -6, body); drawPixel(-3, -6, body); drawPixel(-2, -6, body); 
      drawPixel(-1, -6, dark); drawPixel(0, -6, dark); drawPixel(1, -6, dark); 
      drawPixel(2, -6, body); drawPixel(3, -6, body); drawPixel(4, -6, body); drawPixel(5, -6, dark);

      drawPixel(-5, -5, dark); drawPixel(-4, -5, body); drawPixel(-3, -5, body); drawPixel(-2, -5, body); 
      drawPixel(-1, -5, body); drawPixel(0, -5, body); drawPixel(1, -5, body); 
      drawPixel(2, -5, body); drawPixel(3, -5, body); drawPixel(4, -5, body); drawPixel(5, -5, dark);

      // Eyes
      drawPixel(-3, -4, eye); drawPixel(-2, -4, white); // left eye
      drawPixel(2, -4, white); drawPixel(3, -4, eye); // right eye

      // Snout/nose area
      drawPixel(-5, -4, dark); drawPixel(-4, -4, body); drawPixel(-1, -4, body); 
      drawPixel(0, -4, dark); drawPixel(1, -4, body); drawPixel(4, -4, body); drawPixel(5, -4, dark);

      drawPixel(-5, -3, dark); drawPixel(-4, -3, body); drawPixel(-3, -3, body); drawPixel(-2, -3, body); 
      drawPixel(-1, -3, body); drawPixel(0, -3, body); drawPixel(1, -3, body); 
      drawPixel(2, -3, body); drawPixel(3, -3, body); drawPixel(4, -3, body); drawPixel(5, -3, dark);

      // Body (wider)
      drawPixel(-6, -2, dark); drawPixel(-5, -2, body); drawPixel(-4, -2, body); drawPixel(-3, -2, body); 
      drawPixel(-2, -2, body); drawPixel(-1, -2, belly); drawPixel(0, -2, belly); drawPixel(1, -2, belly); 
      drawPixel(2, -2, body); drawPixel(3, -2, body); drawPixel(4, -2, body); drawPixel(5, -2, body); drawPixel(6, -2, dark);

      drawPixel(-6, -1, dark); drawPixel(-5, -1, body); drawPixel(-4, -1, body); drawPixel(-3, -1, body); 
      drawPixel(-2, -1, belly); drawPixel(-1, -1, belly); drawPixel(0, -1, belly); 
      drawPixel(1, -1, belly); drawPixel(2, -1, belly); drawPixel(3, -1, body); drawPixel(4, -1, body); 
      drawPixel(5, -1, body); drawPixel(6, -1, dark);

      drawPixel(-6, 0, dark); drawPixel(-5, 0, body); drawPixel(-4, 0, body); drawPixel(-3, 0, belly); 
      drawPixel(-2, 0, belly); drawPixel(-1, 0, belly); drawPixel(0, 0, belly); 
      drawPixel(1, 0, belly); drawPixel(2, 0, belly); drawPixel(3, 0, belly); drawPixel(4, 0, body); 
      drawPixel(5, 0, body); drawPixel(6, 0, dark);

      drawPixel(-6, 1, dark); drawPixel(-5, 1, body); drawPixel(-4, 1, body); drawPixel(-3, 1, body); 
      drawPixel(-2, 1, belly); drawPixel(-1, 1, belly); drawPixel(0, 1, belly); 
      drawPixel(1, 1, belly); drawPixel(2, 1, belly); drawPixel(3, 1, body); drawPixel(4, 1, body); 
      drawPixel(5, 1, body); drawPixel(6, 1, dark);

      // Arms
      drawPixel(-7, -1, dark); drawPixel(-7, 0, dark); // left arm
      drawPixel(7, -1, dark); drawPixel(7, 0, dark); // right arm

      // Lower body narrowing
      drawPixel(-5, 2, dark); drawPixel(-4, 2, body); drawPixel(-3, 2, body); drawPixel(-2, 2, body); 
      drawPixel(-1, 2, belly); drawPixel(0, 2, belly); drawPixel(1, 2, belly); 
      drawPixel(2, 2, body); drawPixel(3, 2, body); drawPixel(4, 2, body); drawPixel(5, 2, dark);

      // Legs
      drawPixel(-4, 3, dark); drawPixel(-3, 3, body); drawPixel(-2, 3, dark); // left leg start
      drawPixel(2, 3, dark); drawPixel(3, 3, body); drawPixel(4, 3, dark); // right leg start

      drawPixel(-4, 4, dark); drawPixel(-3, 4, body); drawPixel(-2, 4, dark); // left foot
      drawPixel(2, 4, dark); drawPixel(3, 4, body); drawPixel(4, 4, dark); // right foot

    } else if (candyType === 'WRAPPED') {
      // === PIXEL ART WRAPPED CANDY ===
      const wrap = color;
      const dark = outlineColor;
      const paper = '#ffffff';
      const shadow = 'rgba(0,0,0,0.2)';

      // Left wrapper twist
      drawPixel(-6, -2, dark); drawPixel(-7, -2, dark);
      drawPixel(-7, -1, paper); drawPixel(-6, -1, wrap); drawPixel(-5, -1, dark);
      drawPixel(-7, 0, paper); drawPixel(-6, 0, wrap); drawPixel(-5, 0, dark);
      drawPixel(-7, 1, paper); drawPixel(-6, 1, wrap); drawPixel(-5, 1, dark);
      drawPixel(-6, 2, dark); drawPixel(-7, 2, dark);

      // Right wrapper twist
      drawPixel(5, -2, dark); drawPixel(6, -2, dark);
      drawPixel(4, -1, dark); drawPixel(5, -1, wrap); drawPixel(6, -1, paper);
      drawPixel(4, 0, dark); drawPixel(5, 0, wrap); drawPixel(6, 0, paper);
      drawPixel(4, 1, dark); drawPixel(5, 1, wrap); drawPixel(6, 1, paper);
      drawPixel(5, 2, dark); drawPixel(6, 2, dark);

      // Main candy body (oval)
      // Top
      drawPixel(-4, -3, dark); drawPixel(-3, -3, wrap); drawPixel(-2, -3, wrap); drawPixel(-1, -3, wrap); 
      drawPixel(0, -3, wrap); drawPixel(1, -3, wrap); drawPixel(2, -3, wrap); drawPixel(3, -3, wrap); drawPixel(4, -3, dark);

      // Upper mid
      drawPixel(-5, -2, dark); drawPixel(-4, -2, wrap); drawPixel(-3, -2, wrap); drawPixel(-2, -2, wrap); 
      drawPixel(-1, -2, paper); drawPixel(0, -2, paper); drawPixel(1, -2, wrap); drawPixel(2, -2, wrap); 
      drawPixel(3, -2, wrap); drawPixel(4, -2, wrap); drawPixel(5, -2, dark);

      // Center rows (widest)
      drawPixel(-5, -1, dark); drawPixel(-4, -1, wrap); drawPixel(-3, -1, wrap); drawPixel(-2, -1, paper); 
      drawPixel(-1, -1, paper); drawPixel(0, -1, paper); drawPixel(1, -1, paper); drawPixel(2, -1, wrap); 
      drawPixel(3, -1, wrap); drawPixel(4, -1, wrap); drawPixel(5, -1, dark);

      drawPixel(-5, 0, dark); drawPixel(-4, 0, wrap); drawPixel(-3, 0, wrap); drawPixel(-2, 0, wrap); 
      drawPixel(-1, 0, paper); drawPixel(0, 0, paper); drawPixel(1, 0, wrap); drawPixel(2, 0, wrap); 
      drawPixel(3, 0, wrap); drawPixel(4, 0, wrap); drawPixel(5, 0, dark);

      drawPixel(-5, 1, dark); drawPixel(-4, 1, wrap); drawPixel(-3, 1, wrap); drawPixel(-2, 1, wrap); 
      drawPixel(-1, 1, wrap); drawPixel(0, 1, wrap); drawPixel(1, 1, wrap); drawPixel(2, 1, wrap); 
      drawPixel(3, 1, wrap); drawPixel(4, 1, wrap); drawPixel(5, 1, dark);

      // Bottom
      drawPixel(-4, 2, dark); drawPixel(-3, 2, wrap); drawPixel(-2, 2, wrap); drawPixel(-1, 2, wrap); 
      drawPixel(0, 2, wrap); drawPixel(1, 2, wrap); drawPixel(2, 2, wrap); drawPixel(3, 2, wrap); drawPixel(4, 2, dark);

      // Wrapper fold lines
      drawPixel(-3, 0, shadow); drawPixel(3, -1, shadow);

    } else {
      // === PIXEL ART JELLY BEAN ===
      const bean = color;
      const dark = outlineColor;
      const shine = '#ffffff';

      // Top curve
      drawPixel(-3, -4, dark); drawPixel(-2, -4, dark); drawPixel(-1, -4, dark); 
      drawPixel(0, -4, dark); drawPixel(1, -4, dark); drawPixel(2, -4, dark);

      drawPixel(-4, -3, dark); drawPixel(-3, -3, bean); drawPixel(-2, -3, bean); drawPixel(-1, -3, bean); 
      drawPixel(0, -3, bean); drawPixel(1, -3, bean); drawPixel(2, -3, bean); drawPixel(3, -3, dark);

      // Upper mid
      drawPixel(-5, -2, dark); drawPixel(-4, -2, bean); drawPixel(-3, -2, bean); drawPixel(-2, -2, bean); 
      drawPixel(-1, -2, shine); drawPixel(0, -2, bean); drawPixel(1, -2, bean); drawPixel(2, -2, bean); 
      drawPixel(3, -2, bean); drawPixel(4, -2, dark);

      // Center (widest)
      drawPixel(-5, -1, dark); drawPixel(-4, -1, bean); drawPixel(-3, -1, bean); drawPixel(-2, -1, bean); 
      drawPixel(-1, -1, bean); drawPixel(0, -1, bean); drawPixel(1, -1, bean); drawPixel(2, -1, bean); 
      drawPixel(3, -1, bean); drawPixel(4, -1, dark);

      drawPixel(-5, 0, dark); drawPixel(-4, 0, bean); drawPixel(-3, 0, bean); drawPixel(-2, 0, bean); 
      drawPixel(-1, 0, bean); drawPixel(0, 0, bean); drawPixel(1, 0, bean); drawPixel(2, 0, bean); 
      drawPixel(3, 0, bean); drawPixel(4, 0, dark);

      // Lower mid - kidney bean curve
      drawPixel(-4, 1, dark); drawPixel(-3, 1, bean); drawPixel(-2, 1, bean); drawPixel(-1, 1, bean); 
      drawPixel(0, 1, bean); drawPixel(1, 1, bean); drawPixel(2, 1, bean); drawPixel(3, 1, dark);

      drawPixel(-3, 2, dark); drawPixel(-2, 2, bean); drawPixel(-1, 2, bean); drawPixel(0, 2, bean); 
      drawPixel(1, 2, bean); drawPixel(2, 2, dark);

      // Indentation for bean shape (right side curves in)
      drawPixel(3, 0, dark);
      drawPixel(3, 1, dark);
      
      // Bottom tip
      drawPixel(-1, 3, dark); drawPixel(0, 3, dark); drawPixel(1, 3, dark);

      // Shine spots
      drawPixel(-1, -2, shine);
      drawPixel(-2, -1, shine);
    }
  };

  const drawGummyDrop = (ctx: CanvasRenderingContext2D, baseColor: string) => {
    const gummyGradient = ctx.createRadialGradient(-4, -6, 2, 0, 0, 13);
    gummyGradient.addColorStop(0, 'rgba(255,255,255,0.92)');
    gummyGradient.addColorStop(0.22, baseColor);
    gummyGradient.addColorStop(1, '#14532d');
    ctx.fillStyle = gummyGradient;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(9, -9, 13, -2, 10, 7);
    ctx.bezierCurveTo(7, 13, -7, 13, -10, 7);
    ctx.bezierCurveTo(-13, -2, -9, -9, 0, -12);
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-4, -5, 3, 5, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const drawLollipop = (ctx: CanvasRenderingContext2D, baseColor: string, stripeColor: string) => {
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 8);
    ctx.lineTo(11, 17);
    ctx.stroke();

    const popGradient = ctx.createRadialGradient(-4, -5, 2, 0, 0, 12);
    popGradient.addColorStop(0, '#ffffff');
    popGradient.addColorStop(0.2, stripeColor);
    popGradient.addColorStop(0.5, baseColor);
    popGradient.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = popGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 11.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 6.8, -0.2, Math.PI * 1.35);
    ctx.stroke();
  };

  const drawHardCandy = (ctx: CanvasRenderingContext2D, baseColor: string, stripeColor: string) => {
    const hardCandyGradient = ctx.createRadialGradient(-4, -5, 2, 0, 0, 12);
    hardCandyGradient.addColorStop(0, '#ffffff');
    hardCandyGradient.addColorStop(0.2, stripeColor);
    hardCandyGradient.addColorStop(0.55, baseColor);
    hardCandyGradient.addColorStop(1, '#713f12');
    ctx.fillStyle = hardCandyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
  };

  const drawCandy = (ctx: CanvasRenderingContext2D, ghost: Entity) => {
    const cx = ghost.x + TILE_SIZE / 2;
    const cy = ghost.y + TILE_SIZE / 2;
    const scared = powerTimer > 0 && !ghost.isDead;
    const candyColors: Record<string, string> = {
      RED: '#ff1744',
      PINK: '#ff4081',
      CYAN: '#00e5ff',
      ORANGE: '#ff9100'
    };
    const color = candyColors[ghost.type || 'RED'] || candyColors.RED;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.imageSmoothingEnabled = false;
    
    if (ghost.isDead) {
      // Dead ghost - pixelated eyes
      ctx.globalAlpha = 0.6;
      drawPixelCandy(ctx, 0, 0, 16, '#808080', 'HARD', '#000000');
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4, -4, 8, 2);
      ctx.fillStyle = '#000000';
      ctx.fillRect(-3, -3, 2, 2);
      ctx.fillRect(2, -3, 2, 2);
    } else if (scared) {
      // Scared ghost - blue pixelated
      drawPixelCandy(ctx, 0, 0, 16, '#60a5fa', 'HARD', '#000000');
      // Scared eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4, -4, 8, 2);
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(-3, -3, 2, 2);
      ctx.fillRect(2, -3, 2, 2);
    } else {
      // Normal ghost - distinct candy types per ghost
      let candyType = 'WRAPPED';
      if (ghost.type === 'RED') {
        candyType = 'LOLLIPOP';
      } else if (ghost.type === 'PINK') {
        candyType = 'GUMMY';
      } else if (ghost.type === 'CYAN') {
        candyType = 'WRAPPED';
      } else if (ghost.type === 'ORANGE') {
        candyType = 'JELLY';
      }
      
      drawPixelCandy(ctx, 0, 0, 20, color, candyType, '#000000');
    }

    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const currentColors = level === 2 ? COLORS_L2 : COLORS;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Pixel art background
    ctx.imageSmoothingEnabled = false;
    
    // Base background
    ctx.fillStyle = currentColors.BG;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Pixel grid pattern
    ctx.strokeStyle = currentColors.GRID_LINE;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let x = 0; x < ctx.canvas.width; x += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ctx.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < ctx.canvas.height; y += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ctx.canvas.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    maze.forEach((row, y) => {
      row.forEach((tile, x) => {
        const tileX = x * TILE_SIZE;
        const tileY = y * TILE_SIZE;

        if (tile === Tile.WALL) {
          // Pixel art wall
          ctx.fillStyle = currentColors.WALL;
          ctx.fillRect(tileX + 2, tileY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          
          // Wall highlight
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(tileX + 2, tileY + 2, TILE_SIZE - 4, 2);
          ctx.fillRect(tileX + 2, tileY + 2, 2, TILE_SIZE - 4);
          
          // Wall shadow
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(tileX + TILE_SIZE - 4, tileY + 2, 2, TILE_SIZE - 4);
          ctx.fillRect(tileX + 2, tileY + TILE_SIZE - 4, TILE_SIZE - 4, 2);
          
          // Wall border
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(tileX + 2, tileY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (tile === Tile.PELLET) {
          // Pixel art pellet
          ctx.fillStyle = currentColors.PELLET;
          ctx.fillRect(tileX + TILE_SIZE/2 - 2, tileY + TILE_SIZE/2 - 2, 4, 4);
          
          // Pellet highlight
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tileX + TILE_SIZE/2 - 1, tileY + TILE_SIZE/2 - 1, 2, 2);
        } else if (tile === Tile.POWER_PELLET) {
          // Pixel art power pellet - animated
          const pulse = Math.sin(Date.now() / 200) * 2;
          const size = 8 + pulse;
          
          ctx.fillStyle = currentColors.POWER_GLOW;
          ctx.fillRect(tileX + TILE_SIZE/2 - size/2, tileY + TILE_SIZE/2 - size/2, size, size);
          
          // Power pellet highlight
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tileX + TILE_SIZE/2 - size/2 + 2, tileY + TILE_SIZE/2 - size/2 + 2, size - 4, size - 4);
          
          // Power pellet border
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(tileX + TILE_SIZE/2 - size/2, tileY + TILE_SIZE/2 - size/2, size, size);
        }
      });
    });

    // Pixel art effects
    effectsRef.current = effectsRef.current
      .map((effect) => ({ ...effect, age: effect.age + 1 }))
      .filter((effect) => effect.age < effect.maxAge);

    effectsRef.current.forEach((effect) => {
      const progress = effect.age / effect.maxAge;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = false;
      
      ctx.strokeStyle = effect.kind === 'caught' ? '#ff1744' : effect.kind === 'bonus' ? '#ffeb3b' : '#00ff88';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 2;
      
      // Pixelated expanding ring
      const radius = 4 + progress * 22;
      const segments = 8;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x1 = effect.x + Math.cos(angle) * radius;
        const y1 = effect.y + Math.sin(angle) * radius;
        const x2 = effect.x + Math.cos(angle + (Math.PI * 2 / segments)) * radius;
        const y2 = effect.y + Math.sin(angle + (Math.PI * 2 / segments)) * radius;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      
      if (effect.kind === 'bonus') {
        ctx.font = '700 11px "Press Start 2P"';
        ctx.fillText('+200', effect.x - 20, effect.y - progress * 18);
      }
      ctx.restore();
    });

    drawTooth(ctx, playerRef.current);
    ghostsRef.current.forEach((ghost) => drawCandy(ctx, ghost));

    // Hit cooldown flash effect - pixelated
    if (hitCooldownRef.current > 0 && Math.floor(hitCooldownRef.current / 6) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 23, 68, 0.15)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Add pixel pattern overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let x = 0; x < ctx.canvas.width; x += 8) {
        for (let y = 0; y < ctx.canvas.height; y += 8) {
          if ((x + y) % 16 === 0) {
            ctx.fillRect(x, y, 4, 4);
          }
        }
      }
      ctx.restore();
    }
  }, [level, maze, powerTimer]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      if (gameState !== 'START') {
        requestRef.current = requestAnimationFrame(loop);
      }
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    update();
    draw(ctx);
    requestRef.current = requestAnimationFrame(loop);
  }, [draw, update]);

  useEffect(() => {
    audioRef.current = new Audio('https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.22;

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    if (gameState === 'PLAYING' && !isMuted) {
      audioRef.current.play().catch((error) => console.log('Audio play blocked by browser:', error));
    } else {
      audioRef.current.pause();
    }
  }, [gameState, isMuted]);

  useEffect(() => {
    let unsubscribe = () => {};

    const initLeaderboard = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Failed to sign in anonymously for leaderboard:', error);
      }

      const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const scores = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as {name: string, score: number, id: string}[];
        setLeaderboard(scores);
      }, (error) => {
        console.error('Firestore Error:', error);
      });
    };

    initLeaderboard();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isMoveKey = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key);
      const isControlKey = isMoveKey || e.code === 'Space' || e.key === 'Escape';

      if ((gameState === 'PLAYING' || gameState === 'PAUSED') && isControlKey) {
        e.preventDefault();
      }

      if (e.key === 'Escape' || e.code === 'Space') {
        if (gameState === 'PLAYING') setGameState('PAUSED');
        else if (gameState === 'PAUSED') setGameState('PLAYING');
        return;
      }

      if (gameState !== 'PLAYING') return;

      if (/^[0-9]$/.test(e.key)) {
        cheatBufferRef.current = (cheatBufferRef.current + e.key).slice(-2);
        if (cheatBufferRef.current === '16') {
          setScore((s) => s + 10000);
          addFeedback(playerRef.current.x + TILE_SIZE / 2, playerRef.current.y + TILE_SIZE / 2, 'bonus', 60);
          cheatBufferRef.current = '';
        }
      }

      if (key === 'arrowup' || key === 'w') playerRef.current.nextDir = 'UP';
      if (key === 'arrowdown' || key === 's') playerRef.current.nextDir = 'DOWN';
      if (key === 'arrowleft' || key === 'a') playerRef.current.nextDir = 'LEFT';
      if (key === 'arrowright' || key === 'd') playerRef.current.nextDir = 'RIGHT';
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(requestRef.current);
    };
  }, [addFeedback, gameState, loop]);

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setLives(MAX_LIVES);
    setMaze(cloneMaze(INITIAL_MAZE));
    setPowerTimer(0);
    setShowNameInput(false);
    setScoreSaved(false);
    setSaveError(null);
    effectsRef.current = [];
    resetActors(1);
    setGameState('PLAYING');
  };

  const startLevel2 = () => {
    setLevel(2);
    setMaze(cloneMaze(INITIAL_MAZE_2));
    setPowerTimer(0);
    effectsRef.current = [];
    resetActors(2);
    setGameState('PLAYING');
  };

  const returnToMenu = () => {
    setGameState('START');
    setShowNameInput(false);
    setSaveError(null);
    effectsRef.current = [];
  };

  const submitScore = async () => {
    if (isSubmitting || scoreSaved) return;
    setSaveError(null);
    setIsSubmitting(true);
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const trimmedName = playerName.trim().substring(0, 16) || (isGuest ? 'Guest Player' : 'Player');
      await addDoc(collection(db, 'leaderboard'), {
        name: trimmedName,
        score: Math.trunc(scoreRef.current),
        playerId: playerId ?? null,
        isGuest,
        createdAt: serverTimestamp()
      });
      setScoreSaved(true);
    } catch (e) {
      console.error('Error adding score: ', e);
      setSaveError('Unable to save score. Please check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showNameInput || scoreSaved || isSubmitting) return;
    submitScore();
  }, [showNameInput, scoreSaved, isSubmitting]);

  const leaderboardPanel = (
    <section className="molar-madness-panel molar-madness-leaderboard">
      <div className="molar-madness-panel-heading">
        <Crown size={16} aria-hidden="true" />
        <span>Hall of Fame</span>
      </div>
      <div className="molar-madness-score-list">
        {leaderboard.length === 0 ? (
          <div className="molar-madness-empty">Loading scores...</div>
        ) : (
          leaderboard.map((entry, index) => (
            <div key={entry.id} className="molar-madness-score-row">
              <span>{index + 1}</span>
              <strong>{entry.name}</strong>
              <b>{entry.score.toLocaleString()}</b>
            </div>
          ))
        )}
      </div>
    </section>
  );

  const overlayTitle = gameState === 'WIN' ? 'Enamel Saved' : gameState === 'GAMEOVER' ? 'Cavity Attack' : 'Level Clear';

  return (
    <div className={`molar-madness-page ${gameState === 'START' ? 'molar-madness-page--menu' : 'molar-madness-page--play'}`}>
      <div className="molar-madness-backdrop" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {gameState === 'START' ? (
          <motion.main
            key="menu"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="molar-madness-menu"
          >
            <section className="molar-madness-hero">
              <div className="molar-madness-badge">
                <Zap size={15} aria-hidden="true" />
                Arcade dental defense
              </div>
              <h1>Molar Madness</h1>
              <p>
                Guide the brave molar through neon enamel tunnels, polish every pellet, and turn power rinses
                against the candy crew.
              </p>

              <div className="molar-madness-actions">
                <button className="molar-madness-primary" onClick={startGame}>
                  <Play size={18} aria-hidden="true" />
                  <span>Start Game</span>
                </button>
              </div>

              <div className="molar-madness-instructions">
                <div>
                  <span>Move</span>
                  <strong>Arrow keys or WASD</strong>
                </div>
                <div>
                  <span>Pause</span>
                  <strong>Escape or Space</strong>
                </div>
                <div>
                  <span>Goal</span>
                  <strong>Clear two plaque-packed boards</strong>
                </div>
              </div>
            </section>

            <aside className="molar-madness-menu-card">
              <div className="molar-madness-preview">
                <div className="molar-madness-preview-tooth" />
                <span />
                <span />
                <span />
                <div className="molar-madness-preview-candy molar-madness-preview-candy--one" />
                <div className="molar-madness-preview-candy molar-madness-preview-candy--two" />
              </div>
              <div className="molar-madness-menu-stats">
                <div>
                  <span>Best</span>
                  <strong>{highScore.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Lives</span>
                  <strong>{MAX_LIVES}</strong>
                </div>
                <div>
                  <span>Boards</span>
                  <strong>2</strong>
                </div>
              </div>
              {leaderboardPanel}
            </aside>
          </motion.main>
        ) : (
          <motion.main
            key="play"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="molar-madness-play"
          >
            <header className="molar-madness-topbar">
              <div className="molar-madness-brand">
                <span>Defend the Enamel</span>
                <strong>Molar Madness</strong>
              </div>
              <div className="molar-madness-topbar-actions">
                <button
                  className="molar-madness-icon-button"
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={19} aria-hidden="true" /> : <Volume2 size={19} aria-hidden="true" />}
                </button>
                <button
                  className="molar-madness-icon-button"
                  onClick={() => setGameState(gameState === 'PAUSED' ? 'PLAYING' : 'PAUSED')}
                  title={gameState === 'PAUSED' ? 'Resume' : 'Pause'}
                  aria-label={gameState === 'PAUSED' ? 'Resume' : 'Pause'}
                  disabled={gameState !== 'PLAYING' && gameState !== 'PAUSED'}
                >
                  {gameState === 'PAUSED' ? <Play size={19} aria-hidden="true" /> : <Pause size={19} aria-hidden="true" />}
                </button>
              </div>
            </header>

            <section className="molar-madness-hud" aria-label="Game status">
              <div>
                <span>Score</span>
                <strong>{score.toLocaleString()}</strong>
              </div>
              <div>
                <span>High</span>
                <strong>{highScore.toLocaleString()}</strong>
              </div>
              <div>
                <span>Stage</span>
                <strong>{level === 1 ? 'Molars' : 'Gum Line'}</strong>
              </div>
              <div className="molar-madness-lives">
                <span>Life</span>
                <strong>
                  <Heart size={18} fill={lives > 0 ? 'currentColor' : 'none'} aria-hidden="true" />
                </strong>
              </div>
            </section>

            <section className="molar-madness-stage">
              <div className="molar-madness-canvas-shell">
                <canvas
                  ref={canvasRef}
                  width={BOARD_WIDTH}
                  height={BOARD_HEIGHT}
                  className="molar-madness-canvas"
                  aria-label="Molar Madness game board"
                />

                <AnimatePresence>
                  {gameState === 'PAUSED' && (
                    <motion.div
                      className="molar-madness-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="molar-madness-overlay-card">
                        <span>Time Out</span>
                        <h2>Paused</h2>
                        <button className="molar-madness-primary" onClick={() => setGameState('PLAYING')}>
                          <Play size={18} aria-hidden="true" />
                          <span>Resume</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {(gameState === 'TRANSITION' || gameState === 'GAMEOVER' || gameState === 'WIN') && (
                    <motion.div
                      className="molar-madness-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="molar-madness-overlay-card molar-madness-score-modal">
                        <span>{gameState === 'TRANSITION' ? 'Board One Complete' : 'Final Score'}</span>
                        <h2>{overlayTitle}</h2>
                        <p>{score.toLocaleString()} points</p>
                        <div className="molar-madness-overlay-actions">
                          {gameState === 'TRANSITION' ? (
                            <button className="molar-madness-primary" onClick={startLevel2}>
                              <Zap size={18} aria-hidden="true" />
                              <span>Start Level 2</span>
                            </button>
                          ) : (
                            <button className="molar-madness-primary" onClick={startGame}>
                              <RotateCcw size={18} aria-hidden="true" />
                              <span>Play Again</span>
                            </button>
                          )}
                          <button className="molar-madness-secondary" onClick={returnToMenu}>
                            <Home size={17} aria-hidden="true" />
                            <span>Game Menu</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {showNameInput && (
                    <motion.div
                      className="molar-madness-overlay molar-madness-overlay--score"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                    >
                      <div className="molar-madness-overlay-card">
                        <span>Top 10 Score</span>
                        <h2>{scoreSaved ? 'Score Saved' : 'Saving Score'}</h2>
                        <p>{scoreSaved ? `Saved as ${playerName}` : `Registering ${playerName}`}</p>
                        {scoreSaved && (
                          <button className="molar-madness-primary" onClick={() => setShowNameInput(false)}>
                            <span>Continue</span>
                          </button>
                        )}
                        {isSubmitting && <small>Registering score...</small>}
                        {saveError && <small className="molar-madness-error">{saveError}</small>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <aside className="molar-madness-play-aside">
                {leaderboardPanel}
                <section className="molar-madness-panel">
                  <div className="molar-madness-panel-heading">
                    <Zap size={16} aria-hidden="true" />
                    <span>Controls</span>
                  </div>
                  <div className="molar-madness-control-grid">
                    <kbd>WASD</kbd>
                    <kbd>Arrows</kbd>
                    <kbd>Esc</kbd>
                    <kbd>Space</kbd>
                  </div>
                </section>
              </aside>
            </section>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
};
