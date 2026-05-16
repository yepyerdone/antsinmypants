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
  1: '#ffd21f',
  2: '#1f66ff',
  3: '#ff3434',
  4: '#9b4dff',
  5: '#ff8f1f',
  6: '#12b45a',
  7: '#8f2a20',
  8: '#000000',
  9: '#ffd21f',
  10: '#1f66ff',
  11: '#ff3434',
  12: '#9b4dff',
  13: '#ff8f1f',
  14: '#12b45a',
  15: '#8f2a20',
};

type OnlineReplayShot = {
  startBalls: Ball[];
  finalBalls: Ball[];
  frames?: Array<{ balls: Ball[] }>;
  angle: number;
  power: number;
  spin: { x: number; y: number };
};

type OnlineTurnReplay = {
  id: string;
  playerUid: string;
  shots: OnlineReplayShot[];
  createdAt: number;
  shotNumber?: number;
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

function ScoreCard({ player, balls, isTurn, turnStartTime, mode, timerActive = true }: { player: GamePlayer; balls: Ball[]; isTurn: boolean; turnStartTime?: number; mode?: GameMode; timerActive?: boolean }) {
   const groupType = player.group === 'solids' ? 'solid' : 'stripe';
   const playerBalls = balls.filter(b => b.type === groupType);
   const eightBall = balls.find(b => b.type === 'black')!;
   const remainingGroup = playerBalls.filter(b => !b.isPocketed).length;
   
   const [timeLeft, setTimeLeft] = useState(30);

   useEffect(() => {
      if (!isTurn || mode !== 'online' || !turnStartTime || !timerActive) {
         setTimeLeft(30);
         return;
      }

      const updateTimeLeft = () => {
         const elapsed = Math.floor((Date.now() - turnStartTime) / 1000);
         setTimeLeft(Math.max(0, 30 - elapsed));
      };
      
      updateTimeLeft();
      const interval = setInterval(() => {
         updateTimeLeft();
      }, 500);

      return () => clearInterval(interval);
   }, [isTurn, turnStartTime, mode, timerActive]);

   return (
      <div className={clsx(
         "flex flex-col gap-2 transition-all p-3 rounded-2xl border-2 relative overflow-hidden",
         isTurn ? "border-amber-400 bg-slate-800/80 shadow-[0_0_30px_rgba(251,191,36,0.15)]" : "border-transparent opacity-60 bg-transparent"
      )}>
         {/* Timer Animation Bar */}
         {isTurn && mode === 'online' && timerActive && (
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
               {isTurn && mode === 'online' && timerActive && (
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
  const [onlinePhase, setOnlinePhase] = useState<'playing' | 'waiting' | 'replaying'>('playing');
  const [onlineTurnUid, setOnlineTurnUid] = useState<string | null>(null);
  const onlineMatchIdRef = useRef<string | null>(null);

  // Simulation State (for loop performance)
  const gameStateRef = useRef<GameState | null>(null);
  const [displayState, setDisplayState] = useState<GameState | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [isAiming, setIsAiming] = useState(false);
  const isAimingRef = useRef(false);
  const [isAimLocked, setIsAimLocked] = useState(false);
  const [shotAngle, setShotAngle] = useState(0);
  const shotAngleRef = useRef(0);
  const [isPrecisionMode, setIsPrecisionMode] = useState(false);
  const [cueSpin, setCueSpin] = useState({ x: 0, y: 0 }); // -1 to 1 for each axis
  const cueSpinRef = useRef({ x: 0, y: 0 });
  const [isStriking, setIsStriking] = useState(false);
  const isStrikingRef = useRef(false);
  const [strikeProgress, setStrikeProgress] = useState(0); // 0 to 1
  const strikeProgressRef = useRef(0);
  const [shotPower, setShotPower] = useState(0);
  const shotPowerRef = useRef(0);
  const [isInteractingMeter, setIsInteractingMeter] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const strikeParamsRef = useRef<{ angle: number; power: number } | null>(null);
  const handledTimeoutRef = useRef<number | null>(null);
  const matchmakingCleanupRef = useRef<(() => void) | null>(null);
  const matchUnsubscribeRef = useRef<(() => void) | null>(null);
  const replayedTurnIdsRef = useRef<Set<string>>(new Set());
  const isReplayingRef = useRef(false);
  const currentTurnShotsRef = useRef<OnlineReplayShot[]>([]);
  const pendingShotRef = useRef<OnlineReplayShot | null>(null);
  const lastReplayFrameAtRef = useRef(0);
  const onlineTurnUidRef = useRef<string | null>(null);
  const onlineShotNumberRef = useRef(0);
  const pendingReplayAckIdRef = useRef<string | null>(null);
  const websitePlayerName = displayName || auth.currentUser?.displayName || 'Player';

  useEffect(() => {
    onlineMatchIdRef.current = onlineMatchId;
  }, [onlineMatchId]);

  const updateOnlineTurnUid = useCallback((uid: string | null) => {
    onlineTurnUidRef.current = uid;
    setOnlineTurnUid(uid);
  }, []);

  const isMyOnlineTurn = useCallback((state: GameState | null) => {
    const turnUid = onlineTurnUidRef.current || state?.players[state.turnIndex]?.uid;
    return !!state && state.mode === 'online' && turnUid === auth.currentUser?.uid;
  }, []);

  const canControlOnlineTurn = useCallback((state: GameState | null) => {
    if (!state) return false;
    if (state.mode !== 'online') return true;
    if (isReplayingRef.current || pendingReplayAckIdRef.current) return false;
    const turnUid = onlineTurnUidRef.current || state.players[state.turnIndex]?.uid;
    return onlinePhase === 'playing' && turnUid === auth.currentUser?.uid && state.players[state.turnIndex]?.uid === turnUid;
  }, [onlinePhase]);

  const cloneBalls = useCallback((balls: Ball[]) => balls.map(ball => {
    const cloned: Ball = { ...ball };
    if (ball.pocketedIn) {
      cloned.pocketedIn = { ...ball.pocketedIn };
    } else if (ball.pocketedIn === null) {
      cloned.pocketedIn = null;
    } else {
      delete cloned.pocketedIn;
    }
    return cloned;
  }), []);

  const mergeOnlineBalls = useCallback((remoteBalls: Ball[] | undefined, prevBalls: Ball[] | undefined) => {
    if (!remoteBalls?.length) return prevBalls ? cloneBalls(prevBalls) : Engine.createBalls();
    const previousById = new Map((prevBalls || []).map(ball => [ball.id, ball]));

    return remoteBalls.map(remoteBall => {
      const previousBall = previousById.get(remoteBall.id);
      const clonedRemote = cloneBalls([remoteBall])[0];
      if (previousBall && previousBall.type !== 'cue' && previousBall.isPocketed && !remoteBall.isPocketed) {
        return cloneBalls([previousBall])[0];
      }
      return clonedRemote;
    });
  }, [cloneBalls]);

  const buildOnlineStateFromData = useCallback((data: any, prev: GameState | null): GameState => {
    const whitePlayer: GamePlayer = { uid: data.players?.white?.uid || '', name: data.players?.white?.name || 'Player 1', group: data.players?.white?.group ?? null, violations: data.players?.white?.violations || 0 };
    const blackPlayer: GamePlayer = { uid: data.players?.black?.uid || '', name: data.players?.black?.name || 'Player 2', group: data.players?.black?.group ?? null, violations: data.players?.black?.violations || 0 };

    return {
      ...(prev || {}),
      mode: 'online',
      players: [whitePlayer, blackPlayer],
      turnIndex: data.turn === blackPlayer.uid ? 1 : 0,
      balls: mergeOnlineBalls(data.balls, prev?.balls),
      firstBallHit: data.firstBallHit || null,
      ballsPocketedThisTurn: data.ballsPocketedThisTurn || [],
      isMoving: data.isMoving || false,
      isFoul: data.isFoul || false,
      foulReason: data.foulReason || null,
      isBallInHand: data.isBallInHand ?? prev?.isBallInHand ?? true,
      nominatedPocket: data.nominatedPocket || null,
      turnStartTime: data.turnStartTime || prev?.turnStartTime || Date.now(),
      winner: data.winner || null,
      status: data.status === 'finished' ? 'finished' : 'playing',
    };
  }, [mergeOnlineBalls]);

  const playOnlineReplay = useCallback(async (replay: OnlineTurnReplay, finalState: GameState) => {
    const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
    isReplayingRef.current = true;
    setOnlinePhase('replaying');
    setIsAiming(false);
    setIsStriking(false);
    setShotPower(0);
    setStrikeProgress(0);
    await sleep(100);

    for (const shot of replay.shots) {
      const replayFrames = Array.isArray(shot.frames) && shot.frames.length > 1 ? shot.frames : null;
      const replayState: GameState = {
        ...finalState,
        balls: cloneBalls(replayFrames?.[0]?.balls || shot.startBalls),
        isMoving: true,
        winner: null,
        status: 'playing',
        nominatedPocket: null,
        turnStartTime: undefined,
      };
      gameStateRef.current = replayState;
      setGameState(replayState);
      setDisplayState(replayState);

      await sleep(250);

      if (replayFrames) {
        for (const frame of replayFrames.slice(1)) {
          const nextReplayState = { ...replayState, balls: cloneBalls(frame.balls) };
          gameStateRef.current = nextReplayState;
          setGameState(nextReplayState);
          setDisplayState(nextReplayState);
          await sleep(50);
        }
      } else {
        await new Promise<void>((resolve) => {
          const start = performance.now();
          const duration = 2200;
          const animate = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const balls = shot.startBalls.map((startBall) => {
              const finalBall = shot.finalBalls.find(ball => ball.id === startBall.id) || startBall;
              return {
                ...startBall,
                x: startBall.x + (finalBall.x - startBall.x) * eased,
                y: startBall.y + (finalBall.y - startBall.y) * eased,
                vx: 0,
                vy: 0,
                rotation: (startBall.rotation || 0) + ((finalBall.rotation || 0) - (startBall.rotation || 0)) * eased,
                isPocketed: progress > 0.96 ? finalBall.isPocketed : startBall.isPocketed,
                pocketedIn: finalBall.pocketedIn ? { ...finalBall.pocketedIn } : finalBall.pocketedIn,
              };
            });
            const nextReplayState = { ...replayState, balls };
            gameStateRef.current = nextReplayState;
            setGameState(nextReplayState);
            setDisplayState(nextReplayState);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(animate);
        });
      }

      const settledReplayState = { ...replayState, balls: cloneBalls(shot.finalBalls), isMoving: false };
      gameStateRef.current = settledReplayState;
      setGameState(settledReplayState);
      setDisplayState(settledReplayState);
      await sleep(450);
    }

    const lastReplayShot = replay.shots[replay.shots.length - 1];
    const finalReplayBalls = lastReplayShot?.finalBalls?.length ? cloneBalls(lastReplayShot.finalBalls) : cloneBalls(finalState.balls);
    const replayCompletedAt = Date.now();
    const nextTurnUid = finalState.players[finalState.turnIndex]?.uid || null;
    updateOnlineTurnUid(nextTurnUid);
    const isNextTurnMine = nextTurnUid === auth.currentUser?.uid;
    const nextState = {
      ...finalState,
      balls: finalReplayBalls,
      isMoving: false,
      isBallInHand: finalState.isFoul ? finalState.isBallInHand : false,
      nominatedPocket: null,
      turnStartTime: finalState.status !== 'finished' ? replayCompletedAt : finalState.turnStartTime,
    };
    gameStateRef.current = nextState;
    setGameState(nextState);
    setDisplayState(nextState);
    isReplayingRef.current = false;
    setOnlinePhase(isNextTurnMine ? 'playing' : 'waiting');
    if (onlineMatchId && nextState.status !== 'finished') {
      MultiplayerManager.syncGameState(onlineMatchId, {
        turnStartTime: replayCompletedAt,
        replayAck: {
          uid: auth.currentUser?.uid || null,
          replayId: replay.id,
          at: Date.now(),
        },
      } as any).catch(() => undefined);
    }
  }, [cloneBalls, onlineMatchId, updateOnlineTurnUid]);

  useEffect(() => {
    isAimingRef.current = isAiming;
    shotAngleRef.current = shotAngle;
    shotPowerRef.current = shotPower;
    isStrikingRef.current = isStriking;
    strikeProgressRef.current = strikeProgress;
    cueSpinRef.current = cueSpin;
  }, [cueSpin, isAiming, isStriking, shotAngle, shotPower, strikeProgress]);

  // Initialize game
  const startGame = useCallback((selectedMode: GameMode, diff?: BotDifficulty, p1?: string, p2?: string) => {
    if (selectedMode === 'online') {
      return;
    }
    matchmakingCleanupRef.current?.();
    matchmakingCleanupRef.current = null;
    matchUnsubscribeRef.current?.();
    matchUnsubscribeRef.current = null;
    setMatchmaking(false);

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
    setOnlinePhase('playing');
    updateOnlineTurnUid(null);
    onlineShotNumberRef.current = 0;
    pendingReplayAckIdRef.current = null;
    currentTurnShotsRef.current = [];
    pendingShotRef.current = null;
  }, [updateOnlineTurnUid, websitePlayerName]);

  const handleOnlineMatch = async () => {
    if (matchmaking) return;

    try {
      matchmakingCleanupRef.current?.();
      matchmakingCleanupRef.current = null;

      let user = auth.currentUser;
      if (!user) {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        user = result.user;
      }

      setMatchmaking(true);
      const cleanup = await MultiplayerManager.startMatchmaking(
        { uid: user.uid, name: websitePlayerName, group: null },
        (matchId, role) => {
          matchmakingCleanupRef.current?.();
          matchmakingCleanupRef.current = null;
          matchUnsubscribeRef.current?.();
          matchUnsubscribeRef.current = null;
          setOnlineMatchId(matchId);
          setMyRole(role);
          setMatchmaking(true);
          setMenuOpen(true);
          setMode('online');
          setOnlinePhase('waiting');
          MultiplayerManager.markPlayerConnected(matchId, role).catch(() => undefined);
          
          matchUnsubscribeRef.current = MultiplayerManager.listenToMatch(matchId, (data) => {
            updateOnlineTurnUid(typeof data.turn === 'string' ? data.turn : null);
            const bothPlayersConnected = !!data.connectionReady?.white && !!data.connectionReady?.black;
            if (bothPlayersConnected) {
              setMatchmaking(false);
              setMenuOpen(false);
            }

            if (!data.balls || isReplayingRef.current) return;
            const localState = gameStateRef.current;
            if (localState?.isMoving && isMyOnlineTurn(localState)) return;
            if (data.isMoving && data.turn !== auth.currentUser?.uid) {
              setOnlinePhase('waiting');
              return;
            }

            const incomingShotNumber = typeof data.shotNumber === 'number' ? data.shotNumber : onlineShotNumberRef.current;
            if (
              pendingReplayAckIdRef.current
              && data.replayAck?.replayId === pendingReplayAckIdRef.current
              && data.turn === auth.currentUser?.uid
            ) {
              pendingReplayAckIdRef.current = null;
              setOnlinePhase('playing');
            }
            if (incomingShotNumber < onlineShotNumberRef.current) return;

            const nextState = buildOnlineStateFromData(data, localState);
            onlineShotNumberRef.current = Math.max(onlineShotNumberRef.current, incomingShotNumber);
            const replay = data.turnReplay as OnlineTurnReplay | undefined;
            const replayShots = Array.isArray(replay?.shots) ? replay.shots : [];
            const shouldPlayReplay = replay?.id
              && replay.playerUid !== auth.currentUser?.uid
              && replayShots.length > 0
              && !replayedTurnIdsRef.current.has(replay.id);

            if (shouldPlayReplay) {
              replayedTurnIdsRef.current.add(replay.id);
              void playOnlineReplay(replay, nextState);
              return;
            }

            gameStateRef.current = nextState;
            setGameState(nextState);
            setDisplayState(nextState);
            if (pendingReplayAckIdRef.current && replay?.id === pendingReplayAckIdRef.current && replay.playerUid === auth.currentUser?.uid) {
              setOnlinePhase('waiting');
              return;
            }
            setOnlinePhase(nextState.players[nextState.turnIndex]?.uid === auth.currentUser?.uid ? 'playing' : 'waiting');
          });
        }
      );
      matchmakingCleanupRef.current = cleanup;
    } catch (err) {
      toast.error('Failed to join matchmaking');
      setMatchmaking(false);
    }
  };

  useEffect(() => {
    return () => {
      matchmakingCleanupRef.current?.();
      matchUnsubscribeRef.current?.();
    };
  }, []);

  const forfeitOnlineMatch = useCallback((updateLocalState = false) => {
    const state = gameStateRef.current;
    const matchId = onlineMatchIdRef.current;
    if (!state || state.mode !== 'online' || state.status === 'finished' || !matchId || !auth.currentUser?.uid) {
      return false;
    }

    const winner = state.players.find((player) => player.uid !== auth.currentUser?.uid)?.uid || null;
    const nextState: GameState = {
      ...state,
      winner,
      status: 'finished',
      isMoving: false,
      foulReason: 'Your opponent has left',
    };

    if (updateLocalState) {
      gameStateRef.current = nextState;
      setGameState(nextState);
      setDisplayState(nextState);
      setIsAiming(false);
      setIsStriking(false);
      setShotPower(0);
      setOnlinePhase('waiting');
      setMenuOpen(false);
    }

    void MultiplayerManager.syncGameState(matchId, {
      balls: nextState.balls,
      isMoving: false,
      status: 'finished',
      winner,
      foulReason: nextState.foulReason,
      turnReplay: null,
      liveShot: null,
    } as any);

    return true;
  }, []);

  useEffect(() => {
    const handlePageExit = () => {
      forfeitOnlineMatch(false);
    };

    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    return () => {
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      handlePageExit();
    };
  }, [forfeitOnlineMatch]);

  const handleQuitGame = () => {
    matchmakingCleanupRef.current?.();
    matchmakingCleanupRef.current = null;
    setMatchmaking(false);

    const state = gameStateRef.current;
    if (!state) {
      setMenuOpen(true);
      return;
    }

    if (forfeitOnlineMatch(true)) {
      return;
    }

    matchUnsubscribeRef.current?.();
    matchUnsubscribeRef.current = null;
    gameStateRef.current = null;
    setGameState(null);
    setDisplayState(null);
    setOnlineMatchId(null);
    setMyRole(null);
    setMode(null);
    setMenuStage('main');
    setOnlinePhase('playing');
    updateOnlineTurnUid(null);
    onlineShotNumberRef.current = 0;
    pendingReplayAckIdRef.current = null;
    currentTurnShotsRef.current = [];
    pendingShotRef.current = null;
    setMenuOpen(true);
  };

  const returnToMainMenu = () => {
    forfeitOnlineMatch(false);
    matchmakingCleanupRef.current?.();
    matchmakingCleanupRef.current = null;
    matchUnsubscribeRef.current?.();
    matchUnsubscribeRef.current = null;
    gameStateRef.current = null;
    setGameState(null);
    setDisplayState(null);
    setMatchmaking(false);
    setOnlineMatchId(null);
    setMyRole(null);
    setMode(null);
    setMenuStage('main');
    setOnlinePhase('playing');
    updateOnlineTurnUid(null);
    onlineShotNumberRef.current = 0;
    pendingReplayAckIdRef.current = null;
    currentTurnShotsRef.current = [];
    pendingShotRef.current = null;
    setIsAiming(false);
    setIsStriking(false);
    setShotPower(0);
    setMenuOpen(true);
  };

  // Game Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    
    let rafId: number;
    const ctx = canvasRef.current.getContext('2d')!;

    const loop = () => {
      const state = gameStateRef.current;
      if (!state || state.status === 'finished') {
        if (state) render(ctx, state, mousePosRef.current, isAimingRef.current, shotAngleRef.current, shotPowerRef.current, isStrikingRef.current, strikeProgressRef.current);
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (isReplayingRef.current) {
        render(ctx, state, mousePosRef.current, false, shotAngleRef.current, 0, false, 0);
        rafId = requestAnimationFrame(loop);
        return;
      }

      // Handle Strike Animation
      if (isStrikingRef.current) {
        setStrikeProgress(prev => {
          const next = prev + 0.15; // Animation speed
          if (next >= 1) {
            // Impact!
            if (strikeParamsRef.current) {
              const { angle, power } = strikeParamsRef.current;
              applyShotVelocities(angle, power);
              strikeParamsRef.current = null;
            }
            isStrikingRef.current = false;
            strikeProgressRef.current = 0;
            setIsStriking(false);
            return 0;
          }
          strikeProgressRef.current = next;
          return next;
        });
      }

      if (state.isMoving && onlineMatchId && !isMyOnlineTurn(state) && !isReplayingRef.current) {
        render(ctx, state, mousePosRef.current, isAimingRef.current, shotAngleRef.current, shotPowerRef.current, isStrikingRef.current, strikeProgressRef.current);
        rafId = requestAnimationFrame(loop);
        return;
      }

      // 1. Physics Update
      if (state.isMoving) {
        const shouldPublishOnlineTurn = !!onlineMatchId && isMyOnlineTurn(state);
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

        if (pendingShotRef.current && shouldPublishOnlineTurn) {
          const now = performance.now();
          const frames = pendingShotRef.current.frames || [];
          if ((now - lastReplayFrameAtRef.current >= 150 && frames.length < 24) || !stillMoving) {
            pendingShotRef.current.frames = [
              ...frames,
              { balls: cloneBalls(nextBalls) },
            ];
            lastReplayFrameAtRef.current = now;
          }
        }

        if (!stillMoving) {
          // Turn ended
          const shooterUid = state.players[state.turnIndex].uid;
          const updatedState = Engine.checkRules({ ...state, balls: nextBalls, isMoving: false });
          const pendingShot = pendingShotRef.current;
          if (pendingShot && shouldPublishOnlineTurn) {
            currentTurnShotsRef.current = [
              ...currentTurnShotsRef.current,
              {
                ...pendingShot,
                finalBalls: cloneBalls(nextBalls),
                frames: [
                  ...(pendingShot.frames || []),
                  { balls: cloneBalls(nextBalls) },
                ],
              },
            ];
            pendingShotRef.current = null;
          }
          
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
          
          const shooterKeepsTurn = updatedState.players[updatedState.turnIndex].uid === shooterUid && !updatedState.winner;
          if (onlineMatchId && myRole && shouldPublishOnlineTurn) {
             const nextTurnUid = updatedState.players[updatedState.turnIndex].uid;
             updateOnlineTurnUid(nextTurnUid);
             const nextShotNumber = onlineShotNumberRef.current + 1;
             const replayShots = currentTurnShotsRef.current.map((shot) => {
                const nextShot: OnlineReplayShot = {
                  ...shot,
                  startBalls: cloneBalls(shot.startBalls),
                  finalBalls: cloneBalls(shot.finalBalls),
                };
                if (shot.frames?.length) {
                  nextShot.frames = shot.frames.map(frame => ({ balls: cloneBalls(frame.balls) }));
                }
                return nextShot;
             });
             const turnReplay: OnlineTurnReplay = {
                id: `${onlineMatchId}_${nextShotNumber}_${shooterUid}`,
                playerUid: shooterUid,
                shots: replayShots,
                createdAt: Date.now(),
                shotNumber: nextShotNumber,
             };
             currentTurnShotsRef.current = [];
             pendingShotRef.current = null;
             lastReplayFrameAtRef.current = 0;
             onlineShotNumberRef.current = nextShotNumber;
             pendingReplayAckIdRef.current = shooterKeepsTurn ? turnReplay.id : null;
             // Sync state to firebase
             MultiplayerManager.syncGameState(onlineMatchId, {
                balls: cloneBalls(updatedState.balls),
                isMoving: false,
                isFoul: updatedState.isFoul,
                foulReason: updatedState.foulReason,
                isBallInHand: updatedState.isFoul ? updatedState.isBallInHand : false,
                firstBallHit: updatedState.firstBallHit,
                ballsPocketedThisTurn: updatedState.ballsPocketedThisTurn,
                nominatedPocket: shooterKeepsTurn ? updatedState.nominatedPocket : null,
                status: updatedState.status,
                winner: updatedState.winner,
                turn: nextTurnUid,
                turnStartTime: updatedState.turnStartTime,
                turnReplay: replayShots.length > 0 ? turnReplay : null,
                shotNumber: nextShotNumber,
                updatedAtMs: Date.now(),
                liveShot: null,
                players: {
                  white: updatedState.players[0],
                  black: updatedState.players[1]
                }
             } as any)
                .then(() => {
                  setOnlinePhase('waiting');
                  if (shooterKeepsTurn) {
                    const longestReplayMs = replayShots.reduce((longest, shot) => {
                      const frameCount = Math.max(shot.frames?.length || 0, 2);
                      return Math.max(longest, 250 + (frameCount - 1) * 50 + 450);
                    }, 1400);
                    window.setTimeout(() => {
                      const currentState = gameStateRef.current;
                      if (
                        pendingReplayAckIdRef.current !== turnReplay.id
                        || !currentState
                        || currentState.status === 'finished'
                        || currentState.players[currentState.turnIndex]?.uid !== shooterUid
                      ) {
                        return;
                      }

                      const resumedAt = Date.now();
                      pendingReplayAckIdRef.current = null;
                      updateOnlineTurnUid(shooterUid);
                      const resumedState = { ...currentState, turnStartTime: resumedAt, isMoving: false };
                      gameStateRef.current = resumedState;
                      setGameState(resumedState);
                      setDisplayState(resumedState);
                      setOnlinePhase('playing');
                      MultiplayerManager.syncGameState(onlineMatchId, {
                        turnStartTime: resumedAt,
                        replayAck: {
                          uid: auth.currentUser?.uid || null,
                          replayId: turnReplay.id,
                          at: resumedAt,
                          source: 'fallback',
                        },
                      } as any).catch(() => undefined);
                    }, longestReplayMs + 350);
                  }
                })
                .catch(() => {
                  toast.error('Failed to send turn replay. Try the shot again.');
                  gameStateRef.current = state;
                  setGameState({ ...state, isMoving: false });
                  setDisplayState({ ...state, isMoving: false });
                  updateOnlineTurnUid(shooterUid);
                  pendingReplayAckIdRef.current = null;
                  setOnlinePhase('playing');
                });
          }
        } else {
          state.balls = nextBalls;
        }
      }

      // 2. Rendering
      render(ctx, state, mousePosRef.current, isAimingRef.current, shotAngleRef.current, shotPowerRef.current, isStrikingRef.current, strikeProgressRef.current);

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [cloneBalls, isMyOnlineTurn, onlineMatchId, myRole, updateOnlineTurnUid]);

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
      const activeState = gameStateRef.current;
      const canControl = canControlOnlineTurn(activeState);
      
      // Precision Aiming with Arrow Keys
      if (canControl && isAiming && !gameState?.isMoving && !gameState?.winner) {
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
        if (!canControl) return;
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
  }, [canControlOnlineTurn, gameState, isAiming]);

  // Turn Timer Effect (Multiplayer only)
  useEffect(() => {
    if (gameState?.mode !== 'online' || gameState.status === 'finished' || gameState.isMoving || !canControlOnlineTurn(gameState)) return;

    const timer = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || state.isMoving || state.status === 'finished' || state.mode !== 'online') return;
      if (!canControlOnlineTurn(state)) return;

      if (state.turnStartTime) {
        const elapsed = Date.now() - state.turnStartTime;
        if (elapsed >= 30000 && handledTimeoutRef.current !== state.turnStartTime) {
          handledTimeoutRef.current = state.turnStartTime;

          // Time out!
          const updatedState = Engine.forfeitTurn(state);
          const nextTurnUid = updatedState.players[updatedState.turnIndex].uid;
          updateOnlineTurnUid(nextTurnUid);
          gameStateRef.current = updatedState;
          setGameState(updatedState);
          setDisplayState(updatedState);
          
          if (onlineMatchId) {
            MultiplayerManager.syncGameState(onlineMatchId, {
              balls: updatedState.balls,
              status: updatedState.status,
              winner: updatedState.winner,
              turn: nextTurnUid,
              turnStartTime: updatedState.turnStartTime,
              isFoul: updatedState.isFoul,
              foulReason: updatedState.foulReason,
              isBallInHand: updatedState.isBallInHand,
              firstBallHit: updatedState.firstBallHit,
              ballsPocketedThisTurn: updatedState.ballsPocketedThisTurn,
              nominatedPocket: updatedState.nominatedPocket,
              isMoving: false,
              turnReplay: null,
              liveShot: null,
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
  }, [canControlOnlineTurn, gameState, onlineMatchId, updateOnlineTurnUid]);

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
    if (!state || state.isMoving || state.winner || isStrikingRef.current) return;
    if (!canControlOnlineTurn(state)) return;
    
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
    shotAngleRef.current = angle;
    shotPowerRef.current = power;
    isStrikingRef.current = true;
    strikeProgressRef.current = 0;
    setIsStriking(true);
    setStrikeProgress(0);
  };

  const applyShotVelocities = (angle: number, power: number) => {
    const state = gameStateRef.current;
    if (!state) return;

    audioManager.playCueHit(power);
    const cueBall = state.balls.find(b => b.type === 'cue')!;
    if (onlineMatchId && isMyOnlineTurn(state)) {
      const startBalls = cloneBalls(state.balls);
      pendingShotRef.current = {
        startBalls,
        finalBalls: [],
        frames: [{ balls: startBalls }],
        angle,
        power,
        spin: { ...cueSpinRef.current },
      };
      lastReplayFrameAtRef.current = performance.now();
    }
    
    // Basic velocity
    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;

    // Apply spin based on cue hit point
    // cueSpin.y is top/back spin (Vertical)
    // cueSpin.x is side English (Horizontal)
    const spinStrength = power * 1.5;
    const currentCueSpin = cueSpinRef.current;
    
    // Follow/Draw (along shots direction)
    const spinV = currentCueSpin.y * spinStrength;
    // Side English (perpendicular to shots direction)
    const spinH = currentCueSpin.x * spinStrength;

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
    cueSpinRef.current = { x: 0, y: 0 };
    setCueSpin({ x: 0, y: 0 });
  };

  const BORDER_OFFSET = 24;

  const handleMouseDown = (e: React.MouseEvent) => {
    const state = gameStateRef.current;
    if (!state || state.isMoving || state.winner || state.status === 'finished') return;
    
    // Check if it's our turn online
    if (!canControlOnlineTurn(state)) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - BORDER_OFFSET;
    const y = e.clientY - rect.top - BORDER_OFFSET;

    // Pocket Nomination Logic
    const currentPlayer = state.players[state.turnIndex];
    const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
    const hasRemainingBalls = state.balls.some(b => b.type === targetType && !b.isPocketed);
    const isOnEightBall = !!currentPlayer.group && !hasRemainingBalls;

    if (isOnEightBall && !state.isMoving && canControlOnlineTurn(state)) {
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
            setDisplayState(next);
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
      if (!canControlOnlineTurn(state)) return;
      
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
      const state = gameStateRef.current;
      if (!canControlOnlineTurn(state)) return;
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
  }, [canControlOnlineTurn, isAiming, isAimLocked, displayState?.isMoving, displayState?.winner, onlineMatchId]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || isAimLocked) return;
    const state = gameStateRef.current;
    if (!canControlOnlineTurn(state)) return;
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

    const drawFeltPath = () => {
      ctx.beginPath();
      ctx.moveTo(cw + pr, cw);
      ctx.lineTo(w / 2 - pr, cw);
      ctx.quadraticCurveTo(w / 2, cw + 12, w / 2 + pr, cw);
      ctx.lineTo(w - cw - pr, cw);
      ctx.quadraticCurveTo(w - cw - 12, cw + 12, w - cw, cw + pr);
      ctx.lineTo(w - cw, h - cw - pr);
      ctx.quadraticCurveTo(w - cw - 12, h - cw - 12, w - cw - pr, h - cw);
      ctx.lineTo(w / 2 + pr, h - cw);
      ctx.quadraticCurveTo(w / 2, h - cw - 12, w / 2 - pr, h - cw);
      ctx.lineTo(cw + pr, h - cw);
      ctx.quadraticCurveTo(cw + 12, h - cw - 12, cw, h - cw - pr);
      ctx.lineTo(cw, cw + pr);
      ctx.quadraticCurveTo(cw + 12, cw + 10, cw + pr, cw);
      ctx.closePath();
    };

    // Wood Rail Frame
    const frameGrad = ctx.createLinearGradient(0, 0, w, h);
    frameGrad.addColorStop(0, '#6b2d13');
    frameGrad.addColorStop(0.35, '#3a1709');
    frameGrad.addColorStop(0.65, '#8a431d');
    frameGrad.addColorStop(1, '#2a1007');
    ctx.fillStyle = frameGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.28;
    for (let x = -w; x < w * 2; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 24, h * 0.22, x - 20, h * 0.62, x + 38, h);
      ctx.strokeStyle = x % 84 === 0 ? 'rgba(255, 214, 156, 0.22)' : 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = x % 84 === 0 ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();

    // Pockets (Deep holes) - Drawn first so they are "under" the cushions and felt
    const currentPlayer = state.players[state.turnIndex];
    const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
    const hasRemainingBalls = state.balls.some(b => b.type === targetType && !b.isPocketed);
    const isOnEightBall = !!currentPlayer.group && !hasRemainingBalls;

    CONFIG.pockets.forEach(p => {
      const pocketGrad = ctx.createRadialGradient(p.x - pr * 0.25, p.y - pr * 0.25, pr * 0.1, p.x, p.y, pr * 1.35);
      pocketGrad.addColorStop(0, '#1f2937');
      pocketGrad.addColorStop(0.48, '#020617');
      pocketGrad.addColorStop(1, '#000000');
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr * 1.45, 0, Math.PI * 2);
      ctx.fillStyle = '#3a1608';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 205, 127, 0.22)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = pocketGrad;
      ctx.fill();

      // 8-Ball Pocket Nomination UI
      if (isOnEightBall && !state.winner && !state.isMoving && canControlOnlineTurn(state)) {
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
    const clothGrad = ctx.createLinearGradient(cw, cw, w - cw, h - cw);
    clothGrad.addColorStop(0, '#0e9f6e');
    clothGrad.addColorStop(0.45, '#047857');
    clothGrad.addColorStop(1, '#064e3b');
    drawFeltPath();
    ctx.fillStyle = clothGrad;
    ctx.fill();

    // Felt highlight/gradient overlay
    drawFeltPath();
    const feltGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 1.5);
    feltGrad.addColorStop(0, 'rgba(167, 243, 208, 0.22)');
    feltGrad.addColorStop(0.55, 'rgba(16, 185, 129, 0.06)');
    feltGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = feltGrad;
    ctx.fill();

    ctx.save();
    drawFeltPath();
    ctx.clip();
    ctx.globalAlpha = 0.16;
    for (let y = cw + 8; y < h - cw; y += 9) {
      ctx.beginPath();
      ctx.moveTo(cw + 8, y);
      ctx.lineTo(w - cw - 8, y + Math.sin(y * 0.07) * 2);
      ctx.strokeStyle = y % 18 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(1, 48, 35, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cw + 18, cw + 18, w - (cw + 18) * 2, h - (cw + 18) * 2);
    ctx.restore();

    // Cushions (Rails with angled ends for "mouths")
    const drawRail = (pts: {x: number, y: number}[]) => {
       const xs = pts.map(p => p.x);
       const ys = pts.map(p => p.y);
       const minX = Math.min(...xs);
       const maxX = Math.max(...xs);
       const minY = Math.min(...ys);
       const maxY = Math.max(...ys);
       const railGrad = ctx.createLinearGradient(minX, minY, maxX || minX + 1, maxY || minY + 1);
       railGrad.addColorStop(0, '#135f46');
       railGrad.addColorStop(0.5, '#0b7a57');
       railGrad.addColorStop(1, '#053d2d');
       ctx.beginPath();
       ctx.moveTo(pts[0].x, pts[0].y);
       pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
       ctx.closePath();
       ctx.fillStyle = railGrad;
       ctx.fill();
       ctx.fillStyle = 'rgba(255,255,255,0.03)';
       ctx.fill();
       ctx.strokeStyle = 'rgba(255,255,255,0.13)';
       ctx.lineWidth = 1;
       ctx.stroke();
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

    // Rail sights/diamonds
    ctx.save();
    ctx.fillStyle = '#f8d8a8';
    ctx.shadowColor = 'rgba(255, 213, 128, 0.45)';
    ctx.shadowBlur = 6;
    const drawDiamond = (x: number, y: number, size = 4) => {
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.fill();
    };
    [w * 0.25, w * 0.5, w * 0.75].forEach(x => {
      drawDiamond(x, 12);
      drawDiamond(x, h - 12);
    });
    [h * 0.28, h * 0.5, h * 0.72].forEach(y => {
      drawDiamond(12, y);
      drawDiamond(w - 12, y);
    });
    ctx.restore();

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
        const radius = CONFIG.ballRadius;
        const color = BALL_COLORS[ball.number] || '#fff';

        // Contact shadow
        ctx.beginPath();
        ctx.ellipse(ball.x + 2.5, ball.y + radius * 0.7, radius * 0.95, radius * 0.34, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.fill();

        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.rotation || 0);

        // Ball body with brighter billiard enamel
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(-radius * 0.42, -radius * 0.48, radius * 0.08, 0, 0, radius);
        if (ball.type === 'cue') {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.62, '#fff8e8');
          grad.addColorStop(1, '#d2c6ad');
        } else if (ball.type === 'black') {
          grad.addColorStop(0, '#5b5b5b');
          grad.addColorStop(0.22, '#171717');
          grad.addColorStop(1, '#000000');
        } else {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.16, '#fff8e8');
          grad.addColorStop(0.38, color);
          grad.addColorStop(1, '#111827');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        // Stripe styling with a curved glossy band
        if (ball.type === 'stripe') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2);
          ctx.clip();
          const stripeGrad = ctx.createLinearGradient(0, -radius * 0.5, 0, radius * 0.5);
          stripeGrad.addColorStop(0, '#ffffff');
          stripeGrad.addColorStop(0.18, color);
          stripeGrad.addColorStop(0.5, color);
          stripeGrad.addColorStop(0.82, color);
          stripeGrad.addColorStop(1, '#ffffff');
          ctx.fillStyle = stripeGrad;
          ctx.fillRect(-radius, -radius * 0.44, radius * 2, radius * 0.88);
          ctx.restore();
        }

        // Rim and highlight
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(-radius * 0.38, -radius * 0.45, radius * 0.24, radius * 0.16, -0.55, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        ctx.fill();
        
        // Number circle
        if (ball.type !== 'cue') {
           ctx.beginPath();
           ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
           ctx.fillStyle = '#fff';
           ctx.fill();
           ctx.strokeStyle = ball.type === 'black' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)';
           ctx.lineWidth = 1;
           ctx.stroke();
           ctx.fillStyle = '#000';
           ctx.font = `900 ${radius * 0.5}px Inter`;
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
      const currentAngle = aiming ? angle : strikeParamsRef.current?.angle || angle;
      
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
  const activeTurnUid = displayState?.mode === 'online'
    ? onlineTurnUid || displayState.players[displayState.turnIndex]?.uid
    : displayState?.players[displayState.turnIndex]?.uid;
  const activeTurnName = displayState?.players.find(player => player.uid === activeTurnUid)?.name;
  const isLocalOnlineTurn = !!displayState && displayState.mode === 'online' && canControlOnlineTurn(displayState);
  const tableStatusLabel = displayState?.winner
    ? `${displayState.players.find(player => player.uid === displayState.winner)?.name || 'Winner'} won`
    : displayState?.mode === 'online'
      ? onlinePhase === 'replaying'
        ? 'Replay in progress'
        : isLocalOnlineTurn
          ? 'Your turn'
          : `Waiting for ${activeTurnName || 'opponent'}`
      : `${displayState?.mode || 'game'} mode`;
  const finishedWinner = gameState?.winner ? gameState.players.find(player => player.uid === gameState.winner) : null;
  const finishedLoser = gameState?.winner ? gameState.players.find(player => player.uid !== gameState.winner) : null;
  const didLocalPlayerWin = gameState?.mode === 'online' && !!gameState.winner && gameState.winner === auth.currentUser?.uid;

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
                isTurn={(displayState.mode === 'online' ? activeTurnUid === displayState.players[0].uid : displayState.turnIndex === 0) && !displayState.winner}
                turnStartTime={displayState.turnStartTime}
                mode={displayState.mode}
                timerActive={displayState.mode !== 'online' || canControlOnlineTurn(displayState)}
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
                      {displayState.mode === 'online'
                        ? onlinePhase === 'replaying'
                          ? 'Replay'
                          : isLocalOnlineTurn
                            ? 'Your Turn'
                            : `Waiting: ${activeTurnName || 'Opponent'}`
                        : `${displayState.mode} Mode`}
                   </p>
                   <div className="flex h-1 gap-1 w-24 bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div className={clsx("h-full transition-all duration-500 bg-amber-400", (displayState.mode === 'online' ? activeTurnUid === displayState.players[0].uid : displayState.turnIndex === 0) ? "w-1/2" : "w-0")} />
                      <div className={clsx("h-full transition-all duration-500 bg-amber-400", (displayState.mode === 'online' ? activeTurnUid === displayState.players[1].uid : displayState.turnIndex === 1) ? "w-1/2" : "w-0")} />
                   </div>
                </div>
             )}
          </div>
          
          <div className="flex-1 py-4 max-w-sm flex items-start justify-end gap-6">
             <div className="flex-1">
                <ScoreCard 
                   player={displayState.players[1]} 
                   balls={displayState.balls} 
                   isTurn={(displayState.mode === 'online' ? activeTurnUid === displayState.players[1].uid : displayState.turnIndex === 1) && !displayState.winner}
                   turnStartTime={displayState.turnStartTime}
                   mode={displayState.mode}
                   timerActive={displayState.mode !== 'online' || canControlOnlineTurn(displayState)}
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
          <div className="absolute -top-24 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none z-30">
            <div className="min-w-64 rounded-2xl border border-cyan-200/20 bg-slate-950/90 px-6 py-3 text-center shadow-2xl backdrop-blur-md">
              <span className="text-sm font-black uppercase tracking-[0.18em] text-white">{tableStatusLabel}</span>
            </div>
            <div className="flex justify-center gap-3">
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

          {displayState?.isBallInHand && !displayState.isMoving && canControlOnlineTurn(displayState) && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="bg-amber-400 text-black px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest flex flex-col items-center gap-2 shadow-2xl pointer-events-auto cursor-pointer active:scale-95 transition-transform" onClick={confirmPlacement}>
                  <RotateCcw size={14} className="animate-spin-slow" />
                  <span>Position Ball & Click to Ready</span>
               </div>
            </div>
          )}
        </div>

        {/* CUE SPIN & POWER SIDEBAR */}
        {!displayState?.isMoving && !displayState?.winner && !menuOpen && canControlOnlineTurn(displayState) && (
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
              <kbd className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-white/10 font-mono">SHIFT</kbd>
              <span>Precision Aim</span>
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
                      }} secondary disabled={!mode || matchmaking || mode === 'online'} />
                    </div>
                  </div>

                  {gameState && !matchmaking && (
                    <div className="mt-8 space-y-3">
                      {gameState.status === 'playing' && (
                        <MenuButton icon={<X />} label="Quit Game" onClick={handleQuitGame} secondary />
                      )}
                      <button 
                        onClick={() => setMenuOpen(false)}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all border border-white/10"
                      >
                         Resume Current Match
                      </button>
                    </div>
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
                    {gameState.mode === 'online' ? (didLocalPlayerWin ? 'Victory' : 'Defeat') : (finishedWinner?.name || 'Winner')}
                    <br/><span className="text-amber-400">{finishedWinner?.name || 'Winner'} Won</span>
                 </h2>
                 <p className="text-slate-400 mb-12 font-bold uppercase tracking-widest text-xs opacity-60">
                    {finishedLoser ? `${finishedLoser.name} lost` : 'Match complete'}
                    {gameState.foulReason ? ` - ${gameState.foulReason}` : ''}
                 </p>
                 <div className="flex gap-4">
                    <button onClick={() => startGame(mode || 'local')} className="flex-1 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 transition-colors shadow-lg shadow-white/10">Play Again</button>
                    <button onClick={returnToMainMenu} className="flex-1 py-5 bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-700 transition-colors border border-white/5">Main Menu</button>
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
