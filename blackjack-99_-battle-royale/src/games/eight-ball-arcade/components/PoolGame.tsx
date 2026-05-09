import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Ball, GameState, TABLE_CONFIG, TABLE_CONFIG as CONFIG, BallType, GameMode, BotDifficulty, GamePlayer } from '../lib/game/types';
import { Physics } from '../lib/game/Physics';
import { Engine } from '../lib/game/Engine';
import { BotAI } from '../lib/game/Bot';
import { audioManager } from '../lib/game/Audio';
import { MultiplayerManager, auth } from '../lib/game/Multiplayer';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Home, Play, Users, Cpu, Settings as SettingsIcon, Volume2, VolumeX, Menu as MenuIcon, X } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import confetti from 'canvas-confetti';
import { toast, Toaster } from 'sonner';
import { clsx } from 'clsx';
import { useAuth } from '../../../context/AuthContext';

const BALL_COLORS: Record<number, string> = {
  0: '#ffffff', // Cue
  1: '#ffd700',
  2: '#0000ff',
  3: '#ff0000',
  4: '#800080',
  5: '#ff8c00',
  6: '#008000',
  7: '#8b0000',
  8: '#000000',
  9: '#ffd700',
  10: '#0000ff',
  11: '#ff0000',
  12: '#800080',
  13: '#ff8c00',
  14: '#008000',
  15: '#8b0000',
};

function ScoreboardBall({ number, type, isPocketed }: { number: number; type: BallType; isPocketed: boolean; key?: React.Key }) {
  const color = BALL_COLORS[number] || '#fff';
  const isStripe = type === 'stripe';
  
  return (
    <div className={clsx(
      "relative w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm transition-all duration-500",
      isPocketed ? "opacity-20 scale-75 grayscale shadow-none" : "opacity-100 scale-100 shadow-lg"
    )} style={{ backgroundColor: isStripe ? '#fff' : color, border: isStripe ? `2px solid ${color}` : 'none' }}>
      {isStripe && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
           <div className="w-full h-[40%] flex items-center justify-center" style={{ backgroundColor: color }}>
              <span className="text-white scale-75">{number}</span>
           </div>
        </div>
      )}
      {!isStripe && <span className={clsx(number === 8 || number === 2 || number === 3 || number === 7 || number === 15 ? "text-white" : "text-black")}>{number === 0 ? '' : number}</span>}
      {isPocketed && (
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="w-full h-[1px] bg-white/50 rotate-45" />
        </div>
      )}
    </div>
  );
}

