import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Tile, TILE_SIZE, COLORS, COLORS_L2, INITIAL_MAZE, INITIAL_MAZE_2, GRID_WIDTH, GRID_HEIGHT } from '../game/constants';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';

interface Entity {
  x: number;
  y: number;
  dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';
  nextDir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';
  speed: number;
  type?: string;
}

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(parseInt(localStorage.getItem('molar_madness_highscore') || '0'));
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'PAUSED' | 'TRANSITION' | 'GAMEOVER'>('START');
  const [level, setLevel] = useState(1);
  const [maze, setMaze] = useState<number[][]>(JSON.parse(JSON.stringify(INITIAL_MAZE)));
  const [powerTimer, setPowerTimer] = useState(0);
  
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number, id: string}[]>([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState(localStorage.getItem('molar_player_name') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playerRef = useRef<Entity>({ x: 9 * TILE_SIZE, y: 15 * TILE_SIZE, dir: 'NONE', nextDir: 'NONE', speed: 2 });
  const hasStartedRef = useRef(false);
  const cheatBufferRef = useRef('');
  const ghostsRef = useRef<Entity[]>([
    { x: 9 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'LEFT', nextDir: 'NONE', speed: 1.2, type: 'RED', isDead: false },
    { x: 8 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed: 1.2, type: 'PINK', isDead: false },
    { x: 10 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'RIGHT', nextDir: 'NONE', speed: 1.2, type: 'CYAN', isDead: false },
    { x: 9 * TILE_SIZE, y: 6 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed: 1.2, type: 'ORANGE', isDead: false },
  ]);

  const requestRef = useRef<number>(0);

  const isWall = useCallback((nx: number, ny: number) => {
    const gridX = Math.round(nx / TILE_SIZE);
    const gridY = Math.round(ny / TILE_SIZE);
    
    // Tunnel row (9) handles wrapping
    if (gridY === 9 && (gridX < 0 || gridX >= GRID_WIDTH)) return false;
    
    if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) return true;
    return maze[gridY][gridX] === Tile.WALL;
  }, [maze]);

  const getValidDirs = useCallback((x: number, y: number, currentDir: string) => {
    const dirs: ('UP' | 'DOWN' | 'LEFT' | 'RIGHT')[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const valid = dirs.filter(d => {
      let nx = x;
      let ny = y;
      if (d === 'UP') ny -= TILE_SIZE;
      if (d === 'DOWN') ny += TILE_SIZE;
      if (d === 'LEFT') nx -= TILE_SIZE;
      if (d === 'RIGHT') nx += TILE_SIZE;
      return !isWall(nx, ny);
    });
    const opposite: Record<string, string> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    const filtered = valid.filter(d => d !== opposite[currentDir]);
    return filtered.length > 0 ? filtered : valid;
  }, [isWall]);

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    // --- Player Update ---
    const player = playerRef.current;
    if (player.dir !== 'NONE') hasStartedRef.current = true;
    const pGridX = Math.round(player.x / TILE_SIZE);
    const pGridY = Math.round(player.y / TILE_SIZE);
    const pCenterX = pGridX * TILE_SIZE;
    const pCenterY = pGridY * TILE_SIZE;

    // Junction detection for player
    if (Math.abs(player.x - pCenterX) < player.speed * 0.6 && Math.abs(player.y - pCenterY) < player.speed * 0.6) {
      if (player.nextDir !== 'NONE') {
        let nx = pCenterX, ny = pCenterY;
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

      // Wall check for current direction
      let wx = pCenterX, wy = pCenterY;
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

    // Wrap around
    if (player.x <= -TILE_SIZE) player.x = (GRID_WIDTH - 1) * TILE_SIZE + TILE_SIZE - 2;
    if (player.x >= GRID_WIDTH * TILE_SIZE) player.x = -TILE_SIZE + 2;

    // Pellets & Powerups
    const curX = Math.round(player.x / TILE_SIZE);
    const curY = Math.round(player.y / TILE_SIZE);
    if (maze[curY] && (maze[curY][curX] === Tile.PELLET || maze[curY][curX] === Tile.POWER_PELLET)) {
      const tileType = maze[curY][curX];
      const newMaze = [...maze];
      newMaze[curY] = [...newMaze[curY]];
      newMaze[curY][curX] = Tile.EMPTY;
      setMaze(newMaze);
      
      if (tileType === Tile.PELLET) {
        setScore(s => s + 10);
      } else {
        setScore(s => s + 50);
        setPowerTimer(600); // 10 seconds at 60fps
      }

      if (!newMaze.some(row => row.some(tile => tile === Tile.PELLET || tile === Tile.POWER_PELLET))) {
        setGameState('TRANSITION');
      }
    }

    // --- Ghosts ---
    if (hasStartedRef.current) {
      if (powerTimer > 0) setPowerTimer(prev => prev - 1);
      
      ghostsRef.current.forEach(ghost => {
        const gGridX = Math.round(ghost.x / TILE_SIZE);
        const gGridY = Math.round(ghost.y / TILE_SIZE);
        const gCenterX = gGridX * TILE_SIZE;
        const gCenterY = gGridY * TILE_SIZE;

        const effectiveSpeed = ghost.isDead ? ghost.speed * 2 : (powerTimer > 0 ? ghost.speed * 0.6 : ghost.speed);

        // Junction decision - snap if close to center
        if (Math.abs(ghost.x - gCenterX) < effectiveSpeed * 0.6 && Math.abs(ghost.y - gCenterY) < effectiveSpeed * 0.6) {
          ghost.x = gCenterX;
          ghost.y = gCenterY;

          // If dead and back at base
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
            
            validDirs.forEach(d => {
              let nx = ghost.x, ny = ghost.y;
              if (d === 'UP') ny -= TILE_SIZE;
              else if (d === 'DOWN') ny += TILE_SIZE;
              else if (d === 'LEFT') nx -= TILE_SIZE;
              else if (d === 'RIGHT') nx += TILE_SIZE;
              
              const dist = Math.sqrt((nx - targetX)**2 + (ny - targetY)**2);
              
              if (ghost.isDead || powerTimer === 0) {
                // Chasing or returning home: find minimum distance
                if (dist < compareDist) { compareDist = dist; bestDir = d; }
              } else {
                // Scared: find maximum distance
                if (dist > compareDist) { compareDist = dist; bestDir = d; }
              }
            });
            ghost.dir = bestDir;
          }
        }

        if (ghost.dir === 'UP') ghost.y -= effectiveSpeed;
        else if (ghost.dir === 'DOWN') ghost.y += effectiveSpeed;
        else if (ghost.dir === 'LEFT') ghost.x -= effectiveSpeed;
        else if (ghost.dir === 'RIGHT') ghost.x += effectiveSpeed;

        // Ghost Wrap
        if (ghost.x <= -TILE_SIZE) ghost.x = (GRID_WIDTH - 1) * TILE_SIZE + TILE_SIZE - 2;
        if (ghost.x >= GRID_WIDTH * TILE_SIZE) ghost.x = -TILE_SIZE + 2;

        // Collision Detection
        if (Math.abs(player.x - ghost.x) < TILE_SIZE * 0.7 && Math.abs(player.y - ghost.y) < TILE_SIZE * 0.7) {
          if (powerTimer > 0 && !ghost.isDead) {
            // Kill ghost
            ghost.isDead = true;
            setScore(s => s + 200);
          } else if (!ghost.isDead) {
            setGameState('GAMEOVER');
            setHighScore(prev => {
              const newHigh = Math.max(prev, score);
              localStorage.setItem('molar_madness_highscore', newHigh.toString());
              return newHigh;
            });
            if (score > (leaderboard.length < 10 ? 0 : leaderboard[leaderboard.length - 1].score)) setShowNameInput(true);
          }
        }
      });
    }
  }, [gameState, maze, isWall, getValidDirs, leaderboard, score, powerTimer]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const currentColors = level === 2 ? COLORS_L2 : COLORS;
    ctx.fillStyle = currentColors.BG;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw Maze
    maze.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile === Tile.WALL) {
          ctx.fillStyle = currentColors.WALL;
          ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (tile === Tile.PELLET) {
          ctx.fillStyle = currentColors.PELLET;
          ctx.beginPath();
          ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === Tile.POWER_PELLET) {
          ctx.fillStyle = '#00ffff';
          ctx.beginPath();
          ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 6, 0, Math.PI * 2);
          ctx.fill();
          // Glow effect
          if (Math.sin(Date.now() / 150) > 0) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });
    });

    // Draw Player (Tooth)
    const p = playerRef.current;
    ctx.fillStyle = powerTimer > 0 ? '#00ffff' : currentColors.PLAYER;
    if (powerTimer > 0 && powerTimer < 120 && Math.floor(powerTimer / 10) % 2 === 0) {
      ctx.fillStyle = currentColors.PLAYER; // Flashing at end
    }
    // Tooth shape: body
    ctx.fillRect(p.x + 4, p.y + 4, TILE_SIZE - 8, TILE_SIZE - 10);
    // Roots
    ctx.fillRect(p.x + 6, p.y + TILE_SIZE - 8, 4, 4);
    ctx.fillRect(p.x + TILE_SIZE - 10, p.y + TILE_SIZE - 8, 4, 4);
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x + 7, p.y + 8, 2, 2);
    ctx.fillRect(p.x + TILE_SIZE - 9, p.y + 8, 2, 2);

    // Draw Ghosts (Candy)
    ghostsRef.current.forEach(g => {
        if (g.isDead) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        } else if (powerTimer > 0) {
          ctx.fillStyle = (powerTimer < 120 && Math.floor(powerTimer / 10) % 2 === 0) ? '#FFFFFF' : '#0000FF';
        } else {
          if (g.type === 'RED') ctx.fillStyle = currentColors.GHOST_RED;
          if (g.type === 'PINK') ctx.fillStyle = currentColors.GHOST_PINK;
          if (g.type === 'CYAN') ctx.fillStyle = currentColors.GHOST_CYAN;
          if (g.type === 'ORANGE') ctx.fillStyle = currentColors.GHOST_ORANGE;
        }
        
        // Draw Candy Sprite (Simple 8-bit circle with wrap)
        ctx.beginPath();
        ctx.arc(g.x + TILE_SIZE/2, g.y + TILE_SIZE/2, TILE_SIZE/2 - 4, 0, Math.PI * 2);
        ctx.fill();
        
        if (!g.isDead) {
          // Stick or wrapper bit
          ctx.fillStyle = '#EEE';
          if (g.type === 'RED') {
               ctx.fillRect(g.x + TILE_SIZE/2 - 1, g.y + TILE_SIZE/2, 2, 10); // Lollipop
          } else {
               ctx.fillRect(g.x + 2, g.y + TILE_SIZE/2 - 2, 4, 4); // Wrapper
               ctx.fillRect(g.x + TILE_SIZE - 6, g.y + TILE_SIZE/2 - 2, 4, 4);
          }
        }

        // Ghost/Candy Eyes
        ctx.fillStyle = '#FFF';
        ctx.fillRect(g.x + TILE_SIZE/2 - 5, g.y + TILE_SIZE/2 - 4, 4, 4);
        ctx.fillRect(g.x + TILE_SIZE/2 + 1, g.y + TILE_SIZE/2 - 4, 4, 4);
        ctx.fillStyle = '#000';
        ctx.fillRect(g.x + TILE_SIZE/2 - 3, g.y + TILE_SIZE/2 - 2, 2, 2);
        ctx.fillRect(g.x + TILE_SIZE/2 + 3, g.y + TILE_SIZE/2 - 2, 2, 2);
    });

    // Score Overlay
    ctx.fillStyle = COLORS.TEXT;
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(`SCORE: ${score}`, 10, 20);
    ctx.fillText(`HI: ${highScore}`, ctx.canvas.width - 100, 20);

  }, [maze, score]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    update();
    draw(ctx);
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    // Background Music Setup
    audioRef.current = new Audio('https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3'); // Retro/8-bit loop
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (gameState === 'PLAYING' && !isMuted) {
        audioRef.current.play().catch(e => console.log("Audio play blocked by browser:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [gameState, isMuted]);

  useEffect(() => {
    const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as {name: string, score: number, id: string}[];
      setLeaderboard(scores);
    }, (error) => {
      console.error("Firestore Error:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Pause with Space
      if (e.code === 'Space') {
        if (gameState === 'PLAYING') setGameState('PAUSED');
        else if (gameState === 'PAUSED') setGameState('PLAYING');
        return;
      }

      if (gameState !== 'PLAYING') return;

      // Secret Cheat Code: "16"
      if (/^[0-9]$/.test(e.key)) {
        cheatBufferRef.current = (cheatBufferRef.current + e.key).slice(-2);
        if (cheatBufferRef.current === '16') {
          setScore(s => s + 10000);
          cheatBufferRef.current = ''; // Reset after activation
        }
      }

      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') playerRef.current.nextDir = 'UP';
      if (key === 'arrowdown' || key === 's') playerRef.current.nextDir = 'DOWN';
      if (key === 'arrowleft' || key === 'a') playerRef.current.nextDir = 'LEFT';
      if (key === 'arrowright' || key === 'd') playerRef.current.nextDir = 'RIGHT';
    };

    window.addEventListener('keydown', handleKeyDown);
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, loop]);

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setMaze(JSON.parse(JSON.stringify(INITIAL_MAZE)));
    hasStartedRef.current = false;
    setPowerTimer(0);
    playerRef.current = { x: 9 * TILE_SIZE, y: 15 * TILE_SIZE, dir: 'NONE', nextDir: 'NONE', speed: 2 };
    ghostsRef.current = [
        { x: 9 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'LEFT', nextDir: 'NONE', speed: 1.2, type: 'RED', isDead: false },
        { x: 8 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed: 1.2, type: 'PINK', isDead: false },
        { x: 10 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'RIGHT', nextDir: 'NONE', speed: 1.2, type: 'CYAN', isDead: false },
        { x: 9 * TILE_SIZE, y: 6 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed: 1.2, type: 'ORANGE', isDead: false },
    ];
    setGameState('PLAYING');
    setShowNameInput(false);
  };

  const startLevel2 = () => {
    setLevel(2);
    setMaze(JSON.parse(JSON.stringify(INITIAL_MAZE_2)));
    hasStartedRef.current = false;
    setPowerTimer(0);
    playerRef.current = { x: 9 * TILE_SIZE, y: 15 * TILE_SIZE, dir: 'NONE', nextDir: 'NONE', speed: 2.2 };
    ghostsRef.current = [
        { x: 9 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'LEFT', nextDir: 'NONE', speed: 1.4, type: 'RED', isDead: false },
        { x: 8 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed: 1.4, type: 'PINK', isDead: false },
        { x: 10 * TILE_SIZE, y: 7 * TILE_SIZE, dir: 'RIGHT', nextDir: 'NONE', speed: 1.4, type: 'CYAN', isDead: false },
        { x: 9 * TILE_SIZE, y: 6 * TILE_SIZE, dir: 'UP', nextDir: 'NONE', speed: 1.4, type: 'ORANGE', isDead: false },
    ];
    setGameState('PLAYING');
  };

  const submitScore = async () => {
    if (!playerName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      localStorage.setItem('molar_player_name', playerName.trim());
      await addDoc(collection(db, 'leaderboard'), {
        name: playerName.trim().substring(0, 15),
        score: score,
        createdAt: serverTimestamp()
      });
      setShowNameInput(false);
    } catch (e) {
      console.error("Error adding score: ", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-[#1a0a2e] text-[#ff00ff] font-['Press_Start_2P'] overflow-hidden border-x-[12px] border-y-[12px] border-[#2e1055] select-none">
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-50" />
      
      {/* CRT Vignette */}
      <div className="absolute inset-0 pointer-events-none z-40 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />

      {/* Retro Arcade Header */}
      <div className="w-full max-w-5xl flex justify-between items-center px-12 pt-8 pb-4 z-10">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-[#00ffff] opacity-70">Player 1</p>
          <p className="text-2xl font-bold tracking-tighter text-[#fff]">{score.toString().padStart(6, '0')}</p>
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-black italic tracking-tighter text-[#fff] arcade-text-shadow">MOLAR MADNESS</h1>
          <p className="text-[8px] uppercase tracking-[0.4em] text-[#00ffff] mt-1 shrink-0">Defend the Enamel</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="space-y-1 text-right">
            <p className="text-[10px] uppercase tracking-widest text-[#00ffff] opacity-70">High Score</p>
            <p className="text-2xl font-bold tracking-tighter text-[#fff]">{highScore.toString().padStart(6, '0')}</p>
          </div>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#00ffff]"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row justify-center items-center px-12 gap-12 z-10 w-full max-w-6xl mt-4">
        {/* Main Game Container */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative p-4 bg-[#0a0414] border-4 border-[#00ffff] neon-shadow-cyan"
        >
          <canvas
            ref={canvasRef}
            width={GRID_WIDTH * TILE_SIZE}
            height={GRID_HEIGHT * TILE_SIZE}
            className="bg-[#0a0414]"
          />
          
          <AnimatePresence>
            {gameState === 'PAUSED' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 text-white p-8 text-center"
              >
                <h2 className="text-4xl mb-8 text-[#00ffff] arcade-text-shadow italic">PAUSED</h2>
                <button
                  onClick={() => setGameState('PLAYING')}
                  className="px-8 py-4 bg-[#ff00ff] text-white hover:bg-white hover:text-black transition-colors border-4 border-[#00ffff] cursor-pointer text-sm font-bold"
                >
                  RESUME
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {gameState !== 'PLAYING' && gameState !== 'PAUSED' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 text-white p-8 text-center"
              >
                {gameState === 'TRANSITION' ? (
                  <>
                    <h2 className="text-3xl mb-6 text-[#ffff00] arcade-text-shadow uppercase">
                      LEVEL 1 CLEAR!
                    </h2>
                    <div className="flex gap-8 mb-8 items-end">
                      {/* Decorative Tooth */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-14 bg-white rounded-t-lg relative">
                             <div className="absolute top-2 left-2 w-2 h-2 bg-black" />
                             <div className="absolute top-2 right-2 w-2 h-2 bg-black" />
                             <div className="absolute bottom-0 left-1 w-3 h-3 bg-white" />
                             <div className="absolute bottom-0 right-1 w-3 h-3 bg-white" />
                        </div>
                        <p className="text-[10px] text-white">BRAVE MOLAR</p>
                      </div>
                      <p className="text-2xl text-[#ff00ff]">VS</p>
                      {/* Decorative Candy */}
                      <div className="flex flex-col items-center gap-2">
                         <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                             <div className="w-2 h-2 bg-white rounded-full mx-1 translate-y--1" />
                             <div className="w-2 h-2 bg-white rounded-full mx-1 translate-y--1" />
                         </div>
                         <p className="text-[10px] text-white">SUGAR KING</p>
                      </div>
                    </div>
                    <button
                      onClick={startLevel2}
                      className="px-8 py-4 bg-[#33ff33] text-[#1a0a2e] hover:bg-white transition-colors border-4 border-[#1a0a2e] cursor-pointer text-xs font-bold"
                    >
                      START LEVEL 2
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl mb-6 text-blue-400 arcade-text-shadow">
                      {gameState === 'START' ? 'INSERT COIN' : 'CAVITY ATTACK!'}
                    </h2>
                    
                    {gameState === 'GAMEOVER' && (
                      <p className="text-lg mb-4 text-red-500 animate-pulse">GAME OVER</p>
                    )}
                    
                    <p className="text-sm mb-8 text-gray-400">
                       {gameState === 'GAMEOVER' ? `BLOOD SUGAR: ${score}` : 'DODGE THE CANDY!'}
                    </p>

                    <button
                      onClick={startGame}
                      className="px-6 py-3 bg-[#00ffff] text-[#1a0a2e] hover:bg-white transition-colors border-4 border-[#ff00ff] cursor-pointer text-xs font-bold"
                      id="start-button"
                    >
                      {gameState === 'START' ? 'PUSH START BUTTON' : 'RETRY MISSION'}
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showNameInput && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white p-8 text-center"
              >
                <h2 className="text-2xl mb-4 text-[#ff00ff] arcade-text-shadow">TOP 10 SCORE!</h2>
                <p className="text-sm mb-6 text-[#00ffff]">ENTER YOUR INITIALS</p>
                
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                  maxLength={15}
                  placeholder="PLAYER"
                  className="bg-[#0a0414] border-4 border-[#00ffff] p-4 text-center text-xl mb-6 outline-none focus:border-[#ff00ff] transition-colors w-64 uppercase"
                />

                <button
                  onClick={submitScore}
                  disabled={isSubmitting || !playerName.trim()}
                  className="px-8 py-4 bg-[#ff00ff] text-white hover:bg-white hover:text-black transition-colors border-4 border-[#00ffff] cursor-pointer text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'SAVING...' : 'REGISTER SCORE'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sidebar / Stats */}
        <div className="flex-1 flex flex-col gap-6 w-full max-w-sm">
          <div className="bg-[#2e1055] p-6 border-2 border-[#ff00ff] rounded-lg neon-shadow-pink min-h-[300px]">
            <h3 className="text-[#00ffff] text-[10px] uppercase mb-4 tracking-widest text-center border-b-2 border-[#ff00ff] pb-2">HALL OF FAME</h3>
            <div className="flex flex-col gap-3 font-mono">
              {leaderboard.length === 0 ? (
                <div className="text-[10px] text-center text-white/50 animate-pulse mt-8">LOADING SCORES...</div>
              ) : (
                leaderboard.map((entry, index) => (
                  <div key={entry.id} className="flex justify-between items-center text-[10px] uppercase">
                    <div className="flex gap-2">
                      <span className="text-[#ff00ff] w-4">{index + 1}.</span>
                      <span className="text-white truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="text-[#00ffff] font-bold">{entry.score.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#2e1055] p-6 border-2 border-[#00ffff] rounded-lg">
            <h3 className="text-[#ff00ff] text-[10px] uppercase mb-3 tracking-widest">Controls</h3>
            <p className="text-[9px] leading-relaxed text-white/80 uppercase">
              Use ARROWS or WASD to navigate. PRESS SPACE TO PAUSE.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-[#00ffff] text-[#1a0a2e] text-[8px] font-bold uppercase">LVL {level.toString().padStart(2, '0')}</span>
              <span className="px-2 py-1 bg-[#ff00ff] text-white text-[8px] font-bold uppercase">STG: {level === 1 ? 'MOLARS' : 'GUM LINE'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Decorative Bar */}
      <div className="absolute bottom-0 w-full h-12 bg-[#2e1055] border-t-4 border-[#ff00ff] flex items-center justify-center z-10">
        <p className="text-[10px] uppercase tracking-[0.6em] text-white animate-pulse">
          {gameState === 'PLAYING' ? 'BATTLE IN PROGRESS' : 'Insert Coin To Continue'}
        </p>
      </div>
      
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};
