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

    const glow = powerTimer > 0 ? '#7dd3fc' : '#ffffff';
    ctx.shadowColor = glow;
    ctx.shadowBlur = powerTimer > 0 ? 16 : 8;
    const toothGradient = ctx.createLinearGradient(-8, -10, 8, 11);
    toothGradient.addColorStop(0, '#ffffff');
    toothGradient.addColorStop(0.58, powerTimer > 0 ? '#dff7ff' : '#eef7f6');
    toothGradient.addColorStop(1, '#b9d9dc');
    ctx.fillStyle = toothGradient;

    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.quadraticCurveTo(-12, -2, -9, 7);
    ctx.quadraticCurveTo(-7, 13, -3, 8);
    ctx.quadraticCurveTo(0, 4, 3, 8);
    ctx.quadraticCurveTo(7, 13, 9, 7);
    ctx.quadraticCurveTo(12, -2, 8, -8);
    ctx.quadraticCurveTo(2, -13, -8, -8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#11313c';
    ctx.beginPath();
    ctx.arc(-3.5, -4, 1.55, 0, Math.PI * 2);
    ctx.arc(4.2, -4, 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f8da0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 1.5, 4.5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  };

  const drawWrappedCandy = (
    ctx: CanvasRenderingContext2D,
    baseColor: string,
    stripeColor: string,
    wrapperColor: string
  ) => {
    ctx.fillStyle = wrapperColor;
    ctx.beginPath();
    ctx.moveTo(-11, -5);
    ctx.lineTo(-18, -10);
    ctx.lineTo(-17, -1);
    ctx.lineTo(-18, 8);
    ctx.lineTo(-11, 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -5);
    ctx.lineTo(18, -10);
    ctx.lineTo(17, -1);
    ctx.lineTo(18, 8);
    ctx.lineTo(11, 5);
    ctx.closePath();
    ctx.fill();

    const candyGradient = ctx.createRadialGradient(-4, -5, 2, 0, 0, 11);
    candyGradient.addColorStop(0, '#ffffff');
    candyGradient.addColorStop(0.18, stripeColor);
    candyGradient.addColorStop(0.42, baseColor);
    candyGradient.addColorStop(1, '#4c0519');
    ctx.fillStyle = candyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0.25, Math.PI * 1.18);
    ctx.stroke();
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
    const candyStyles: Record<string, { base: string; stripe: string; wrapper: string }> = {
      RED: { base: '#ef4444', stripe: '#fef2f2', wrapper: '#fecaca' },
      PINK: { base: '#f472b6', stripe: '#fff1f2', wrapper: '#fbcfe8' },
      CYAN: { base: '#22c55e', stripe: '#dcfce7', wrapper: '#bbf7d0' },
      ORANGE: { base: '#f59e0b', stripe: '#fffbeb', wrapper: '#fde68a' }
    };
    const style = candyStyles[ghost.type || 'RED'] || candyStyles.RED;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowBlur = 0;

    if (ghost.isDead) {
      ctx.globalAlpha = 0.58;
      drawHardCandy(ctx, '#cbd5e1', '#ffffff');
    } else if (scared) {
      drawHardCandy(ctx, '#60a5fa', '#dbeafe');
    } else {
      if (ghost.type === 'RED') drawLollipop(ctx, style.base, style.stripe);
      else if (ghost.type === 'PINK') drawWrappedCandy(ctx, style.base, style.stripe, style.wrapper);
      else if (ghost.type === 'CYAN') drawGummyDrop(ctx, style.base);
      else drawHardCandy(ctx, style.base, style.stripe);
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-4, -2, 2, 0, Math.PI * 2);
    ctx.arc(4, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(-3.4, -1.6, 0.9, 0, Math.PI * 2);
    ctx.arc(4.6, -1.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const currentColors = level === 2 ? COLORS_L2 : COLORS;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const bg = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    bg.addColorStop(0, currentColors.BG);
    bg.addColorStop(1, level === 2 ? '#052e16' : '#111827');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = level === 2 ? '#bbf7d0' : '#bae6fd';
    ctx.lineWidth = 1;
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
    ctx.restore();

    maze.forEach((row, y) => {
      row.forEach((tile, x) => {
        const tileX = x * TILE_SIZE;
        const tileY = y * TILE_SIZE;

        if (tile === Tile.WALL) {
          ctx.save();
          ctx.shadowBlur = 11;
          ctx.shadowColor = currentColors.WALL;
          const wallGradient = ctx.createLinearGradient(tileX, tileY, tileX + TILE_SIZE, tileY + TILE_SIZE);
          wallGradient.addColorStop(0, currentColors.WALL);
          wallGradient.addColorStop(1, level === 2 ? '#15803d' : '#2563eb');
          ctx.fillStyle = wallGradient;
          roundedRect(ctx, tileX + 3, tileY + 3, TILE_SIZE - 6, TILE_SIZE - 6, 6);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.34)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        } else if (tile === Tile.PELLET) {
          ctx.save();
          const pelletGradient = ctx.createRadialGradient(
            tileX + TILE_SIZE / 2 - 1.5,
            tileY + TILE_SIZE / 2 - 1.5,
            0.8,
            tileX + TILE_SIZE / 2,
            tileY + TILE_SIZE / 2,
            4
          );
          pelletGradient.addColorStop(0, '#fff7ed');
          pelletGradient.addColorStop(0.42, currentColors.PELLET);
          pelletGradient.addColorStop(1, level === 2 ? '#a16207' : '#831843');
          ctx.fillStyle = pelletGradient;
          ctx.beginPath();
          ctx.arc(tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2, 3.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        } else if (tile === Tile.POWER_PELLET) {
          ctx.save();
          ctx.fillStyle = level === 2 ? '#fde68a' : '#bfdbfe';
          ctx.beginPath();
          ctx.moveTo(tileX + 5, tileY + 8);
          ctx.lineTo(tileX + 1, tileY + 4);
          ctx.lineTo(tileX + 2, tileY + 12);
          ctx.lineTo(tileX + 1, tileY + 19);
          ctx.lineTo(tileX + 5, tileY + 16);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(tileX + TILE_SIZE - 5, tileY + 8);
          ctx.lineTo(tileX + TILE_SIZE - 1, tileY + 4);
          ctx.lineTo(tileX + TILE_SIZE - 2, tileY + 12);
          ctx.lineTo(tileX + TILE_SIZE - 1, tileY + 19);
          ctx.lineTo(tileX + TILE_SIZE - 5, tileY + 16);
          ctx.closePath();
          ctx.fill();
          const powerGradient = ctx.createRadialGradient(
            tileX + TILE_SIZE / 2 - 3,
            tileY + TILE_SIZE / 2 - 4,
            2,
            tileX + TILE_SIZE / 2,
            tileY + TILE_SIZE / 2,
            8
          );
          powerGradient.addColorStop(0, '#ffffff');
          powerGradient.addColorStop(0.28, '#a7f3d0');
          powerGradient.addColorStop(1, '#0f766e');
          ctx.fillStyle = powerGradient;
          ctx.beginPath();
          ctx.arc(tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2, TILE_SIZE / 2 - 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }
      });
    });

    effectsRef.current = effectsRef.current
      .map((effect) => ({ ...effect, age: effect.age + 1 }))
      .filter((effect) => effect.age < effect.maxAge);

    effectsRef.current.forEach((effect) => {
      const progress = effect.age / effect.maxAge;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = effect.kind === 'caught' ? '#fb7185' : effect.kind === 'bonus' ? '#facc15' : '#7dd3fc';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 4 + progress * 22, 0, Math.PI * 2);
      ctx.stroke();
      if (effect.kind === 'bonus') {
        ctx.font = '700 11px Inter, sans-serif';
        ctx.fillText('+200', effect.x - 13, effect.y - progress * 18);
      }
      ctx.restore();
    });

    drawTooth(ctx, playerRef.current);
    ghostsRef.current.forEach((ghost) => drawCandy(ctx, ghost));

    if (hitCooldownRef.current > 0 && Math.floor(hitCooldownRef.current / 6) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(248, 113, 113, 0.08)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