function ScoreCard({ player, balls, isTurn, turnStartTime, mode }: { player: GamePlayer; balls: Ball[]; isTurn: boolean; turnStartTime?: number; mode?: GameMode }) {
   const groupType = player.group === 'solids' ? 'solid' : 'stripe';
   const playerBalls = balls.filter(b => b.type === groupType);
   const eightBall = balls.find(b => b.type === 'black')!;
   const remainingGroup = playerBalls.filter(b => !b.isPocketed).length;
   
   const [timeLeft, setTimeLeft] = useState(30);

   useEffect(() => {
      if (!isTurn || mode !== 'online' || !turnStartTime) {
         setTimeLeft(30);
         return;
      }
      
      const interval = setInterval(() => {
         const elapsed = Math.floor((Date.now() - turnStartTime) / 1000);
         setTimeLeft(Math.max(0, 30 - elapsed));
      }, 500);

      return () => clearInterval(interval);
   }, [isTurn, turnStartTime, mode]);

   return (
      <div className={clsx(
         "flex flex-col gap-2 transition-all p-3 rounded-2xl border-2 relative overflow-hidden",
         isTurn ? "border-amber-400 bg-slate-800/80 shadow-[0_0_30px_rgba(251,191,36,0.15)]" : "border-transparent opacity-60 bg-transparent"
      )}>
         {/* Timer Animation Bar */}
         {isTurn && mode === 'online' && (
            <motion.div 
               className="absolute bottom-0 left-0 h-1 bg-amber-400"
               initial={{ width: '100%' }}
               animate={{ width: `${(timeLeft / 30) * 100}%` }}
               transition={{ duration: 0.5 }}
            />
         )}

         <div className="flex items-center gap-3">
            <div className={clsx(
               "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg relative",
               isTurn ? "bg-amber-400 text-black" : "bg-slate-800 text-slate-500"
            )}>
               {player.uid === 'p1' ? '1' : '2'}
               
               {/* Time Left Badge */}
               {isTurn && mode === 'online' && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black text-[10px] rounded-full flex items-center justify-center border border-amber-400 font-black animate-pulse shadow-lg">
                     {timeLeft}
                  </div>
               )}
            </div>
            <div className="flex-1">
               <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                     <p className="font-bold text-sm text-white line-clamp-1">{player.name}</p>
                     {/* Violations dots */}
                     {mode === 'online' && (
                        <div className="flex gap-0.5 flex-shrink-0">
                           {[...Array(3)].map((_, i) => (
                              <div 
                                 key={i} 
                                 className={clsx(
                                    "w-1.5 h-1.5 rounded-full border border-red-500/50",
                                    (player.violations || 0) > i ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "bg-white/5"
                                 )} 
                              />
                           ))}
                        </div>
                     )}
                  </div>
                  <span className="text-[10px] font-black text-amber-400 whitespace-nowrap">
                     {remainingGroup === 0 && !eightBall.isPocketed ? 'TARGET: 8' : remainingGroup > 0 ? `${remainingGroup} LEFT` : ''}
                  </span>
               </div>
               <div className="flex gap-1 mt-1.5 h-6">
                  {player.group ? (
                     <>
                        {playerBalls.sort((a,b) => a.number - b.number).map(b => (
                           <ScoreboardBall key={b.id} number={b.number} type={b.type} isPocketed={b.isPocketed} />
                        ))}
                        {remainingGroup === 0 && <ScoreboardBall number={8} type="black" isPocketed={false} />}
                     </>
                  ) : (
                     <p className="text-[10px] font-bold text-slate-500 italic uppercase tracking-wider">Unassigned</p>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}

export default function PoolGame() {
  const { displayName } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const [menuStage, setMenuStage] = useState<'main' | 'difficulty'>('main');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [myRole, setMyRole] = useState<'white' | 'black' | null>(null);
  const [onlineMatchId, setOnlineMatchId] = useState<string | null>(null);

  // Simulation State (for loop performance)
  const gameStateRef = useRef<GameState | null>(null);
  const [displayState, setDisplayState] = useState<GameState | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [isAiming, setIsAiming] = useState(false);
  const [isAimLocked, setIsAimLocked] = useState(false);
  const [shotAngle, setShotAngle] = useState(0);
  const [isPrecisionMode, setIsPrecisionMode] = useState(false);
  const [cueSpin, setCueSpin] = useState({ x: 0, y: 0 }); // -1 to 1 for each axis
  const [isStriking, setIsStriking] = useState(false);
  const [strikeProgress, setStrikeProgress] = useState(0); // 0 to 1
  const [shotPower, setShotPower] = useState(0);
  const [isInteractingMeter, setIsInteractingMeter] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const strikeParamsRef = useRef<{ angle: number; power: number } | null>(null);
  const websitePlayerName = displayName || auth.currentUser?.displayName || 'Player';

  // Initialize game
  const startGame = useCallback((selectedMode: GameMode, diff?: BotDifficulty, p1?: string, p2?: string) => {
    const balls = Engine.createBalls();
    const playerOneName = selectedMode === 'local' ? (p1 || 'Player 1') : (p1 || websitePlayerName);
    const players: [GamePlayer, GamePlayer] = [
      { uid: 'p1', name: playerOneName, group: null, violations: 0 },
      { uid: 'p2', name: p2 || 'Player 2', group: null, violations: 0 },
    ];

    if (selectedMode === 'bot') {
      players[1] = { uid: 'bot', name: `Bot (${diff})`, group: null };
    }

    const newState: GameState = {
      mode: selectedMode,
      difficulty: diff,
      players,
      turnIndex: 0,
      balls,
      firstBallHit: null,
      ballsPocketedThisTurn: [],
      isMoving: false,
      isFoul: false,
      foulReason: null,
      isBallInHand: true,
      nominatedPocket: null,
      turnStartTime: Date.now(),
      winner: null,
      status: 'playing',
    };

    setGameState(newState);
    gameStateRef.current = newState;
    setDisplayState(newState);
    setMode(selectedMode);
    setMenuOpen(false);
    setOnlineMatchId(null);
    setMyRole(null);
  }, [websitePlayerName]);

  const handleOnlineMatch = async () => {
    try {
      let user = auth.currentUser;
      if (!user) {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        user = result.user;
      }

      setMatchmaking(true);
      await MultiplayerManager.startMatchmaking(
        { uid: user.uid, name: websitePlayerName, group: null },
        (matchId, role) => {
          setOnlineMatchId(matchId);
          setMyRole(role);
          setMatchmaking(false);
          setMenuOpen(false);
          setMode('online');
          
          MultiplayerManager.listenToMatch(matchId, (data) => {
            // Update local state from Firebase
            if (data.balls) {
               const updateFunc = (prev: GameState | null) => {
                 if (!prev) return null;
                 const next: GameState = { 
                   ...prev, 
                   balls: data.balls, 
                   turnIndex: data.turn === prev.players[0].uid ? 0 : 1, 
                   status: data.status, 
                   winner: data.winner,
                   turnStartTime: data.turnStartTime || prev.turnStartTime,
                   players: [
                     { ...prev.players[0], ...data.players?.white },
                     { ...prev.players[1], ...data.players?.black }
                   ]
                 };
                 gameStateRef.current = next;
                 return next;
               };
               setGameState(updateFunc);
               setDisplayState(updateFunc(gameStateRef.current));
            }
          });
        }
      );
    } catch (err) {
      toast.error('Failed to join matchmaking');
      setMatchmaking(false);
    }
  };

  // Game Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    
    let rafId: number;
    const ctx = canvasRef.current.getContext('2d')!;

    const loop = () => {
      const state = gameStateRef.current;
      if (!state || state.status === 'finished') {
        if (state) render(ctx, state, mousePosRef.current, isAiming, shotAngle, shotPower, isStriking, strikeProgress);
        rafId = requestAnimationFrame(loop);
        return;
      }

      // Handle Strike Animation
      if (isStriking) {
        setStrikeProgress(prev => {
          const next = prev + 0.15; // Animation speed
          if (next >= 1) {
            // Impact!
            if (strikeParamsRef.current) {
              const { angle, power } = strikeParamsRef.current;
              applyShotVelocities(angle, power);
              strikeParamsRef.current = null;
            }
            setIsStriking(false);
            return 0;
          }
          return next;
        });
      }

      // 1. Physics Update
      if (state.isMoving) {
        const nextBalls = [...state.balls];
        let stillMoving = false;
        
        const substeps = 12; // High precision for professional feel
        const dt = 1 / substeps;

        for (let s = 0; s < substeps; s++) {
          // Update positions and handle pocketing
          nextBalls.forEach(ball => {
            if (!ball.isPocketed) {
               const wasPocketed = ball.isPocketed;
               Physics.updateBall(ball, CONFIG, dt);
               if (ball.isPocketed && !wasPocketed) {
                  audioManager.playPocketed();
                  state.ballsPocketedThisTurn.push({...ball});
               }
            }
          });

          // Resolve collisions
          for (let i = 0; i < nextBalls.length; i++) {
            for (let j = i + 1; j < nextBalls.length; j++) {
              if (Physics.resolveBallCollision(nextBalls[i], nextBalls[j])) {
                 // Sound only once per visual frame to avoid noise
                 if (s === 0) audioManager.playBallCollision();
                 if (nextBalls[i].type === 'cue' && !state.firstBallHit) {
                    state.firstBallHit = {...nextBalls[j]};
                 }
              }
            }
          }
        }

        // Final check for movement
        nextBalls.forEach(ball => {
          if (!ball.isPocketed && (Math.abs(ball.vx) > 0.05 || Math.abs(ball.vy) > 0.05)) {
            stillMoving = true;
          }
        });

        if (!stillMoving) {
          // Turn ended
          const updatedState = Engine.checkRules({ ...state, balls: nextBalls, isMoving: false });
          
          // Reset aim locking state for next turn
          setIsAimLocked(false);
          setIsAiming(false);

          if (updatedState.winner) {
            audioManager.playVictory();
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          } else if (updatedState.isFoul) {
            audioManager.playFoul();
            toast.error(`Foul: ${updatedState.foulReason}`);
          }
          
          gameStateRef.current = updatedState;
          setGameState(updatedState);
          setDisplayState(updatedState);
          
          if (onlineMatchId && myRole) {
             // Sync state to firebase
             MultiplayerManager.syncGameState(onlineMatchId, {
                balls: updatedState.balls,
                status: updatedState.status,
                winner: updatedState.winner,
                turn: updatedState.players[updatedState.turnIndex].uid,
                turnStartTime: updatedState.turnStartTime,
                players: {
                  white: updatedState.players[0],
                  black: updatedState.players[1]
                }
             } as any);
          }
        } else {
          state.balls = nextBalls;
          // Periodically sync display state during movement for UI listeners if needed
          // setDisplayState({...state}); 
        }
      }

      // 2. Rendering
      render(ctx, state, mousePosRef.current, isAiming, shotAngle, shotPower, isStriking, strikeProgress);

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onlineMatchId, myRole, mousePos, isAiming, shotAngle, shotPower]);

  // Bot Turn Logic
  useEffect(() => {
    if (!gameState || gameState.isMoving || gameState.mode !== 'bot' || gameState.turnIndex !== 1 || gameState.winner) return;

    const botTimer = setTimeout(() => {
      // 1. If on 8-ball and haven't nominated, do that first
      const currentPlayer = gameState.players[1];
      const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
      const hasRemainingBalls = gameState.balls.some(b => b.type === targetType && !b.isPocketed);
      const isOnEightBall = !!currentPlayer.group && !hasRemainingBalls;

      if (isOnEightBall && !gameState.nominatedPocket) {
        const shot = BotAI.getShot(gameState);
        if (shot) {
          setGameState(prev => {
            if (!prev) return null;
            const next = { ...prev, nominatedPocket: shot.pocket };
            gameStateRef.current = next;
            return next;
          });
        }
        return;
      }

      const shot = BotAI.getShot(gameState);
      if (shot) {
        shoot(shot.angle, shot.power);
      }
    }, 1500);

    return () => clearTimeout(botTimer);
  }, [gameState?.turnIndex, gameState?.isMoving, gameState?.nominatedPocket]);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(prev => !prev);
      
      // Precision Aiming with Arrow Keys
      if (isAiming && !gameState?.isMoving && !gameState?.winner) {
        const step = e.shiftKey ? 0.001 : 0.005; // Even finer steps
        if (e.key === 'ArrowLeft') {
          setShotAngle(prev => prev - step);
          setIsAimLocked(true);
        }
        if (e.key === 'ArrowRight') {
          setShotAngle(prev => prev + step);
          setIsAimLocked(true);
        }
      }

      if (e.shiftKey) setIsPrecisionMode(true);

      if (e.key === 'r' || e.key === 'R') {
        if (gameState?.isBallInHand) {
          // Ball in hand reset logic if needed
        } else {
          // Restart game logic or reset aim
        }
      }
      if (e.key === ' ') {
        if (gameState?.isBallInHand) {
          confirmPlacement();
        } else {
          setIsAiming(false);
          setShotPower(0);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) setIsPrecisionMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Turn Timer Effect (Multiplayer only)
  useEffect(() => {
    if (gameState?.mode !== 'online' || gameState.status === 'finished' || gameState.isMoving) return;

    const timer = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || state.isMoving || state.status === 'finished' || state.mode !== 'online') return;

      // Only check timer if it's our turn to avoid double-processing (though logic should be safe)
      // Actually, in a real p2p/multiplayer, usually one authority or both check.
      // Since it's Firebase, we can let both check, but usually the active player checks.
      const isMyTurn = state.players[state.turnIndex].uid === auth.currentUser?.uid;
      
      if (isMyTurn && state.turnStartTime) {
        const elapsed = Date.now() - state.turnStartTime;
        if (elapsed >= 30000) {
          // Time out!
          const updatedState = Engine.forfeitTurn(state);
          gameStateRef.current = updatedState;
          setGameState(updatedState);
          setDisplayState(updatedState);
          
          if (onlineMatchId) {
            MultiplayerManager.syncGameState(onlineMatchId, {
              status: updatedState.status,
              winner: updatedState.winner,
              turn: updatedState.players[updatedState.turnIndex].uid,
              turnStartTime: updatedState.turnStartTime,
              players: {
                white: updatedState.players[0],
                black: updatedState.players[1]
              }
            } as any);
          }
          toast.error('Time limit exceeded!');
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.mode, gameState?.status, gameState?.isMoving, onlineMatchId]);

  const confirmPlacement = () => {
    setGameState(prev => {
      if (!prev) return null;
      const next = { ...prev, isBallInHand: false };
      gameStateRef.current = next;
      setDisplayState(next);
      return next;
    });
  };

  const shoot = (angle: number, power: number) => {
    const state = gameStateRef.current;
    if (!state || state.isMoving || state.winner || isStriking) return;
    
    // Enforce pocket nomination for 8-ball
    const currentPlayer = state.players[state.turnIndex];
    const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
    const hasRemainingBalls = state.balls.some(b => b.type === targetType && !b.isPocketed);
    const isOnEightBall = !!currentPlayer.group && !hasRemainingBalls;

    if (isOnEightBall && !state.nominatedPocket) {
      toast.error('Select a pocket for the 8-ball first!');
      return;
    }

    // Start striking animation first
    strikeParamsRef.current = { angle, power };
    setIsStriking(true);
    setStrikeProgress(0);
  };

  const applyShotVelocities = (angle: number, power: number) => {
    const state = gameStateRef.current;
    if (!state) return;

    audioManager.playCueHit(power);
    const cueBall = state.balls.find(b => b.type === 'cue')!;
    
    // Basic velocity
    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;

    // Apply spin based on cue hit point
    // cueSpin.y is top/back spin (Vertical)
    // cueSpin.x is side English (Horizontal)
    const spinStrength = power * 1.5;
    
    // Follow/Draw (along shots direction)
    const spinV = cueSpin.y * spinStrength;
    // Side English (perpendicular to shots direction)
    const spinH = cueSpin.x * spinStrength;

    cueBall.spinX = Math.cos(angle) * spinV + Math.cos(angle + Math.PI / 2) * spinH;
    cueBall.spinY = Math.sin(angle) * spinV + Math.sin(angle + Math.PI / 2) * spinH;
    
    // Visual rotation effect
    cueBall.rotation = (cueBall.rotation || 0) + spinH * 0.1;

    const nextState: GameState = {
      ...state,
      isMoving: true,
      firstBallHit: null,
      ballsPocketedThisTurn: [],
      isFoul: false,
      foulReason: null,
      isBallInHand: false,
    };
    
    setIsAimLocked(false);
    gameStateRef.current = nextState;
    setGameState(nextState);
    setDisplayState(nextState);
    
    // Reset spin for next shot
    setCueSpin({ x: 0, y: 0 });
  };

  const BORDER_OFFSET = 24;

  const handleMouseDown = (e: React.MouseEvent) => {
    const state = gameStateRef.current;
    if (!state || state.isMoving || state.winner || state.status === 'finished') return;
    
    // Check if it's our turn online
    if (onlineMatchId && state.players[state.turnIndex].uid !== auth.currentUser?.uid) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - BORDER_OFFSET;
    const y = e.clientY - rect.top - BORDER_OFFSET;

    // Pocket Nomination Logic
    const currentPlayer = state.players[state.turnIndex];
    const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
    const hasRemainingBalls = state.balls.some(b => b.type === targetType && !b.isPocketed);
    const isOnEightBall = !!currentPlayer.group && !hasRemainingBalls;

    if (isOnEightBall && !state.isMoving) {
      // Check if clicking near a pocket
      for (const pocket of CONFIG.pockets) {
        const dx = x - pocket.x;
        const dy = y - pocket.y;
        if (Math.sqrt(dx * dx + dy * dy) < CONFIG.pocketRadius * 2) {
          audioManager.playCueHit(5); // Small sound for feedback
          setGameState(prev => {
            if (!prev) return null;
            const next = { ...prev, nominatedPocket: pocket };
            gameStateRef.current = next;
            return next;
          });
          return;
        }
      }
    }

    if (state.isBallInHand) {
       const cueBall = state.balls.find(b => b.type === 'cue')!;
       
       // Constrain to "The Kitchen" (Left quarter of the table) if no balls pocketed yet (initial break)
       // Or just generally constrain to left side if it's ball-in-hand to follow common rules
       const maxX = state.ballsPocketedThisTurn.length === 0 && !state.players[0].group 
          ? CONFIG.width * 0.25 
          : CONFIG.width - BORDER_OFFSET;

       // Move ball to clicked spot
       cueBall.x = Math.max(BORDER_OFFSET, Math.min(maxX, x));
       cueBall.y = Math.max(BORDER_OFFSET, Math.min(CONFIG.height - BORDER_OFFSET, y));
       
       // Just update refs and force re-render
       setGameState({ ...state });
       setDisplayState({ ...state });
       return;
    }

    setIsAimLocked(prev => !prev);
    setIsAiming(true);
  };

  // Global mouse tracking for smoother aiming
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      const state = gameStateRef.current;
      if (!canvasRef.current || displayState?.isMoving || !state) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - BORDER_OFFSET;
      const y = e.clientY - rect.top - BORDER_OFFSET;
      
      const prevX = lastMousePosRef.current.x;
      const prevY = lastMousePosRef.current.y;
      lastMousePosRef.current = { x, y };

      if (isAimLocked && !e.shiftKey) return;

      const cueBall = state.balls.find(b => b.type === 'cue');
      if (cueBall) {
        if (e.shiftKey && isAiming) {
          // Relative rotation (Precision Mode)
          const dx = x - prevX;
          const dy = y - prevY;
          // Use horizontal movement for rotation primarily, dampened
          const rotateAmount = (dx + dy) * 0.0015;
          setShotAngle(prev => prev + rotateAmount);
          setIsAimLocked(true);
        } else if (!isAimLocked) {
          // Absolute rotation
          const dx = cueBall.x - x;
          const dy = cueBall.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 15) {
            const angle = Math.atan2(dy, dx);
            setShotAngle(angle);
          }
        }
      }

      mousePosRef.current = { x, y };
      
      if (!isAiming && !displayState?.winner && !state.isMoving) {
        setIsAiming(true);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isAiming || displayState?.isMoving || displayState?.winner) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.005 : -0.005;
      setShotAngle(prev => prev + delta);
      setIsAimLocked(true);
    };

    window.addEventListener('mousemove', handleGlobalMove);
    const canvas = canvasRef.current;
    if (canvas) canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      if (canvas) canvas.removeEventListener('wheel', handleWheel);
    };
  }, [isAiming, isAimLocked, displayState?.isMoving, displayState?.winner]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || isAimLocked) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - BORDER_OFFSET;
    const y = e.clientY - rect.top - BORDER_OFFSET;
    const newPos = { x, y };
    setMousePos(newPos);
    mousePosRef.current = newPos;
  };

  const handleMouseUp = () => {
    dragStartRef.current = null;
  };

  const render = (ctx: CanvasRenderingContext2D, state: GameState, mouse: { x: number; y: number }, aiming: boolean, angle: number, power: number, striking: boolean, strikeAmount: number) => {
    // Clear
    ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

    // Table & Cloth Base
    const cw = CONFIG.cushionWidth;
    const pr = CONFIG.pocketRadius;
    const w = CONFIG.width;
    const h = CONFIG.height;

    // Wood Rail Frame (Subtle dark border inside canvas)
    ctx.fillStyle = '#2d150b';
    ctx.fillRect(0, 0, w, h);

    // Pockets (Deep holes) - Drawn first so they are "under" the cushions and felt
    ctx.fillStyle = '#020617';
    
    const currentPlayer = state.players[state.turnIndex];
    const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
    const hasRemainingBalls = state.balls.some(b => b.type === targetType && !b.isPocketed);
    const isOnEightBall = !!currentPlayer.group && !hasRemainingBalls;

    CONFIG.pockets.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // 8-Ball Pocket Nomination UI
      if (isOnEightBall && !state.winner && !state.isMoving) {
        const isNominated = state.nominatedPocket && 
                            Math.abs(state.nominatedPocket.x - p.x) < 5 && 
                            Math.abs(state.nominatedPocket.y - p.y) < 5;
        
        ctx.save();
        if (isNominated) {
           // Glow effect for selected pocket
           ctx.shadowBlur = 15;
           ctx.shadowColor = '#fbbf24';
           ctx.strokeStyle = '#fbbf24';
           ctx.lineWidth = 4;
           ctx.beginPath();
           ctx.arc(p.x, p.y, pr * 1.4, 0, Math.PI * 2);
           ctx.stroke();

           ctx.shadowBlur = 0;
           ctx.fillStyle = '#fbbf24';
           ctx.font = 'black 9px Inter';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.fillText('TARGET', p.x, p.y + pr * 2.5);
        } else if (!state.nominatedPocket) {
           // Hint for unselected pockets
           const pulse = Math.sin(Date.now() / 300) * 0.5 + 0.5;
           ctx.strokeStyle = `rgba(251, 191, 36, ${0.15 + pulse * 0.35})`;
           ctx.lineWidth = 2;
           ctx.setLineDash([4, 4]);
           ctx.beginPath();
           ctx.arc(p.x, p.y, pr * 1.4, 0, Math.PI * 2);
           ctx.stroke();
        }
        ctx.restore();
      }
    });

    // Green Cloth with "Pocket Notches"
    // This creates the "corners lead to pockets" visual by drawing a complex path for the felt
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    
    // Start after TL pocket
    ctx.moveTo(cw + pr, cw);
    
    // Top rail to Mid pocket
    ctx.lineTo(w/2 - pr, cw);
    // Mid-Top pocket cutout (leads IN to the pocket)
    ctx.quadraticCurveTo(w/2, cw + 12, w/2 + pr, cw);
    
    // Top rail to TR pocket
    ctx.lineTo(w - cw - pr, cw);
    // TR Corner pocket cutout
    ctx.quadraticCurveTo(w - cw - 12, cw + 12, w - cw, cw + pr);
    
    // Right rail to BR pocket
    ctx.lineTo(w - cw, h - cw - pr);
    // BR Corner pocket cutout
    ctx.quadraticCurveTo(w - cw - 12, h - cw - 12, w - cw - pr, h - cw);
    
    // Bottom rail to BM pocket
    ctx.lineTo(w/2 + pr, h - cw);
    // Mid-Bottom pocket cutout
    ctx.quadraticCurveTo(w/2, h - cw - 12, w/2 - pr, h - cw);
    
    // Bottom rail to BL pocket
    ctx.lineTo(cw + pr, h - cw);
    // BL Corner pocket cutout
    ctx.quadraticCurveTo(cw + 12, h - cw - 12, cw, h - cw - pr);
    
    // Left rail to TL pocket
    ctx.lineTo(cw, cw + pr);
    // TL Corner pocket cutout
    ctx.quadraticCurveTo(cw + 12, cw + 10, cw + pr, cw);
    
    ctx.fill();

    // Felt highlight/gradient overlay
    const feltGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 1.5);
    feltGrad.addColorStop(0, 'rgba(52, 211, 153, 0.08)');
    feltGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = feltGrad;
    ctx.fill(); // Re-use the complex path for gradient

    // Cushions (Rails with angled ends for "mouths")
    ctx.fillStyle = '#3f1a01';
    
    // Helper to draw angled rails
    const drawRail = (pts: {x: number, y: number}[]) => {
       ctx.beginPath();
       ctx.moveTo(pts[0].x, pts[0].y);
       pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
       ctx.closePath();
       ctx.fill();
       // Subtle gradient/lighting on rail
       ctx.fillStyle = 'rgba(255,255,255,0.03)';
       ctx.fill();
    };

    // Top Rails (2 segments)
    drawRail([{x: cw + pr, y: 0}, {x: w/2 - pr, y: 0}, {x: w/2 - pr - 8, y: cw}, {x: cw + pr + 8, y: cw}]);
    drawRail([{x: w/2 + pr, y: 0}, {x: w - cw - pr, y: 0}, {x: w - cw - pr - 8, y: cw}, {x: w/2 + pr + 8, y: cw}]);

    // Bottom Rails (2 segments)
    drawRail([{x: cw + pr, y: h}, {x: w/2 - pr, y: h}, {x: w/2 - pr - 8, y: h - cw}, {x: cw + pr + 8, y: h - cw}]);
    drawRail([{x: w/2 + pr, y: h}, {x: w - cw - pr, y: h}, {x: w - cw - pr - 8, y: h - cw}, {x: w/2 + pr + 8, y: h - cw}]);

    // Left Rail
    drawRail([{x: 0, y: cw + pr}, {x: 0, y: h - cw - pr}, {x: cw, y: h - cw - pr - 8}, {x: cw, y: cw + pr + 8}]);

    // Right Rail
    drawRail([{x: w, y: cw + pr}, {x: w, y: h - cw - pr}, {x: w - cw, y: h - cw - pr - 8}, {x: w - cw, y: cw + pr + 8}]);

    // Head String (Kitchen Line)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(CONFIG.width * 0.25, CONFIG.cushionWidth);
    ctx.lineTo(CONFIG.width * 0.25, CONFIG.height - CONFIG.cushionWidth);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Balls
    state.balls.forEach(ball => {
      if (!ball.isPocketed) {
        // Shadow
        ctx.beginPath();
        ctx.arc(ball.x + 2, ball.y + 2, CONFIG.ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Ball body
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, CONFIG.ballRadius, 0, Math.PI * 2);
        
        const grad = ctx.createRadialGradient(
          ball.x - CONFIG.ballRadius * 0.3, 
          ball.y - CONFIG.ballRadius * 0.3, 
          CONFIG.ballRadius * 0.1, 
          ball.x, 
          ball.y, 
          CONFIG.ballRadius
        );
        
        let color = BALL_COLORS[ball.number] || '#fff';
        
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.2, color === '#ffffff' ? '#fff' : color);
        grad.addColorStop(1, ball.type === 'cue' ? '#ddd' : '#000');
        
        ctx.fillStyle = grad;
        ctx.fill();

        // Transform for ball orientation (rolling)
        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.rotation || 0);

        // Stripe styling
        if (ball.type === 'stripe') {
          ctx.beginPath();
          ctx.arc(0, 0, CONFIG.ballRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = color;
          ctx.fillRect(-CONFIG.ballRadius, -CONFIG.ballRadius * 0.4, CONFIG.ballRadius * 2, CONFIG.ballRadius * 0.8);
        }

        // Highlight (drawn relative to ball center now)
        ctx.beginPath();
        ctx.arc(-CONFIG.ballRadius * 0.4, -CONFIG.ballRadius * 0.4, CONFIG.ballRadius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
        
        // Number circle
        if (ball.type !== 'cue') {
           ctx.beginPath();
           ctx.arc(0, 0, CONFIG.ballRadius * 0.4, 0, Math.PI * 2);
           ctx.fillStyle = '#fff';
           ctx.fill();
           ctx.fillStyle = '#000';
           ctx.font = `bold ${CONFIG.ballRadius * 0.5}px Inter`;
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.fillText(ball.number ? ball.number.toString() : '', 0, 0);
        }
        ctx.restore();
      }
    });

    if (isOnEightBall && !state.nominatedPocket && !state.isMoving && !state.winner) {
        ctx.save();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'black 20px Inter';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText('SELECT A POCKET FOR THE 8-BALL', CONFIG.width / 2, CONFIG.height / 2 - 60);
        ctx.restore();
    }

    // Cue/Aiming
    const cueBall = state.balls.find(b => b.type === 'cue')!;
    if ((aiming || striking) && !state.isMoving && !state.isBallInHand && !state.winner) {
      const currentAngle = aiming ? angle : strikeParamsRef.current?.angle || 0;
      
      // Aiming Guide / Trajectory Prediction
      if (aiming && !striking) {
        let firstHit: { ball: Ball, dist: number, impactX: number, impactY: number } | null = null;
        let minDist = 2000;

        // Check for collisions with other balls
        state.balls.forEach(target => {
          if (target === cueBall || target.isPocketed) return;

          // Ray (cueBall) vs Circle (target) intersection
          // Using a wider radius (2 * ballRadius) to detect if the cue ball WILL hit
          const dx = target.x - cueBall.x;
          const dy = target.y - cueBall.y;
          const targetDist = Math.sqrt(dx * dx + dy * dy);
          
          const dirX = Math.cos(currentAngle);
          const dirY = Math.sin(currentAngle);
          
          // Project target position onto aiming line
          const projection = dx * dirX + dy * dirY;
          if (projection > 0) {
             const closestDistSq = targetDist * targetDist - projection * projection;
             const collisionThresholdSq = Math.pow(CONFIG.ballRadius * 2, 2);
             
             if (closestDistSq < collisionThresholdSq) {
                // We have an intersection
                const d = Math.sqrt(collisionThresholdSq - closestDistSq);
                const hitDist = projection - d;
                
                if (hitDist < minDist) {
                   minDist = hitDist;
                   firstHit = {
                      ball: target,
                      dist: hitDist,
                      impactX: cueBall.x + dirX * hitDist,
                      impactY: cueBall.y + dirY * hitDist
                   };
                }
             }
          }
        });

        // Draw main path
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.moveTo(cueBall.x, cueBall.y);
        
        if (firstHit) {
           ctx.lineTo(firstHit.impactX, firstHit.impactY);
           ctx.stroke();

           // Draw ghost cue ball at impact
           ctx.beginPath();
           ctx.setLineDash([]);
           ctx.arc(firstHit.impactX, firstHit.impactY, CONFIG.ballRadius, 0, Math.PI * 2);
           ctx.strokeStyle = 'rgba(255,255,255,0.2)';
           ctx.stroke();
           
           // Physics-accurate deflection calculation (Matching Physics.ts)
           const dx = firstHit.ball.x - firstHit.impactX;
           const dy = firstHit.ball.y - firstHit.impactY;
           const hitDist = Math.sqrt(dx * dx + dy * dy);
           const nx = dx / hitDist;
           const ny = dy / hitDist;

           const vx = Math.cos(currentAngle);
           const vy = Math.sin(currentAngle);

           // Normal component (energy transfer)
           const v_dot_n = vx * nx + vy * ny;
           
           // Tangential component
           const tx = -ny;
           const ty = nx;
           const v_dot_t = vx * tx + vy * ty;

           // Throw effect constant from Physics.ts
           const ballFriction = 0.005;
           const throwImpulse = v_dot_t * ballFriction;

           // Calculate final trajectories
           const b2vx = v_dot_n * nx + throwImpulse * tx;
           const b2vy = v_dot_n * ny + throwImpulse * ty;
           const targetAnglePath = Math.atan2(b2vy, b2vx);

           const b1vx = (v_dot_t - throwImpulse) * tx;
           const b1vy = (v_dot_t - throwImpulse) * ty;
           const cueDeflectionAngle = Math.atan2(b1vy, b1vx);

           // Draw target ball predicted path
           ctx.beginPath();
           ctx.setLineDash([2, 5]);
           ctx.moveTo(firstHit.ball.x, firstHit.ball.y);
           // Longer line for better aiming
           const targetLineLen = 200;
           ctx.lineTo(firstHit.ball.x + Math.cos(targetAnglePath) * targetLineLen, firstHit.ball.y + Math.sin(targetAnglePath) * targetLineLen);
           ctx.strokeStyle = 'rgba(251,191,36,0.9)'; // Brighter Amber
           ctx.lineWidth = 2;
           ctx.stroke();

           // Draw cue ball deflection path
           ctx.beginPath();
           ctx.moveTo(firstHit.impactX, firstHit.impactY);
           const cueLineLen = 120;
           ctx.lineTo(firstHit.impactX + Math.cos(cueDeflectionAngle) * cueLineLen, firstHit.impactY + Math.sin(cueDeflectionAngle) * cueLineLen);
           ctx.strokeStyle = 'rgba(255,255,255,0.6)';
           ctx.lineWidth = 1.5;
           ctx.stroke();
           
           ctx.lineWidth = 1;
        } else {
           // Line to edge of table if no hit
           ctx.lineTo(cueBall.x + Math.cos(currentAngle) * 1000, cueBall.y + Math.sin(currentAngle) * 1000);
           ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Cue stick
      const cueLen = 250;
      let cueDist = 20;
      
      if (striking) {
        // Animate from power-offset to impact
        const powerOffset = strikeParamsRef.current ? strikeParamsRef.current.power * 5 : 20;
        cueDist = (10 + powerOffset) * (1 - strikeAmount);
      } else {
        cueDist = 10 + power * 5;
      }
      
      const cueStart = cueDist + CONFIG.ballRadius;
      
      ctx.save();
      ctx.translate(cueBall.x, cueBall.y);
      ctx.rotate(currentAngle);
      
      // Stick shadow
      ctx.beginPath();
      ctx.rect(-cueStart - cueLen, 2, cueLen, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Stick body (tapered)
      const grad = ctx.createLinearGradient(-cueStart - cueLen, 0, -cueStart, 0);
      grad.addColorStop(0, '#1e1b1e');
      grad.addColorStop(0.8, '#451a03');
      grad.addColorStop(1, '#fde68a'); // Tip
      
      ctx.beginPath();
      ctx.moveTo(-cueStart, -2);
      ctx.lineTo(-cueStart - cueLen, -5);
      ctx.lineTo(-cueStart - cueLen, 5);
      ctx.lineTo(-cueStart, 2);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      
      ctx.restore();
    }
  };

  // Main Table Area
  return (
    <div className="eight-ball-pool-page min-h-screen bg-slate-950 text-white font-sans flex flex-col items-center overflow-hidden">
      <Toaster position="top-center" richColors />
      
      {/* HUD Scoreboard */}
      {!menuOpen && displayState && (
        <div className="eight-ball-pool-hud w-full bg-slate-900/90 border-b border-white/10 backdrop-blur-xl flex justify-between items-stretch px-8 z-10 shadow-2xl">
          <div className="flex-1 py-4 max-w-sm">
             <ScoreCard 
                player={displayState.players[0]} 
                balls={displayState.balls} 
                isTurn={displayState.turnIndex === 0 && !displayState.winner}
                turnStartTime={displayState.turnStartTime}
                mode={displayState.mode}
             />
          </div>

          <div className="flex flex-col items-center justify-center px-8 border-x border-white/5">
             <div className="eight-ball-pool-status-pill bg-white/5 px-4 py-1.5 rounded-full flex items-center gap-3 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Shark Table</span>
             </div>
             
             {displayState.winner ? (
                <motion.div 
                   initial={{ scale: 0.5, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   className="text-amber-400 font-black text-2xl tracking-tighter italic"
                >
                   {displayState.players.find(p => p.uid === displayState.winner)?.name || 'Someone'} WINS!
                </motion.div>
             ) : (
                <div className="flex flex-col items-center">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                      {displayState.mode} Mode
                   </p>
                   <div className="flex h-1 gap-1 w-24 bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div className={clsx("h-full transition-all duration-500 bg-amber-400", displayState.turnIndex === 0 ? "w-1/2" : "w-0")} />
                      <div className={clsx("h-full transition-all duration-500 bg-amber-400", displayState.turnIndex === 1 ? "w-1/2" : "w-0")} />
                   </div>
                </div>
             )}
          </div>
          
          <div className="flex-1 py-4 max-w-sm flex items-start justify-end gap-6">
             <div className="flex-1">
                <ScoreCard 
                   player={displayState.players[1]} 
                   balls={displayState.balls} 
                   isTurn={displayState.turnIndex === 1 && !displayState.winner}
                   turnStartTime={displayState.turnStartTime}
                   mode={displayState.mode}
                />
             </div>
             <button onClick={() => setMenuOpen(true)} className="mt-2 p-3 hover:bg-white/10 rounded-2xl transition-all border border-white/5 self-start group">
                <MenuIcon size={20} className="group-hover:rotate-90 transition-transform duration-300" />
             </button>
          </div>
        </div>
      )}

      {/* Main Table Area */}
      <div className="eight-ball-pool-stage flex-1 w-full flex items-center justify-center relative p-8 gap-12">
        <div className="relative group">
          {/* Status Indicators (Top Centered) */}
          <div className="absolute -top-16 left-0 right-0 flex justify-center gap-3 pointer-events-none z-30">
            <AnimatePresence>
              {isAimLocked && !displayState?.isMoving && !displayState?.winner && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex items-center gap-2 bg-amber-400 text-black px-3 py-1.5 rounded-full shadow-2xl border border-amber-500/20"
                >
                  <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Aim Locked</span>
                </motion.div>
              )}
              {isPrecisionMode && !displayState?.isMoving && !displayState?.winner && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-1.5 rounded-full shadow-2xl border border-emerald-600/20"
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Precision Mode</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <canvas
            ref={canvasRef}
            width={CONFIG.width}
            height={CONFIG.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="rounded-[30px] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)] cursor-crosshair border-[24px] border-[#451a03] relative"
          />
          
          {/* Logo overlay on table */}
          <div className="absolute top-6 right-8 text-white/5 text-4xl font-black italic tracking-tighter pointer-events-none select-none">
             8 BALL POOL
          </div>

          {displayState?.isBallInHand && !displayState.isMoving && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="bg-amber-400 text-black px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest flex flex-col items-center gap-2 shadow-2xl pointer-events-auto cursor-pointer active:scale-95 transition-transform" onClick={confirmPlacement}>
                  <RotateCcw size={14} className="animate-spin-slow" />
                  <span>Position Ball & Click to Ready</span>
               </div>
            </div>
          )}
        </div>

        {/* CUE SPIN & POWER SIDEBAR */}
        {!displayState?.isMoving && !displayState?.winner && !menuOpen && (
           <div className="relative flex flex-col items-center gap-8 w-40">
              {/* Spin Selector */}
              <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase mb-3">Cue Spin</span>
                 <div 
                    className="relative w-28 h-28 bg-slate-900 border border-white/10 rounded-full shadow-2xl flex items-center justify-center cursor-crosshair overflow-hidden group/spin"
                    onMouseDown={(e) => {
                       const rect = e.currentTarget.getBoundingClientRect();
                       const update = (clientX: number, clientY: number) => {
                          const x = ((clientX - rect.left) / rect.width - 0.5) * 2;
                          const y = (0.5 - (clientY - rect.top) / rect.height) * 2;
                          const dist = Math.sqrt(x*x + y*y);
                          if (dist <= 1) {
                             setCueSpin({ x, y });
                          } else {
                             const angle = Math.atan2(y, x);
                             setCueSpin({ x: Math.cos(angle), y: Math.sin(angle) });
                          }
                       };
                       update(e.clientX, e.clientY);
                       const move = (me: MouseEvent) => update(me.clientX, me.clientY);
                       const up = () => {
                          window.removeEventListener('mousemove', move);
                          window.removeEventListener('mouseup', up);
                       };
                       window.addEventListener('mousemove', move);
                       window.addEventListener('mouseup', up);
                    }}
                 >
                    {/* Crosshair lines */}
                    <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
                       <div className="w-full h-px bg-white" />
                       <div className="w-px h-full bg-white" />
                    </div>
                    
                    {/* Cue ball visualization */}
                    <div className="w-20 h-20 rounded-full bg-white shadow-[inset_-4px_-4px_12px_rgba(0,0,0,0.2)] flex items-center justify-center pointer-events-none">
                       <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" 
                            style={{ transform: `translate(${cueSpin.x * 32}px, ${-cueSpin.y * 32}px)` }} />
                    </div>
                    
                    <div className="absolute inset-0 border-2 border-white/5 rounded-full group-hover/spin:border-white/20 transition-colors pointer-events-none" />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 mt-4 w-full px-2">
                    <div className="flex flex-col items-center">
                       <span className="text-[8px] font-black text-white/20 uppercase">Follow/Draw</span>
                       <span className={clsx("text-xs font-black italic", cueSpin.y > 0.1 ? "text-emerald-400" : cueSpin.y < -0.1 ? "text-red-400" : "text-white/40")}>
                          {cueSpin.y > 0.1 ? "FOLLOW" : cueSpin.y < -0.1 ? "DRAW" : "NEUTRAL"}
                       </span>
                    </div>
                    <div className="flex flex-col items-center">
                       <span className="text-[8px] font-black text-white/20 uppercase">English</span>
                       <span className={clsx("text-xs font-black italic", cueSpin.x > 0.1 ? "text-amber-400" : cueSpin.x < -0.1 ? "text-amber-400" : "text-white/40")}>
                          {Math.abs(cueSpin.x) > 0.1 ? (cueSpin.x > 0 ? "RIGHT" : "LEFT") : "NONE"}
                       </span>
                    </div>
                 </div>
              </div>

              {/* Power Meter */}
              <div className="flex flex-col items-center group/meter">
                 <span className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase mb-2">Power</span>
                 <div 
                    className="relative w-14 h-64 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl cursor-pointer hover:border-amber-400/30 transition-colors"
                    onMouseDown={(e) => {
                       const rect = e.currentTarget.getBoundingClientRect();
                       let lastPower = 0;
                       
                       const update = (clientY: number) => {
                          const y = clientY - rect.top;
                          lastPower = Math.max(0, Math.min(20, (1 - y / rect.height) * 20));
                          setShotPower(lastPower);
                          setIsAiming(true);
                          setIsInteractingMeter(true);
                       };
                       update(e.clientY);
                       
                       const move = (me: MouseEvent) => update(me.clientY);
                       const up = () => {
                          window.removeEventListener('mousemove', move);
                          window.removeEventListener('mouseup', up);
                          
                          const state = gameStateRef.current;
                          // If we are interacting with meter and release, we shoot if power is significant
                          if (state && !state.isMoving && lastPower > 0.5) {
                             shoot(shotAngle, lastPower);
                          }
                          
                          setIsAiming(false);
                          setIsInteractingMeter(false);
                          setShotPower(0);
                       };
                       window.addEventListener('mousemove', move);
                       window.addEventListener('mouseup', up);
                    }}
                 >
                    {/* Zones markings */}
                    <div className="absolute inset-0 flex flex-col opacity-20 pointer-events-none">
                       <div className="flex-1 border-b border-white/5 flex items-end justify-center pb-2 text-[8px] font-bold">MAX</div>
                       <div className="flex-1 border-b border-white/5 flex items-end justify-center pb-2 text-[8px] font-bold">STRONG</div>
                       <div className="flex-1 border-b border-white/5 flex items-end justify-center pb-2 text-[8px] font-bold">IDEAL</div>
                       <div className="flex-1 flex items-end justify-center pb-2 text-[8px] font-bold">SOFT</div>
                    </div>

                    {/* Gradient Fill */}
                    <motion.div 
                       className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                       initial={{ height: 0 }}
                       animate={{ height: `${(shotPower / 20) * 100}%` }}
                       transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    />
                    
                    {/* Indicator Line */}
                    <motion.div 
                       className="absolute w-full h-0.5 bg-white shadow-[0_0_10px_white] z-10"
                       style={{ bottom: `${(shotPower / 20) * 100}%` }}
                    />
                 </div>
              </div>
              
              <div className="text-center">
                 <div className="text-xl font-black italic tracking-tighter text-amber-400">
                    {Math.round((shotPower / 20) * 100)}%
                 </div>
                 <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">
                    Ready to strike
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* Control Bar */}
      {!menuOpen && (
        <div className="w-full h-16 bg-slate-900/90 border-t border-white/5 flex items-center px-10 gap-8 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
           <div className="flex items-center gap-2">
              <kbd className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-white/10 font-mono">MOUSE</kbd>
              <span>Aim & Shoot</span>
           </div>
           <div className="flex items-center gap-2">
              <kbd className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-white/10 font-mono">SPACE</kbd>
              <span>Lock Aim</span>
           </div>
           <div className="flex items-center gap-2">
              <kbd className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-white/10 font-mono">R</kbd>
              <span>Reset Position</span>
           </div>
           <div className="flex items-center gap-2">
              <kbd className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-white/10 font-mono">ESC</kbd>
              <span>Pause</span>
           </div>

           <div className="ml-auto flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                 <span>Server Status: Online</span>
              </div>
              <div className="opacity-50">#SESH-{Math.floor(Math.random() * 900) + 100}</div>
           </div>
        </div>
      )}

      {/* Overlays */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="eight-ball-pool-menu fixed inset-0 z-50 bg-neutral-900/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="eight-ball-shark-fin eight-ball-shark-fin--left" />
            <div className="eight-ball-shark-fin eight-ball-shark-fin--right" />
            <div className="eight-ball-shark-teeth" />
            <div className="max-w-md w-full">
              {menuStage === 'main' ? (
                <>
                  <div className="text-center mb-12">
                    <div className="eight-ball-shark-badge mx-auto mb-5">
                      <span>SHARK TABLE</span>
                    </div>
                    <motion.h1 
                      initial={{ y: 20 }}
                      animate={{ y: 0 }}
                      className="eight-ball-pool-title text-7xl font-black italic tracking-tighter mb-2 bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent"
                    >
                      8 BALL <span className="text-cyan-300">POOL</span>
                    </motion.h1>
                    <div className="flex flex-col items-center gap-2">
                       <p className="text-slate-400 font-black tracking-[0.2em] uppercase text-[10px]">Shark-themed billiards matches</p>
                       <div className="h-px w-24 bg-cyan-300/40" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <MenuButton 
                      icon={<Users />} 
                      label="Local 2 Player" 
                      onClick={() => startGame('local')}
                    />
                    <MenuButton 
                      icon={<Cpu />} 
                      label="Play vs Bot" 
                      onClick={() => setMenuStage('difficulty')}
                    />
                    <MenuButton 
                      icon={<Play />} 
                      label={matchmaking ? "Searching..." : "Play Online"} 
                      onClick={handleOnlineMatch}
                      highlight
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <MenuButton icon={<SettingsIcon />} label="Settings" onClick={() => setSettingsOpen(true)} secondary />
                      <MenuButton icon={<RotateCcw />} label="Restart" onClick={() => {
                        setMenuStage('main');
                        startGame(mode || 'local');
                      }} secondary disabled={!mode} />
                    </div>
                  </div>

                  {gameState && (
                    <button 
                      onClick={() => setMenuOpen(false)}
                      className="mt-8 w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all border border-white/10"
                    >
                       Resume Current Match
                    </button>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-10">
                    <h2 className="text-4xl font-black italic tracking-tighter mb-2">CHOOSE <span className="text-amber-400">LEVEL</span></h2>
                    <p className="text-slate-400 font-bold uppercase tracking-[.2em] text-[10px] opacity-60">Select bot intelligence level</p>
                  </div>

                  <div className="space-y-3">
                    <MenuButton 
                      icon={<div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />} 
                      label="Amateur (Easy)" 
                      onClick={() => {
                        setMenuStage('main');
                        startGame('bot', 'easy');
                      }}
                    />
                    <MenuButton 
                      icon={<div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />} 
                      label="Professional (Medium)" 
                      onClick={() => {
                        setMenuStage('main');
                        startGame('bot', 'medium');
                      }}
                    />
                    <MenuButton 
                      icon={<div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />} 
                      label="Grandmaster (Hard)" 
                      onClick={() => {
                        setMenuStage('main');
                        startGame('bot', 'hard');
                      }}
                    />
                    
                    <button 
                      onClick={() => setMenuStage('main')}
                      className="w-full py-4 mt-6 text-slate-500 font-black uppercase tracking-[.2em] text-[10px] hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <X size={12} />
                      <span>Cancel & Back</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {gameState?.status === 'finished' && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center backdrop-blur-xl"
           >
              <div className="bg-slate-900 p-16 rounded-[40px] border border-white/5 text-center shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] max-w-xl w-full">
                 <div className="w-24 h-24 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-8">
                    <Trophy size={48} className="text-amber-400" />
                 </div>
                 <h2 className="text-6xl font-black italic mb-4 tracking-tighter uppercase leading-none">
                    {gameState.winner}<br/><span className="text-amber-400">VICTORIOUS</span>
                 </h2>
                 <p className="text-slate-400 mb-12 font-bold uppercase tracking-widest text-xs opacity-60">
                    {gameState.foulReason || 'Perfect Game - Legal Clearance'}
                 </p>
                 <div className="flex gap-4">
                    <button onClick={() => startGame(mode || 'local')} className="flex-1 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 transition-colors shadow-lg shadow-white/10">Play Again</button>
                    <button onClick={() => setMenuOpen(true)} className="flex-1 py-5 bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-700 transition-colors border border-white/5">Main Menu</button>
                 </div>
              </div>
           </motion.div>
        )}

        {settingsOpen && (
           <motion.div className="fixed inset-0 z-[70] bg-slate-950/90 flex items-center justify-center backdrop-blur-xl">
              <div className="bg-slate-900 w-full max-w-sm p-10 rounded-[32px] border border-white/5 shadow-2xl">
                 <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-black italic tracking-tighter">SETTINGS</h2>
                    <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
                 </div>
                 {/* Settings content */}
                 <div className="space-y-8">
                    <div>
                       <label className="text-[10px] uppercase font-black tracking-widest text-white/30 block mb-4">Volume Control</label>
                       <input type="range" className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="space-y-3">
                       <button className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest text-white/60">Mute All Sounds</button>
                       <button className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest text-white/60">High Performance Mode</button>
                    </div>
                    
                    <button 
                       onClick={() => setSettingsOpen(false)}
                       className="w-full py-4 bg-amber-400 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-amber-400/20"
                    >
                       Save & Close
                    </button>
                 </div>
              </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({ icon, label, onClick, highlight, secondary, disabled }: any) {
  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-5 p-6 rounded-[24px] font-black transition-all border group disabled:opacity-30 relative overflow-hidden",
        highlight ? "bg-amber-400 text-black border-amber-400 shadow-xl shadow-amber-400/20 hover:scale-[1.02] active:scale-[0.98]" : 
        secondary ? "bg-slate-800 text-white border-white/5 hover:bg-slate-700/50" :
        "bg-white/5 text-white border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-[0.98]"
      )}
    >
      <div className={clsx("transition-all duration-500 group-hover:rotate-12 group-hover:scale-110", highlight ? "text-black" : "text-amber-400/50 group-hover:text-amber-400")}>
        {React.cloneElement(icon, { size: 22 })}
      </div>
      <span className="flex-1 text-left tracking-tighter uppercase text-xs">{label}</span>
      
      {highlight && (
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
           <Play size={40} fill="currentColor" />
        </div>
      )}
    </button>
  );
}
