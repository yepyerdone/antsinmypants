import { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode, BoardSize, BOARD_CONFIG, INITIAL_SPEED, MIN_SPEED, SPEED_INCREMENT, FOOD_POINTS } from '../lib/constants';

export type Position = { x: number; y: number };
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type GameState = 'START' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export const useSnakeGame = (
  mode: GameMode,
  size: BoardSize,
  playSound: (type: 'eat' | 'die' | 'move' | 'start') => void
) => {
  const config = BOARD_CONFIG[size];
  const cols = config.cols;
  const rows = config.rows;

  const getInitialSnake = () => [
    { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    { x: Math.floor(cols / 2), y: Math.floor(rows / 2) + 1 },
    { x: Math.floor(cols / 2), y: Math.floor(rows / 2) + 2 },
  ];

  const generateFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position;
    let isOccupied = true;
    while (isOccupied) {
      newFood = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
      isOccupied = currentSnake.some(
        segment => segment.x === newFood.x && segment.y === newFood.y
      );
    }
    return newFood!;
  }, [cols, rows]);

  const [gameState, setGameState] = useState<GameState>('START');
  const [countdown, setCountdown] = useState(3);
  const [snake, setSnake] = useState<Position[]>(getInitialSnake());
  const [direction, setDirection] = useState<Direction>('UP');
  
  const currentDirectionRef = useRef<Direction>('UP');
  const directionQueueRef = useRef<Direction[]>([]);
  
  const [food, setFood] = useState<Position>({ x: 5, y: 5 }); // Temp food, regen instantly
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('snake_rush_highscore') || '0', 10);
  });

  const speedRef = useRef(INITIAL_SPEED[mode]);
  const lastUpdateRef = useRef(0);
  const requestRef = useRef<number>();

  const initGame = useCallback(() => {
    setSnake(getInitialSnake());
    setDirection('UP');
    currentDirectionRef.current = 'UP';
    directionQueueRef.current = [];
    setScore(0);
    speedRef.current = INITIAL_SPEED[mode];
    setFood(generateFood(getInitialSnake()));
  }, [mode, generateFood, getInitialSnake]);

  const startGame = useCallback(() => {
    initGame();
    setGameState('COUNTDOWN');
    setCountdown(3);
    playSound('start');
  }, [initGame, playSound]);

  const togglePause = useCallback(() => {
    if (gameState === 'PLAYING') setGameState('PAUSED');
    else if (gameState === 'PAUSED') setGameState('COUNTDOWN');
  }, [gameState]);

  const gameOver = useCallback(() => {
    setGameState('GAMEOVER');
    playSound('die');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake_rush_highscore', score.toString());
    }
  }, [score, highScore, playSound]);

  const updateGame = useCallback(() => {
    setSnake(prevSnake => {
      if (directionQueueRef.current.length > 0) {
        const nextDir = directionQueueRef.current.shift()!;
        currentDirectionRef.current = nextDir;
        setDirection(nextDir);
      }

      const currentHead = prevSnake[0];
      const newHead = { ...currentHead };
      const currentDirection = currentDirectionRef.current;

      if (currentDirection === 'UP') newHead.y -= 1;
      else if (currentDirection === 'DOWN') newHead.y += 1;
      else if (currentDirection === 'LEFT') newHead.x -= 1;
      else if (currentDirection === 'RIGHT') newHead.x += 1;

      // Handle Wall Collision / Wrapping
      if (mode === 'chill') {
        if (newHead.x < 0) newHead.x = cols - 1;
        if (newHead.x >= cols) newHead.x = 0;
        if (newHead.y < 0) newHead.y = rows - 1;
        if (newHead.y >= rows) newHead.y = 0;
      } else {
        if (
          newHead.x < 0 || newHead.x >= cols ||
          newHead.y < 0 || newHead.y >= rows
        ) {
          gameOver();
          return prevSnake;
        }
      }

      // Handle Self Collision
      const isSelfCollision = prevSnake.some(
        segment => segment.x === newHead.x && segment.y === newHead.y
      );
      if (isSelfCollision) {
        gameOver();
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Handle Eating Food
      if (newHead.x === food.x && newHead.y === food.y) {
        playSound('eat');
        setScore(prev => prev + FOOD_POINTS);
        setFood(generateFood(newSnake));
        
        // Increase speed
        speedRef.current = Math.max(
          MIN_SPEED[mode],
          speedRef.current - SPEED_INCREMENT[mode]
        );
      } else {
        newSnake.pop(); // Remove tail
      }

      return newSnake;
    });
  }, [cols, rows, food, mode, gameOver, generateFood, playSound]);

  // Main game loop using requestAnimationFrame
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (gameState !== 'PLAYING') return;
      
      const deltaTime = currentTime - lastTime;
      if (deltaTime >= speedRef.current) {
        updateGame();
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    if (gameState === 'PLAYING') {
      animationFrameId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, updateGame]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling when playing
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.key === 'Escape') {
        togglePause();
        return;
      }
      
      if (e.key === 'Enter') {
        if (gameState === 'START' || gameState === 'GAMEOVER') {
          startGame();
        }
        return;
      }

      if (gameState !== 'PLAYING') return;

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': changeDirection('UP'); break;
        case 'ArrowDown': case 's': case 'S': changeDirection('DOWN'); break;
        case 'ArrowLeft': case 'a': case 'A': changeDirection('LEFT'); break;
        case 'ArrowRight': case 'd': case 'D': changeDirection('RIGHT'); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, togglePause, startGame, playSound]);

  // Countdown Logic
  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => {
          setCountdown(c => c - 1);
          if (countdown > 1) playSound('move'); // tick
        }, 800);
        return () => clearTimeout(timer);
      } else {
        setGameState('PLAYING');
      }
    }
  }, [gameState, countdown, playSound]);

  const changeDirection = useCallback((newDir: Direction) => {
    if (gameState !== 'PLAYING') return;
    
    // Prevent more than 3 queued moves to avoid lag
    if (directionQueueRef.current.length >= 3) return;

    const lastDir = directionQueueRef.current.length > 0 
      ? directionQueueRef.current[directionQueueRef.current.length - 1] 
      : currentDirectionRef.current;
    
    // Prevent 180 reverse
    if (
      (newDir === 'UP' && lastDir === 'DOWN') ||
      (newDir === 'DOWN' && lastDir === 'UP') ||
      (newDir === 'LEFT' && lastDir === 'RIGHT') ||
      (newDir === 'RIGHT' && lastDir === 'LEFT')
    ) {
      return;
    }
    
    // only play sound if direction actually changes and is valid
    if (newDir !== lastDir) {
      playSound('move');
      directionQueueRef.current.push(newDir);
    }
  }, [gameState, playSound]);

  return {
    gameState,
    countdown,
    snake,
    food,
    score,
    highScore,
    startGame,
    togglePause,
    boardConfig: config,
    changeDirection,
    setGameState, // allow resetting to START
    currentSpeed: speedRef.current,
    direction: currentDirectionRef.current,
  };
};
