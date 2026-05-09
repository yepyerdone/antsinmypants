/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BOARD_WIDTH, 
  BOARD_HEIGHT, 
  TETROMINOES, 
  TetrominoType, 
  INITIAL_FALL_SPEED, 
  SPEED_INCREMENT, 
  SCORING,
  WALL_KICK_DATA
} from '../constants';
import { Piece, Board, GameState } from '../types';
import { audio } from '../utils/audio';
import { saveHighScore, getUserHighScore } from '../services/leaderboardService';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const createEmptyBoard = (): Board => 
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

const getRandomTetromino = (): TetrominoType => {
  const types: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  return types[Math.floor(Math.random() * types.length)];
};

export const useGameLogic = () => {
  const [state, setState] = useState<GameState>({
    board: createEmptyBoard(),
    currentPiece: null,
    nextPiece: getRandomTetromino(),
    holdPiece: null,
    canHold: true,
    score: 0,
    level: 1,
    lines: 0,
    gameOver: false,
    paused: false,
    highScore: parseInt(localStorage.getItem('tetron-highscore') || '0'),
    combo: 0,
  });

  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const stateRef = useRef<GameState>(state);

  // Keep ref in sync for use in callbacks without stale closures
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Sync high score with Firebase on login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const firebaseHighScore = await getUserHighScore(user.uid);
        const localHighScore = parseInt(localStorage.getItem('tetron-highscore') || '0');
        const finalHighScore = Math.max(firebaseHighScore, localHighScore);
        
        if (finalHighScore > localHighScore) {
          localStorage.setItem('tetron-highscore', finalHighScore.toString());
        }
        
        setState(s => ({ ...s, highScore: finalHighScore }));
        
        if (localHighScore > firebaseHighScore) {
          saveHighScore(localHighScore);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const checkCollision = (piece: Piece, board: Board, moveX = 0, moveY = 0, shapeOverride?: number[][]): boolean => {
    const shape = shapeOverride || piece.shape;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = piece.pos.x + x + moveX;
          const newY = piece.pos.y + y + moveY;

          if (
            newX < 0 || 
            newX >= BOARD_WIDTH || 
            newY >= BOARD_HEIGHT ||
            (newY >= 0 && board[newY][newX])
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const spawnPiece = useCallback((type: TetrominoType, boardOverride?: Board, initialY: number = 0, isSwap: boolean = false) => {
    const tetromino = TETROMINOES[type];
    const board = boardOverride || stateRef.current.board;
    
    const piece: Piece = {
      type,
      pos: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(tetromino.shape[0].length / 2), y: initialY },
      rotation: 0,
      shape: tetromino.shape,
    };

    // Nudge up if colliding at the requested Y
    let finalY = initialY;
    const testPiece = { ...piece };
    while (finalY > 0 && checkCollision(testPiece, board)) {
      finalY--;
      testPiece.pos.y = finalY;
    }
    piece.pos.y = finalY;

    if (checkCollision(piece, board)) {
      setState(s => ({ ...s, board, gameOver: true, currentPiece: null }));
      audio.playGameOver();
      return;
    }

    setState(s => ({
      ...s,
      board: board,
      currentPiece: piece,
      nextPiece: isSwap ? s.nextPiece : getRandomTetromino(),
      canHold: !isSwap,
    }));
  }, []);

  const rotatePiece = (direction: number) => {
    const { currentPiece, board, paused, gameOver } = stateRef.current;
    if (!currentPiece || paused || gameOver) return;

    const newRotation = (currentPiece.rotation + direction + 4) % 4;
    const shape = currentPiece.shape;
    
    const rotatedShape = direction === 1 
      ? shape[0].map((_, i) => shape.map(row => row[i]).reverse())
      : shape[0].map((_, i) => shape.map(row => row[row.length - 1 - i]));

    const kickType = currentPiece.type === 'I' ? 'I' : 'standard';
    const kickKey = `${currentPiece.rotation}->${newRotation}`;
    const kicks: number[][] = WALL_KICK_DATA[kickType].find((_, i) => {
        const keys = ['0->1', '1->0', '1->2', '2->1', '2->3', '3->2', '3->0', '0->3'];
        return keys[i] === kickKey;
    }) || [[0, 0]];

    for (const [kx, ky] of kicks) {
      if (!checkCollision(currentPiece, board, kx, -ky, rotatedShape)) {
        setState(s => ({
          ...s,
          currentPiece: s.currentPiece ? {
            ...s.currentPiece,
            pos: { x: s.currentPiece.pos.x + kx, y: s.currentPiece.pos.y - ky },
            rotation: newRotation,
            shape: rotatedShape
          } : null
        }));
        audio.playRotate();
        return;
      }
    }
  };

  const movePiece = (dir: number) => {
    const { currentPiece, board, paused, gameOver } = stateRef.current;
    if (!currentPiece || paused || gameOver) return;

    if (!checkCollision(currentPiece, board, dir, 0)) {
      setState(s => ({
        ...s,
        currentPiece: s.currentPiece ? { ...s.currentPiece, pos: { ...s.currentPiece.pos, x: s.currentPiece.pos.x + dir } } : null
      }));
      audio.playMove();
    }
  };

  const lockPiece = useCallback(() => {
    const { currentPiece, board, nextPiece, score, level, lines, highScore } = stateRef.current;
    if (!currentPiece) return;

    // 1. Solidify piece on board
    const newBoard = board.map(row => [...row]);
    currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const boardY = currentPiece.pos.y + y;
          const boardX = currentPiece.pos.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT) {
            newBoard[boardY][boardX] = currentPiece.type;
          }
        }
      });
    });

    // 2. Clear lines
    let linesCleared = 0;
    const boardWithClearedLines = newBoard.reduce((acc, row) => {
      if (row.every(cell => cell !== null)) {
        linesCleared++;
        acc.unshift(Array(BOARD_WIDTH).fill(null));
      } else {
        acc.push(row);
      }
      return acc;
    }, [] as Board);

    // 3. Scoring calculation
    let points = 0;
    if (linesCleared === 1) points = SCORING.SINGLE;
    else if (linesCleared === 2) points = SCORING.DOUBLE;
    else if (linesCleared === 3) points = SCORING.TRIPLE;
    else if (linesCleared === 4) points = SCORING.TETRIS;
    if (linesCleared > 0) audio.playLineClear(linesCleared);

    const newLines = lines + linesCleared;
    const newLevel = Math.floor(newLines / 10) + 1;
    const newScore = score + (points * level);
    const updatedHighScore = Math.max(newScore, highScore);
    
    if (updatedHighScore > highScore) {
      localStorage.setItem('tetron-highscore', updatedHighScore.toString());
      // Only attempt to save to Firebase if authenticated
      if (auth.currentUser) {
        saveHighScore(updatedHighScore);
      }
    }

    // 4. Prepare New Piece (Atomic Spawn)
    const nextType = nextPiece;
    const nextTetromino = TETROMINOES[nextType];
    const spawnedPiece: Piece = {
      type: nextType,
      pos: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(nextTetromino.shape[0].length / 2), y: 0 },
      rotation: 0,
      shape: nextTetromino.shape,
    };

    // 5. Game Over Check
    if (checkCollision(spawnedPiece, boardWithClearedLines)) {
      setState(s => ({
        ...s,
        board: boardWithClearedLines,
        score: newScore,
        lines: newLines,
        level: newLevel,
        highScore: updatedHighScore,
        gameOver: true,
        currentPiece: null 
      }));
      audio.playGameOver();
      return;
    }

    // 6. Update state atomically
    setState(s => ({
      ...s,
      board: boardWithClearedLines,
      score: newScore,
      lines: newLines,
      level: newLevel,
      highScore: updatedHighScore,
      currentPiece: spawnedPiece,
      nextPiece: getRandomTetromino(),
      canHold: true,
    }));
  }, []);

  const dropPiece = useCallback(() => {
    const { currentPiece, board, gameOver, paused } = stateRef.current;
    if (!currentPiece || gameOver || paused) return;

    if (!checkCollision(currentPiece, board, 0, 1)) {
      setState(s => ({
        ...s,
        currentPiece: s.currentPiece ? { ...s.currentPiece, pos: { ...s.currentPiece.pos, y: s.currentPiece.pos.y + 1 } } : null
      }));
    } else {
      lockPiece();
    }
  }, [lockPiece]);


  const hardDrop = () => {
    const { currentPiece, board, paused, gameOver } = stateRef.current;
    if (!currentPiece || paused || gameOver) return;

    let dist = 0;
    while (!checkCollision(currentPiece, board, 0, dist + 1)) {
      dist++;
    }

    setState(s => ({
      ...s,
      score: s.score + (dist * SCORING.HARD_DROP),
      currentPiece: s.currentPiece ? { ...s.currentPiece, pos: { ...s.currentPiece.pos, y: s.currentPiece.pos.y + dist } } : null
    }));
    audio.playDrop();
    lockPiece();
  };

  const holdPiece = () => {
    const { currentPiece, holdPiece, canHold, paused, gameOver, board, nextPiece } = stateRef.current;
    if (!currentPiece || !canHold || paused || gameOver) return;

    const currentY = currentPiece.pos.y;
    const currentType = currentPiece.type;

    const typeToSpawn = holdPiece || nextPiece;
    const tetromino = TETROMINOES[typeToSpawn];
    
    const newPiece: Piece = {
      type: typeToSpawn,
      pos: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(tetromino.shape[0].length / 2), y: currentY },
      rotation: 0,
      shape: tetromino.shape,
    };

    // Nudge up if colliding at the requested Y
    let finalY = currentY;
    const testPiece = { ...newPiece };
    while (finalY > 0 && checkCollision(testPiece, board)) {
      finalY--;
      testPiece.pos.y = finalY;
    }
    newPiece.pos.y = finalY;

    if (checkCollision(newPiece, board)) {
      setState(s => ({ ...s, gameOver: true, currentPiece: null }));
      audio.playGameOver();
      return;
    }

    setState(s => ({
      ...s,
      holdPiece: currentType,
      currentPiece: newPiece,
      nextPiece: holdPiece ? s.nextPiece : getRandomTetromino(),
      canHold: false
    }));
    
    audio.playMove();
  };

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.gameOver) return;

      switch(e.key) {
        case 'ArrowLeft': movePiece(-1); break;
        case 'ArrowRight': movePiece(1); break;
        case 'ArrowDown': dropPiece(); break;
        case 'ArrowUp': 
        case 'x': rotatePiece(1); break;
        case 'z': rotatePiece(-1); break;
        case ' ': e.preventDefault(); setState(s => ({ ...s, paused: !s.paused })); break;
        case 'c': holdPiece(); break;
        case 'p': setState(s => ({ ...s, paused: !s.paused })); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dropPiece]);

  // Main Game Loop
  const update = (time: number) => {
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    if (!stateRef.current.paused && !stateRef.current.gameOver) {
      dropCounterRef.current += deltaTime;
      
      // Speed factor based on level (lines) AND score (every 1000 points)
      const scoreLevel = Math.floor(stateRef.current.score / 1000);
      const lineLevel = stateRef.current.level - 1;
      const totalLevel = scoreLevel + lineLevel;
      
      // Cap the speed to avoid it being 0ms
      const speed = Math.max(100, INITIAL_FALL_SPEED * Math.pow(SPEED_INCREMENT, totalLevel));
      
      if (dropCounterRef.current > speed) {
        dropPiece();
        // Reset counter but preserve remainder for smoother sub-speed drops if needed
        dropCounterRef.current %= speed;
      }
    }

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    spawnPiece(getRandomTetromino());
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const restart = () => {
    const firstType = getRandomTetromino();
    const firstTetro = TETROMINOES[firstType];
    const initialPiece: Piece = {
        type: firstType,
        pos: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(firstTetro.shape[0].length / 2), y: 0 },
        rotation: 0,
        shape: firstTetro.shape,
    };

    setState(s => ({
        board: createEmptyBoard(),
        currentPiece: initialPiece,
        nextPiece: getRandomTetromino(),
        holdPiece: null,
        canHold: true,
        score: 0,
        level: 1,
        lines: 0,
        gameOver: false,
        paused: false,
        highScore: s.highScore,
        combo: 0,
    }));
  };

  return { state, restart, setState };
};
