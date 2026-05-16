/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, Ghost, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';
import './reapers-reckoning.css';

// --- Types & Constants ---

type GameState = 'START' | 'HIDING' | 'GUESSING_TRANSITION' | 'GUESSING' | 'ROUND_OVER' | 'TIEBREAKER_INTRO' | 'GAME_OVER';
type VictimVariant = 'man' | 'woman' | 'girl';

interface Score {
  player1: number;
  player2: number;
}

type Screen = 'MENU' | 'MATCHMAKING' | 'GAME';
type GameMode = 'local' | 'online';
type PlayerNumber = 1 | 2;

type OnlinePlayer = {
  uid: string;
  name: string;
};

type ReaperMatch = {
  gameState: GameState;
  round: number;
  tiebreakerTurn: PlayerNumber;
  scores: Score;
  hidingHider: PlayerNumber;
  reaperPlayer: PlayerNumber;
  guessedPositions: number[];
  currentGuessIndex: number | null;
  activeRevealIndex: number | null;
  grabbedDoorIndex: number | null;
  caughtDoorIndexes: number[];
  roundCaught: number;
  victimByDoor: Record<number, VictimVariant>;
  turnStartedAt: number | null;
  winnerPlayer: PlayerNumber | null;
  winReason: 'score' | 'timeout' | 'left' | null;
  players: {
    player1: OnlinePlayer;
    player2: OnlinePlayer;
  };
  status: 'playing' | 'finished';
  createdAtMs: number;
  player1QueueToken?: string;
};

type ReaperQueueEntry = OnlinePlayer & {
  queueToken: string;
  createdAtMs: number;
  lastSeenAt: number;
};

type ReaperSecret = {
  ownerUid: string;
  hiddenPositions: number[];
  victimByDoor: Record<number, VictimVariant>;
};

const TOTAL_DOORS = 10;
const HIDE_COUNT = 5;
const GUESS_COUNT = 5;
const DOORS_PER_ROW = 5;
const VICTIM_VARIANTS: VictimVariant[] = ['man', 'woman', 'girl'];
const TURN_TIME_LIMIT_MS = 60_000;

// --- Components ---

export default function App() {
  const { playerName } = usePlayerIdentity();
  const [screen, setScreen] = useState<Screen>('MENU');
  const [mode, setMode] = useState<GameMode>('local');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [localPlayerNumber, setLocalPlayerNumber] = useState<PlayerNumber>(1);
  const [onlinePlayers, setOnlinePlayers] = useState<ReaperMatch['players'] | null>(null);
  const matchmakingCleanupRef = useRef<(() => void) | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const modeRef = useRef<GameMode>('local');
  const localPlayerNumberRef = useRef<PlayerNumber>(1);
  const gameStateRef = useRef<GameState>('START');
  const hasForfeitedRef = useRef(false);
  const [gameState, setGameState] = useState<GameState>('START');
  const [round, setRound] = useState(1);
  const [tiebreakerTurn, setTiebreakerTurn] = useState<1 | 2>(1);
  const [scores, setScores] = useState<Score>({ player1: 0, player2: 0 });
  
  // Game Logic State
  const [hidingHider, setHidingHider] = useState<PlayerNumber>(1);
  const [reaperPlayer, setReaperPlayer] = useState<PlayerNumber>(2);
  const [hiddenPositions, setHiddenPositions] = useState<number[]>([]);
  const [guessedPositions, setGuessedPositions] = useState<number[]>([]);
  const [isReaperMoving, setIsReaperMoving] = useState(false);
  const [currentGuessIndex, setCurrentGuessIndex] = useState<number | null>(null);
  const [activeRevealIndex, setActiveRevealIndex] = useState<number | null>(null);
  const [grabbedDoorIndex, setGrabbedDoorIndex] = useState<number | null>(null);
  const [caughtDoorIndexes, setCaughtDoorIndexes] = useState<number[]>([]);
  const [roundCaught, setRoundCaught] = useState(0);
  const [victimByDoor, setVictimByDoor] = useState<Record<number, VictimVariant>>({});
  const [secretVictimByDoor, setSecretVictimByDoor] = useState<Record<number, VictimVariant>>({});
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [winnerPlayer, setWinnerPlayer] = useState<PlayerNumber | null>(null);
  const [winReason, setWinReason] = useState<'score' | 'timeout' | 'left' | null>(null);
  const [now, setNow] = useState(Date.now());
  const timeoutHandledRef = useRef(false);

  const playerLabel = (player: PlayerNumber) =>
    mode === 'online'
      ? onlinePlayers?.[`player${player}`].name || `Player ${player}`
      : `Player ${player}`;

  const canActAs = (player: PlayerNumber) => mode === 'local' || localPlayerNumber === player;
  const activeTurnPlayer = gameState === 'HIDING' ? hidingHider : gameState === 'GUESSING' ? reaperPlayer : null;
  const isMyOnlineTurn = mode !== 'online' || activeTurnPlayer === localPlayerNumber;
  const visibleHiddenPositions =
    mode === 'online' && gameState === 'HIDING' && !canActAs(hidingHider)
      ? []
      : hiddenPositions;
  const remainingTurnMs = turnStartedAt ? Math.max(0, TURN_TIME_LIMIT_MS - (now - turnStartedAt)) : TURN_TIME_LIMIT_MS;
  const formatClock = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const turnStatus =
    gameState === 'HIDING'
      ? canActAs(hidingHider)
        ? `Your turn: hide 5 souls`
        : `${playerLabel(hidingHider)} is hiding souls`
      : gameState === 'GUESSING'
      ? canActAs(reaperPlayer)
        ? `Your turn: choose 5 doors`
        : `${playerLabel(reaperPlayer)} is choosing doors`
      : null;
  const resolvedWinner = winnerPlayer ?? (scores.player1 > scores.player2 ? 1 : 2);
  const localOnlineOutcome =
    mode === 'online'
      ? winReason === 'timeout' && localPlayerNumber !== resolvedWinner
        ? 'disqualified'
        : localPlayerNumber === resolvedWinner
        ? 'victory'
        : 'defeat'
      : 'victory';

  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    localPlayerNumberRef.current = localPlayerNumber;
  }, [localPlayerNumber]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const patchOnlineMatch = async (patch: Partial<ReaperMatch>) => {
    if (mode !== 'online' || !matchId) return;
    await updateDoc(doc(db, 'reaper_matches', matchId), patch);
  };

  const forfeitOnlineMatch = useCallback((reason: 'left' = 'left') => {
    const activeMatchId = matchIdRef.current;
    if (
      modeRef.current !== 'online'
      || !activeMatchId
      || hasForfeitedRef.current
      || gameStateRef.current === 'GAME_OVER'
    ) {
      return;
    }

    hasForfeitedRef.current = true;
    const nextWinner: PlayerNumber = localPlayerNumberRef.current === 1 ? 2 : 1;
    void updateDoc(doc(db, 'reaper_matches', activeMatchId), {
      winnerPlayer: nextWinner,
      winReason: reason,
      gameState: 'GAME_OVER',
      status: 'finished',
      turnStartedAt: null,
    });
  }, []);

  const resetBoardState = () => {
    setHiddenPositions([]);
    setGuessedPositions([]);
    setCurrentGuessIndex(null);
    setActiveRevealIndex(null);
    setGrabbedDoorIndex(null);
    setCaughtDoorIndexes([]);
    setRoundCaught(0);
    setVictimByDoor({});
    setSecretVictimByDoor({});
    setIsReaperMoving(false);
  };

  useEffect(() => {
    if (!matchId || mode !== 'online') return;
    return onSnapshot(doc(db, 'reaper_matches', matchId), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as ReaperMatch;
      setGameState(data.gameState);
      setRound(data.round);
      setTiebreakerTurn(data.tiebreakerTurn);
      setScores(data.scores);
      setHidingHider(data.hidingHider);
      setReaperPlayer(data.reaperPlayer);
      setGuessedPositions(data.guessedPositions);
      setCurrentGuessIndex(data.currentGuessIndex);
      setActiveRevealIndex(data.activeRevealIndex);
      setGrabbedDoorIndex(data.grabbedDoorIndex);
      setCaughtDoorIndexes(data.caughtDoorIndexes);
      setRoundCaught(data.roundCaught);
      setVictimByDoor(data.victimByDoor ?? {});
      setIsReaperMoving(
        data.currentGuessIndex !== null
        && !data.guessedPositions.includes(data.currentGuessIndex)
      );
      setTurnStartedAt(data.turnStartedAt ?? null);
      setWinnerPlayer(data.winnerPlayer ?? null);
      setWinReason(data.winReason ?? null);
      if (data.status === 'finished') {
        hasForfeitedRef.current = true;
      }
      setOnlinePlayers(data.players);
      setScreen('GAME');
    });
  }, [matchId, mode]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!matchId || mode !== 'online' || !user) return;

    return onSnapshot(doc(db, 'reaper_matches', matchId, 'secrets', user.uid), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as ReaperSecret;
      setHiddenPositions(data.hiddenPositions);
      setSecretVictimByDoor(data.victimByDoor);
    });
  }, [matchId, mode]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    timeoutHandledRef.current = false;
  }, [turnStartedAt, gameState]);

  useEffect(() => {
    if (
      mode !== 'online'
      || !matchId
      || !activeTurnPlayer
      || !turnStartedAt
      || remainingTurnMs > 0
      || timeoutHandledRef.current
    ) {
      return;
    }

    timeoutHandledRef.current = true;
    const nextWinner = activeTurnPlayer === 1 ? 2 : 1;
    setWinnerPlayer(nextWinner);
    setWinReason('timeout');
    setGameState('GAME_OVER');
    void patchOnlineMatch({
      winnerPlayer: nextWinner,
      winReason: 'timeout',
      gameState: 'GAME_OVER',
      status: 'finished',
      turnStartedAt: null,
    });
  }, [activeTurnPlayer, gameState, matchId, mode, remainingTurnMs, turnStartedAt]);

  const startGame = () => {
    setGameState('HIDING');
    setHiddenPositions([]);
    setGuessedPositions([]);
    setRoundCaught(0);
    setScores({ player1: 0, player2: 0 });
    setHidingHider(1);
    setReaperPlayer(2);
    setRound(1);
    setTiebreakerTurn(1);
    setCurrentGuessIndex(null);
    setActiveRevealIndex(null);
    setGrabbedDoorIndex(null);
    setCaughtDoorIndexes([]);
    setVictimByDoor({});
    setSecretVictimByDoor({});
    setTurnStartedAt(Date.now());
    setWinnerPlayer(null);
    setWinReason(null);
  };

  const startLocalMode = () => {
    setMode('local');
    setScreen('GAME');
    startGame();
  };

  const leaveToMenu = async () => {
    matchmakingCleanupRef.current?.();
    matchmakingCleanupRef.current = null;
    if (mode === 'online' && matchId) {
      forfeitOnlineMatch('left');
    }
    setMatchId(null);
    setOnlinePlayers(null);
    setScreen('MENU');
    setMode('local');
    setLocalPlayerNumber(1);
    hasForfeitedRef.current = false;
  };

  useEffect(() => {
    const handlePageExit = () => {
      forfeitOnlineMatch('left');
    };

    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    return () => {
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      handlePageExit();
    };
  }, [forfeitOnlineMatch]);

  const startOnlineMode = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setMode('online');
    setScreen('MATCHMAKING');

    const queueRef = doc(db, 'reaper_queue', user.uid);
    const joinedAtMs = Date.now();
    const queueToken = `${user.uid}_${joinedAtMs}_${Math.random().toString(36).slice(2)}`;
    let active = true;
    let heartbeat = 0;

    const refreshQueue = () => setDoc(queueRef, {
      uid: user.uid,
      name: playerName,
      queueToken,
      createdAtMs: joinedAtMs,
      lastSeenAt: Date.now(),
    } satisfies ReaperQueueEntry);

    const findOpponent = async () => {
      const now = Date.now();
      const snapshot = await getDocs(query(collection(db, 'reaper_queue'), limit(50)));
      await Promise.all(snapshot.docs.map(async (queuedPlayer) => {
        const data = queuedPlayer.data() as ReaperQueueEntry;
        if (now - data.lastSeenAt > 7000) {
          await deleteDoc(doc(db, 'reaper_queue', queuedPlayer.id)).catch(() => undefined);
        }
      }));

      return snapshot.docs.find((queuedPlayer) => {
        const data = queuedPlayer.data() as ReaperQueueEntry;
        return queuedPlayer.id !== user.uid
          && now - data.lastSeenAt <= 7000
          && data.createdAtMs <= joinedAtMs;
      });
    };

    const createMatch = async (opponentDoc: Awaited<ReturnType<typeof findOpponent>>) => {
      if (!opponentDoc) return false;
      const opponent = opponentDoc.data() as ReaperQueueEntry;
      const nextMatchId = `reaper_${Date.now()}_${user.uid}`;
      const match: ReaperMatch = {
        gameState: 'HIDING',
        round: 1,
        tiebreakerTurn: 1,
        scores: { player1: 0, player2: 0 },
        hidingHider: 1,
        reaperPlayer: 2,
        guessedPositions: [],
        currentGuessIndex: null,
        activeRevealIndex: null,
        grabbedDoorIndex: null,
        caughtDoorIndexes: [],
        roundCaught: 0,
        victimByDoor: {},
        turnStartedAt: Date.now(),
        winnerPlayer: null,
        winReason: null,
        players: {
          player1: { uid: opponent.uid, name: opponent.name },
          player2: { uid: user.uid, name: playerName },
        },
        status: 'playing',
        createdAtMs: Date.now(),
        player1QueueToken: opponent.queueToken,
      };

      await setDoc(doc(db, 'reaper_matches', nextMatchId), match);
      await deleteDoc(doc(db, 'reaper_queue', opponent.uid)).catch(() => undefined);
      await deleteDoc(queueRef).catch(() => undefined);
      resetBoardState();
      hasForfeitedRef.current = false;
      setLocalPlayerNumber(2);
      setMatchId(nextMatchId);
      return true;
    };

    const tryMatch = async () => {
      const opponent = await findOpponent();
      if (opponent) {
        const matched = await createMatch(opponent);
        if (matched) {
          active = false;
          window.clearInterval(heartbeat);
          unsubscribe();
        }
      }
    };

    await refreshQueue();
    heartbeat = window.setInterval(() => {
      if (!active) return;
      refreshQueue().catch(() => undefined);
      tryMatch().catch(() => undefined);
    }, 2000);

    const unsubscribe = onSnapshot(
      query(collection(db, 'reaper_matches'), where('players.player1.uid', '==', user.uid)),
      (snapshot) => {
        const found = snapshot.docs.find((matchDoc) => {
          const data = matchDoc.data() as ReaperMatch;
          return data.status === 'playing'
            && data.players.player1.uid === user.uid
            && data.player1QueueToken === queueToken;
        });
        if (!found || !active) return;
        active = false;
        window.clearInterval(heartbeat);
        unsubscribe();
        deleteDoc(queueRef).catch(() => undefined);
        resetBoardState();
        hasForfeitedRef.current = false;
        setLocalPlayerNumber(1);
        setMatchId(found.id);
      },
    );

    window.setTimeout(() => tryMatch().catch(() => undefined), 700);
    matchmakingCleanupRef.current = () => {
      active = false;
      window.clearInterval(heartbeat);
      unsubscribe();
      deleteDoc(queueRef).catch(() => undefined);
    };
  };

  const handleHideDoor = (index: number) => {
    if (gameState !== 'HIDING') return;
    if (!canActAs(hidingHider)) return;
    if (hiddenPositions.includes(index)) {
      setHiddenPositions(prev => prev.filter(i => i !== index));
    } else if (hiddenPositions.length < HIDE_COUNT) {
      setHiddenPositions(prev => [...prev, index]);
    }
  };

  const confirmHiding = () => {
    if (hiddenPositions.length === HIDE_COUNT && canActAs(hidingHider)) {
      const nextVictimByDoor = Object.fromEntries(
        hiddenPositions.map(index => [
          index,
          VICTIM_VARIANTS[Math.floor(Math.random() * VICTIM_VARIANTS.length)],
        ]),
      );
      setSecretVictimByDoor(nextVictimByDoor);
      setGameState('GUESSING_TRANSITION');
      setTurnStartedAt(null);
      if (mode === 'online' && matchId && auth.currentUser) {
        void setDoc(doc(db, 'reaper_matches', matchId, 'secrets', auth.currentUser.uid), {
          ownerUid: auth.currentUser.uid,
          hiddenPositions,
          victimByDoor: nextVictimByDoor,
        } satisfies ReaperSecret);
      }
      void patchOnlineMatch({ gameState: 'GUESSING_TRANSITION', turnStartedAt: null });
    }
  };

  const startGuessing = () => {
    if (!canActAs(reaperPlayer)) return;
    setGameState('GUESSING');
    setGuessedPositions([]);
    setCurrentGuessIndex(null);
    setActiveRevealIndex(null);
    setGrabbedDoorIndex(null);
    setCaughtDoorIndexes([]);
    const nextTurnStartedAt = Date.now();
    setTurnStartedAt(nextTurnStartedAt);
    void patchOnlineMatch({
      gameState: 'GUESSING',
      guessedPositions: [],
      currentGuessIndex: null,
      activeRevealIndex: null,
      grabbedDoorIndex: null,
      caughtDoorIndexes: [],
      turnStartedAt: nextTurnStartedAt,
    });
  };

  const handleGuessDoor = (index: number) => {
    if (gameState !== 'GUESSING' || isReaperMoving || guessedPositions.includes(index)) return;
    if (!canActAs(reaperPlayer)) return;
    if (guessedPositions.length >= GUESS_COUNT) return;

    // Stage the turn as arrival, door opening, then collection.
    setCurrentGuessIndex(index);
    setActiveRevealIndex(null);
    setGrabbedDoorIndex(null);
    setIsReaperMoving(true);
    void patchOnlineMatch({ currentGuessIndex: index, activeRevealIndex: null, grabbedDoorIndex: null });

    if (mode === 'online') return;
    
    setTimeout(() => {
      setIsReaperMoving(false);
    }, 900);

    setTimeout(() => {
      setGuessedPositions(prev => [...prev, index]);
      setActiveRevealIndex(index);
      const found = hiddenPositions.includes(index);
      const nextGuessedPositions = [...guessedPositions, index];
      const nextRoundCaught = found ? roundCaught + 1 : roundCaught;
      const nextScores = found
        ? {
            ...scores,
            [reaperPlayer === 1 ? 'player1' : 'player2']:
              scores[reaperPlayer === 1 ? 'player1' : 'player2'] + 1,
          }
        : scores;
      if (found) {
        setRoundCaught(prev => prev + 1);
        setScores(prev => ({
          ...prev,
          [reaperPlayer === 1 ? 'player1' : 'player2']: prev[reaperPlayer === 1 ? 'player1' : 'player2'] + 1,
        }));
        setTimeout(() => setGrabbedDoorIndex(index), 450);
        setTimeout(() => setCaughtDoorIndexes(prev => [...prev, index]), 900);
      }
      void patchOnlineMatch({
        guessedPositions: nextGuessedPositions,
        activeRevealIndex: index,
        roundCaught: nextRoundCaught,
        scores: nextScores,
      });
      if (found) {
        window.setTimeout(() => patchOnlineMatch({ grabbedDoorIndex: index }), 450);
        window.setTimeout(() => patchOnlineMatch({ caughtDoorIndexes: [...caughtDoorIndexes, index] }), 900);
      }
      
      // Check if done
      if (guessedPositions.length + 1 === GUESS_COUNT) {
        setTimeout(() => endRound(), 2500);
      }
    }, 1050);
  };

  useEffect(() => {
    if (
      mode !== 'online'
      || gameState !== 'GUESSING'
      || currentGuessIndex === null
      || guessedPositions.includes(currentGuessIndex)
      || !canActAs(hidingHider)
    ) {
      return;
    }

    const index = currentGuessIndex;
    const found = hiddenPositions.includes(index);
    const nextGuessedPositions = [...guessedPositions, index];
    const nextRoundCaught = found ? roundCaught + 1 : roundCaught;
    const nextScores = found
      ? {
          ...scores,
          [reaperPlayer === 1 ? 'player1' : 'player2']:
            scores[reaperPlayer === 1 ? 'player1' : 'player2'] + 1,
        }
      : scores;
    const nextVictimByDoor = found && secretVictimByDoor[index]
      ? { ...victimByDoor, [index]: secretVictimByDoor[index] }
      : victimByDoor;

    const revealTimer = window.setTimeout(() => {
      void patchOnlineMatch({
        guessedPositions: nextGuessedPositions,
        activeRevealIndex: index,
        roundCaught: nextRoundCaught,
        scores: nextScores,
        victimByDoor: nextVictimByDoor,
      });

      if (found) {
        window.setTimeout(() => patchOnlineMatch({ grabbedDoorIndex: index }), 450);
        window.setTimeout(() => patchOnlineMatch({ caughtDoorIndexes: [...caughtDoorIndexes, index] }), 900);
      }

      if (nextGuessedPositions.length === GUESS_COUNT) {
        window.setTimeout(() => endRound(), 2500);
      }
    }, 1050);

    return () => window.clearTimeout(revealTimer);
  }, [
    caughtDoorIndexes,
    currentGuessIndex,
    gameState,
    guessedPositions,
    hiddenPositions,
    hidingHider,
    mode,
    reaperPlayer,
    roundCaught,
    scores,
    secretVictimByDoor,
    victimByDoor,
  ]);

  const endRound = useCallback(() => {
    setGameState('ROUND_OVER');
    setTurnStartedAt(null);
    void patchOnlineMatch({ gameState: 'ROUND_OVER', turnStartedAt: null });
  }, [matchId, mode]);

  const nextRound = () => {
    if (mode === 'online' && !canActAs(reaperPlayer)) return;
    if (round === 1) {
      setRound(2);
      setHidingHider(2);
      setReaperPlayer(1);
      setHiddenPositions([]);
      setGuessedPositions([]);
      setRoundCaught(0);
      setCurrentGuessIndex(null);
      setActiveRevealIndex(null);
      setGrabbedDoorIndex(null);
      setCaughtDoorIndexes([]);
      setVictimByDoor({});
      setSecretVictimByDoor({});
      setGameState('HIDING');
      const nextTurnStartedAt = Date.now();
      setTurnStartedAt(nextTurnStartedAt);
      void patchOnlineMatch({
        round: 2,
        hidingHider: 2,
        reaperPlayer: 1,
        guessedPositions: [],
        roundCaught: 0,
        currentGuessIndex: null,
        activeRevealIndex: null,
        grabbedDoorIndex: null,
        caughtDoorIndexes: [],
        victimByDoor: {},
        gameState: 'HIDING',
        turnStartedAt: nextTurnStartedAt,
      });
    } else if (round === 2) {
      if (scores.player1 === scores.player2) {
        setGameState('TIEBREAKER_INTRO');
        void patchOnlineMatch({ gameState: 'TIEBREAKER_INTRO' });
      } else {
        setGameState('GAME_OVER');
        const nextWinner = scores.player1 > scores.player2 ? 1 : 2;
        setWinnerPlayer(nextWinner);
        setWinReason('score');
        void patchOnlineMatch({ gameState: 'GAME_OVER', status: 'finished', winnerPlayer: nextWinner, winReason: 'score', turnStartedAt: null });
      }
    } else if (round === 3) {
      if (tiebreakerTurn === 1) {
        setTiebreakerTurn(2);
        setHidingHider(2);
        setReaperPlayer(1);
        setHiddenPositions([]);
        setGuessedPositions([]);
        setRoundCaught(0);
        setCurrentGuessIndex(null);
        setActiveRevealIndex(null);
        setGrabbedDoorIndex(null);
        setCaughtDoorIndexes([]);
        setVictimByDoor({});
        setSecretVictimByDoor({});
        setGameState('HIDING');
        const nextTurnStartedAt = Date.now();
        setTurnStartedAt(nextTurnStartedAt);
        void patchOnlineMatch({
          hidingHider: 2,
          reaperPlayer: 1,
          guessedPositions: [],
          roundCaught: 0,
          currentGuessIndex: null,
          activeRevealIndex: null,
          grabbedDoorIndex: null,
          caughtDoorIndexes: [],
          victimByDoor: {},
          gameState: 'HIDING',
          turnStartedAt: nextTurnStartedAt,
        });
      } else {
        setGameState('GAME_OVER');
        const nextWinner = scores.player1 > scores.player2 ? 1 : 2;
        setWinnerPlayer(nextWinner);
        setWinReason('score');
        void patchOnlineMatch({ gameState: 'GAME_OVER', status: 'finished', winnerPlayer: nextWinner, winReason: 'score', turnStartedAt: null });
      }
    }
  };

  const startTiebreaker = () => {
    setRound(3);
    setTiebreakerTurn(1);
    setHidingHider(1); // Alternating or fixed for tiebreaker
    setReaperPlayer(2);
    setHiddenPositions([]);
    setGuessedPositions([]);
    setRoundCaught(0);
    setCurrentGuessIndex(null);
    setActiveRevealIndex(null);
    setGrabbedDoorIndex(null);
    setCaughtDoorIndexes([]);
    setVictimByDoor({});
    setSecretVictimByDoor({});
    setGameState('HIDING');
    const nextTurnStartedAt = Date.now();
    setTurnStartedAt(nextTurnStartedAt);
    void patchOnlineMatch({
      round: 3,
      tiebreakerTurn: 1,
      hidingHider: 1,
      reaperPlayer: 2,
      guessedPositions: [],
      roundCaught: 0,
      currentGuessIndex: null,
      activeRevealIndex: null,
      grabbedDoorIndex: null,
      caughtDoorIndexes: [],
      victimByDoor: {},
      gameState: 'HIDING',
      turnStartedAt: nextTurnStartedAt,
    });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e2e2e2] font-serif selection:bg-red-900/30 overflow-hidden flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=JetBrains+Mono:wght@100..800&family=Inter:wght@100..900&display=swap');
        
        :root {
          --font-serif: 'Cormorant Garamond', serif;
          --font-mono: 'JetBrains Mono', monospace;
          --font-sans: 'Inter', sans-serif;
        }

        body { font-family: var(--font-serif); }
      `}</style>

      {screen === 'MENU' && (
        <main className="reaper-menu flex-1 flex items-center justify-center px-6">
          <div className="max-w-3xl w-full text-center">
            <Skull className="mx-auto mb-8 h-24 w-24 text-[#991b1b]" />
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic text-white">Reaper's Reckoning</h1>
            <p className="mt-5 text-white/45 text-lg italic">Choose how the harvest begins.</p>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <button onClick={startLocalMode} className="reaper-mode-card">
                <strong>Local Mode</strong>
                <span>Two players share one computer and pass the turn between rounds.</span>
              </button>
              <button onClick={() => void startOnlineMode()} className="reaper-mode-card">
                <strong>Online Mode</strong>
                <span>Matchmake with another player using your site profile.</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {screen === 'MATCHMAKING' && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Skull className="mb-8 h-20 w-20 animate-pulse text-[#991b1b]" />
          <h1 className="text-5xl font-black uppercase italic">Seeking an Opponent</h1>
          <p className="mt-4 text-white/45">Searching as {playerName}</p>
          <button onClick={() => void leaveToMenu()} className="mt-10 px-8 py-4 border border-white/20 hover:bg-white hover:text-black transition-all uppercase tracking-[0.3em] text-xs">
            Cancel
          </button>
        </main>
      )}

      {screen === 'GAME' && (
      <>
      {/* Header Section */}
      <header className="px-10 py-6 flex justify-between items-end border-b border-[#333] mb-6 bg-[#050505] z-50">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-[#991b1b] uppercase leading-[0.85]">
            Reaper's<br/>Reckoning
          </h1>
          <p className="text-[9px] tracking-[0.4em] uppercase opacity-40 mt-2 font-[var(--font-mono)]">
            A SOUL-COLLECTION CHALLENGE
          </p>
        </div>
        
        <div className="flex gap-10 text-right">
          {mode === 'online' && activeTurnPlayer && (
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.2em] opacity-40 font-[var(--font-mono)]">Turn Clock</span>
              <span className={`text-2xl font-bold font-[var(--font-mono)] ${remainingTurnMs <= 10_000 ? 'text-[#991b1b]' : 'text-white/80'}`}>
                {formatClock(remainingTurnMs)}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-[0.2em] opacity-40 font-[var(--font-mono)]">Level</span>
            <span className="text-xl font-bold italic text-white/80">Round {round}</span>
          </div>
          <motion.div 
            key={gameState}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col"
          >
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#991b1b] font-[var(--font-mono)]">Focus</span>
            <span className="text-xl font-bold italic text-white/80">
              {gameState === 'START' ? 'The Threshold' : 
               gameState === 'HIDING' ? `${playerLabel(hidingHider)} Hider` : 
               gameState === 'GUESSING_TRANSITION' ? 'Reaper Rising' :
               gameState === 'GUESSING' ? 'Grim Reaper' :
               gameState === 'ROUND_OVER' ? 'Harvest End' : 'Eternal Rest'}
            </span>
          </motion.div>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="flex-1 flex px-10 gap-8 relative overflow-hidden pb-6">
        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto"
            >
              <div className="mb-12 relative">
                <Skull className="w-32 h-32 text-[#991b1b]/10 absolute -inset-4 blur-xl" />
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Skull className="w-32 h-32 text-white/80" />
                </motion.div>
              </div>
              <h2 className="text-7xl font-black italic mb-8 tracking-tighter uppercase">Step into the Void</h2>
              <p className="text-white/40 mb-12 leading-relaxed text-xl italic max-w-lg">
                The ferryman waits for no one. Conceal five mortal souls within the crypts, and hope the Reaper's scythe misses its mark.
              </p>
              <button 
                onClick={startGame}
                className="group relative px-16 py-6 bg-[#991b1b] text-white font-bold uppercase tracking-[0.3em] text-[11px] transition-all hover:bg-white hover:text-black overflow-hidden"
              >
                <span className="relative z-10 font-[var(--font-mono)]">Enter The Dark</span>
              </button>
            </motion.div>
          )}

          {(gameState === 'HIDING' || gameState === 'GUESSING') && (
            <motion.div 
              key="game-play"
              className="w-full flex gap-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Sidebar Scoreboard */}
              <div className="w-56 flex flex-col gap-6 shrink-0 pt-4">
                <div className={`p-5 transition-all duration-500 border-l-4 ${
                  activeTurnPlayer === 1 ? 'bg-white/5 border-[#991b1b]' : 'bg-[#111] border-[#333]'
                }`}>
                  <p className="text-[10px] font-[var(--font-mono)] uppercase tracking-widest opacity-40 mb-2">{playerLabel(1)}</p>
                  <p className="text-5xl font-bold flex items-baseline gap-2">
                    {scores.player1} 
                    <span className="text-xs uppercase font-[var(--font-mono)] opacity-30 tracking-tighter">Caught</span>
                  </p>
                </div>
                
                <div className={`p-5 transition-all duration-500 border-l-4 ${
                  activeTurnPlayer === 2 ? 'bg-white/5 border-[#991b1b]' : 'bg-[#111] border-[#333]'
                }`}>
                  <p className="text-[10px] font-[var(--font-mono)] uppercase tracking-widest opacity-40 mb-2">{playerLabel(2)}</p>
                  <p className="text-5xl font-bold flex items-baseline gap-2">
                    {scores.player2}
                    <span className="text-xs uppercase font-[var(--font-mono)] opacity-30 tracking-tighter">Caught</span>
                  </p>
                </div>

                <div className="mt-auto pb-12">
                  {turnStatus && (
                    <div className="mb-5 border border-[#991b1b]/50 bg-[#991b1b]/10 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-[#991b1b] font-[var(--font-mono)]">Turn</p>
                      <p className="mt-1 text-lg font-bold italic text-white">{turnStatus}</p>
                      {mode === 'online' && (
                        <p className="mt-2 text-[11px] font-[var(--font-mono)] uppercase tracking-[0.24em] text-white/55">
                          Time left {formatClock(remainingTurnMs)}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="h-px w-full bg-[#333] mb-6"></div>
                  <div className="flex justify-between text-[11px] font-[var(--font-mono)] tracking-widest opacity-40 uppercase mb-3">
                    <span>{gameState === 'HIDING' ? 'Souls to Hide' : 'Strikes Left'}</span>
                    <span>
                      {gameState === 'HIDING'
                        ? mode === 'online' && !canActAs(hidingHider)
                          ? 'Hidden'
                          : `${hiddenPositions.length}/5`
                        : `${GUESS_COUNT - guessedPositions.length}/5`}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {[...Array(5)].map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 flex-grow rounded-full transition-colors duration-500 ${
                          gameState === 'HIDING' 
                            ? (idx < visibleHiddenPositions.length ? 'bg-[#991b1b]' : 'bg-[#333]')
                            : (idx < (GUESS_COUNT - guessedPositions.length) ? 'bg-[#991b1b]' : 'bg-[#333]')
                        }`} 
                      />
                    ))}
                  </div>
                  
                  {gameState === 'HIDING' && canActAs(hidingHider) && hiddenPositions.length === HIDE_COUNT && (
                    <motion.button 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={confirmHiding}
                      className="w-full mt-10 py-5 bg-[#991b1b] text-white font-bold uppercase text-[10px] tracking-[0.4em] transition-all hover:bg-white hover:text-black font-[var(--font-mono)]"
                    >
                      Lock Crypts
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Doors Grid Content */}
              <div className="flex-grow flex flex-col justify-center max-h-full">
                 <div className="board-stage max-w-4xl mx-auto w-full">
                    <div className="row-floor row-floor-top" />
                    <div className="row-floor row-floor-bottom" />

                    {gameState === 'GUESSING' && (
                      <ReaperActor
                        targetDoor={currentGuessIndex}
                        isMoving={isReaperMoving}
                        isGrabbing={grabbedDoorIndex !== null}
                      />
                    )}

                    <div className="grid grid-cols-5 gap-4 relative z-10">
                      {[...Array(TOTAL_DOORS)].map((_, i) => (
                        <Door 
                          key={i}
                          index={i}
                          isHiding={gameState === 'HIDING'}
                          isHidden={visibleHiddenPositions.includes(i)}
                          isGuessed={guessedPositions.includes(i)}
                          isCorrect={
                            gameState === 'GUESSING'
                            && (mode === 'online' ? victimByDoor[i] !== undefined : hiddenPositions.includes(i))
                          }
                          isActiveReveal={activeRevealIndex === i}
                          isGrabbed={grabbedDoorIndex === i}
                          isCaught={caughtDoorIndexes.includes(i)}
                          victimVariant={victimByDoor[i]}
                          onClick={() => gameState === 'HIDING' ? handleHideDoor(i) : handleGuessDoor(i)}
                        />
                      ))}
                    </div>
                 </div>

                 {/* Narrative Line */}
                 <div className="mt-8 flex justify-between items-center border-t border-[#333] pt-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-px bg-[#991b1b]/40"></div>
                      <AnimatePresence mode="wait">
                        <motion.p 
                          key={isReaperMoving ? 'moving' : gameState}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="italic opacity-60 uppercase tracking-[0.3em] text-[12px] font-[var(--font-mono)]"
                        >
                          {isReaperMoving ? `The Reaper glides towards Sector ${currentGuessIndex! + 1}...` :
                           gameState === 'HIDING' && mode === 'online' && !canActAs(hidingHider)
                             ? 'Waiting while your opponent conceals the souls.'
                             : gameState === 'HIDING'
                             ? 'Silence falls over the tomb as souls are hidden.'
                             : mode === 'online' && !canActAs(reaperPlayer)
                             ? 'Waiting while your opponent chooses doors.'
                             : 'Every shadow hides a secret. Choose wisely.'}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {gameState === 'GUESSING_TRANSITION' && (
            <motion.div 
              key="transition"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="relative mb-12">
                <Ghost className="w-28 h-28 text-[#991b1b] animate-pulse" />
                <div className="absolute inset-0 bg-[#991b1b]/10 blur-[60px] rounded-full" />
              </div>
              <h2 className="text-6xl font-black italic mb-8 uppercase tracking-tighter">The Night Shift</h2>
              <p className="text-white/40 mb-12 uppercase text-[12px] font-[var(--font-mono)] tracking-[0.5em] italic">
                {mode === 'online' ? `${playerLabel(reaperPlayer)} takes the scythe.` : `The mantle passes. Pass the device to Player ${reaperPlayer}.`}
              </p>
              <button 
                onClick={startGuessing}
                className="px-16 py-6 border border-white/20 bg-white/5 text-white font-bold uppercase text-[11px] tracking-[0.4em] hover:bg-[#991b1b] hover:text-white transition-all shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
              >
                Accept The Harvest
              </button>
            </motion.div>
          )}

          {gameState === 'ROUND_OVER' && (
            <motion.div 
              key="round-over"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center bg-gradient-to-b from-transparent to-[#991b1b]/05"
            >
              <p className="text-[#991b1b] font-bold uppercase tracking-[0.6em] text-xs mb-8 font-[var(--font-mono)]">Tomb Report</p>
              <h2 className="text-[12rem] font-black italic leading-none mb-4 text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">{roundCaught}</h2>
              <p className="text-white/30 uppercase text-[18px] font-bold tracking-[0.4em] mb-20 italic">Souls Tethered To Existence</p>
              
              <button 
                onClick={nextRound}
                className="group flex items-center gap-6 px-16 py-6 bg-white text-black font-bold uppercase text-[11px] tracking-[0.5em] hover:bg-[#991b1b] hover:text-white transition-all overflow-hidden"
              >
                <span className="relative z-10 font-[var(--font-mono)]">
                  {round === 1
                    ? 'Next Descent'
                    : round === 3 && tiebreakerTurn === 1
                    ? 'Switch Sides'
                    : (scores.player1 === scores.player2 ? 'The Blood Pact' : 'Witness Finality')}
                </span>
                <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-3 transition-transform" />
              </button>
            </motion.div>
          )}

          {gameState === 'TIEBREAKER_INTRO' && (
            <motion.div 
              key="tiebreaker"
              initial={{ opacity: 0, filter: 'blur(20px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="flex gap-4 mb-10">
                 {[...Array(3)].map((_, i) => (
                    <AlertTriangle key={i} className="w-12 h-12 text-[#991b1b] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                 ))}
              </div>
              <h2 className="text-9xl font-black italic mb-6 text-[#991b1b] uppercase tracking-tighter leading-none">Deadlock</h2>
              <p className="text-white/40 mb-16 max-w-lg mx-auto text-xl italic font-serif leading-relaxed">
                The balance of souls is equal. Only one final hunt can tip the scales of the afterlife. Prepare for the Blood Round.
              </p>
              <button 
                onClick={startTiebreaker}
                className="px-20 py-8 bg-[#991b1b] text-white font-bold uppercase text-[13px] tracking-[0.6em] hover:bg-white hover:text-black transition-all shadow-[0_0_80px_rgba(153,27,27,0.4)]"
              >
                Inscribe The Oath
              </button>
            </motion.div>
          )}

          {gameState === 'GAME_OVER' && (
            <motion.div 
              key="game-over"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="mb-16 relative">
                 <div className="absolute inset-x-0 h-1 bg-[#991b1b]/30 top-1/2 -translate-y-1/2 -z-10 w-[200%] -translate-x-1/4" />
                 <Skull className="w-48 h-48 text-white relative z-10 p-8 bg-[#050505]" />
              </div>
              <h2 className="text-8xl font-black italic mb-8 uppercase tracking-tighter">
                {mode === 'online'
                  ? localOnlineOutcome === 'disqualified'
                    ? 'You Have Been Disqualified'
                    : localOnlineOutcome === 'victory'
                    ? `${playerLabel(resolvedWinner)} Ascendant`
                    : 'Defeat'
                  : `${playerLabel(resolvedWinner)} Ascendant`}
              </h2>
              {mode === 'online' && localOnlineOutcome === 'disqualified' && (
                <p className="mb-10 max-w-xl text-lg italic text-white/55">
                  You failed to complete your turn within the one minute time constraint.
                </p>
              )}
              {mode === 'online' && localOnlineOutcome === 'defeat' && (
                <p className="mb-10 text-lg italic text-white/55">
                  {winReason === 'left' ? 'Your opponent has left.' : `${playerLabel(resolvedWinner)} claimed the reckoning.`}
                </p>
              )}
              <div className="flex gap-12 items-center mb-24 font-[var(--font-mono)]">
                <div className="text-center">
                  <p className="text-[10px] opacity-30 uppercase tracking-widest mb-1">{playerLabel(1)}</p>
                  <p className="text-3xl font-bold">{scores.player1}</p>
                </div>
                <div className="h-10 w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-[10px] opacity-30 uppercase tracking-widest mb-1">{playerLabel(2)}</p>
                  <p className="text-3xl font-bold">{scores.player2}</p>
                </div>
              </div>
              {winReason === 'timeout' && winnerPlayer && localOnlineOutcome === 'victory' && (
                <p className="mb-10 text-sm uppercase tracking-[0.35em] text-[#991b1b] font-[var(--font-mono)]">
                  {playerLabel(winnerPlayer === 1 ? 2 : 1)} ran out of time
                </p>
              )}
              {winReason === 'left' && localOnlineOutcome === 'victory' && (
                <p className="mb-10 text-sm uppercase tracking-[0.35em] text-[#991b1b] font-[var(--font-mono)]">
                  Your opponent has left
                </p>
              )}
              <button 
                onClick={mode === 'online' ? leaveToMenu : startGame}
                className="group flex items-center gap-4 px-12 py-5 bg-white/5 border border-white/20 hover:bg-white hover:text-black transition-all font-bold uppercase text-[10px] tracking-[0.5em]"
              >
                <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                {mode === 'online' ? 'Return To Menu' : 'Resurrect The Game'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="px-10 py-8 border-t border-[#333] flex justify-between items-center opacity-30 font-[var(--font-mono)]">
        <p className="text-[9px] tracking-[0.4em] uppercase">MORTAL COIL PROTOCOL v1.02</p>
        <p className="text-[9px] tracking-[0.4em] uppercase whitespace-nowrap">ETHEREAL MECHANICS © 2026</p>
      </footer>
      </>
      )}
    </div>
  );
}

interface DoorProps {
  key?: React.Key;
  index: number;
  isHiding: boolean;
  isHidden: boolean;
  isGuessed: boolean;
  isCorrect: boolean;
  isActiveReveal: boolean;
  isGrabbed: boolean;
  isCaught: boolean;
  victimVariant?: VictimVariant;
  onClick: () => void;
}

function Door({ 
  index, 
  isHiding, 
  isHidden, 
  isGuessed, 
  isCorrect, 
  isActiveReveal,
  isGrabbed,
  isCaught,
  victimVariant,
  onClick
}: DoorProps) {
  return (
    <div className="door-slot relative group perspective-1000">
      <motion.div
        whileHover={!isGuessed ? { scale: 1.02, filter: 'brightness(1.2)' } : {}}
        onClick={onClick}
        className="door-scene relative cursor-pointer overflow-visible"
      >
        {/* Door Frame/Border */}
        <div className={`door-frame absolute -inset-[4px] transition-all duration-700 ${
          isHiding && isHidden ? 'border-[#991b1b] shadow-[0_0_20px_rgba(153,27,27,0.4)]' : 
          isGuessed ? (isCorrect ? 'border-white ring-4 ring-[#991b1b]/30' : 'border-[#222]') :
          'border-[#333] group-hover:border-[#991b1b]'
        }`} />

        {/* Backside (The Crypt) */}
        <div className="door-interior absolute inset-0 overflow-hidden">
            {isGuessed && isCorrect && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full relative"
              >
                <div className="absolute inset-0 bg-[#991b1b] mix-blend-multiply opacity-35 z-0" />
                {!isCaught && (
                  <TerrifiedPerson
                    isGrabbed={isGrabbed}
                    isCaught={isCaught}
                    pullDirection={index % DOORS_PER_ROW === DOORS_PER_ROW - 1 ? -1 : 1}
                    variant={victimVariant ?? 'man'}
                  />
                )}
                {isCaught && <p className="door-status caught">CAUGHT</p>}
              </motion.div>
            )}
            
            {isGuessed && !isCorrect && (
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="w-full h-full flex flex-col items-center justify-end pb-6"
               >
                 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-80" />
                 <p className="text-[10px] uppercase font-mono tracking-widest text-[#991b1b] italic opacity-40 relative z-10">Empty Void</p>
               </motion.div>
            )}
        </div>

        {/* The Actual Door Surface */}
        <motion.div
          initial={false}
          animate={{ 
            rotateY: isGuessed ? -108 : 0,
            x: isGuessed ? -10 : 0,
            z: isGuessed ? 28 : 0,
          }}
          transition={{ type: 'spring', damping: 18, stiffness: 72, mass: 1, delay: isActiveReveal ? 0 : 0 }}
          style={{ transformOrigin: 'left center' }}
          className={`wooden-door absolute inset-0 flex flex-col items-center justify-center z-10 ${isHiding && isHidden ? 'is-marked' : ''}`}
        >
          <div className="door-number-plaque">{String(index + 1).padStart(2, '0')}</div>

          <div className="flex flex-col items-center gap-4">
            <div className={`w-2 h-2 rounded-full transition-colors duration-700 ${isHiding && isHidden ? 'bg-[#991b1b]' : 'bg-[#991b1b] opacity-20 group-hover:opacity-100'}`} />
            
            {isHiding && isHidden && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Skull className="w-10 h-10 text-[#991b1b]" />
              </motion.div>
            )}
          </div>
          
        </motion.div>

      </motion.div>
    </div>
  );
}

function ReaperActor({ targetDoor, isMoving, isGrabbing }: { targetDoor: number | null; isMoving: boolean; isGrabbing: boolean }) {
  const targetIndex = targetDoor ?? 0;
  const column = targetIndex % DOORS_PER_ROW;
  const row = Math.floor(targetIndex / DOORS_PER_ROW);
  const sideOffset = column === DOORS_PER_ROW - 1 ? -10 : 10;
  const left = `calc(${column * 20}% + 10% + ${sideOffset}%)`;
  const top = row === 0 ? 'calc(50% + 10px)' : 'calc(100% - 4px)';

  return (
    <motion.div
      className="reaper-track"
      initial={false}
      animate={{ left, top }}
      transition={{ duration: isMoving ? 1.1 : 0.35, ease: 'easeInOut' }}
    >
      <motion.div
        className={`reaper ${isMoving ? 'is-walking' : ''} ${isGrabbing ? 'is-grabbing' : ''}`}
        animate={isMoving ? { y: [0, -8, 0, -6, 0] } : { y: [0, -3, 0] }}
        transition={{ duration: isMoving ? 0.55 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="reaper-scythe"
          animate={isGrabbing ? { rotate: [10, -42, 16] } : { rotate: 10 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
        />
        <div className="reaper-hood">
          <span />
        </div>
        <div className="reaper-cloak" />
        <motion.div
          className="reaper-arm"
          animate={isGrabbing ? { rotate: [0, -34, -18], x: [0, 10, 18] } : { rotate: 0, x: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
        <div className="reaper-feet">
          <span />
          <span />
        </div>
      </motion.div>
    </motion.div>
  );
}

function TerrifiedPerson({
  isGrabbed,
  isCaught,
  pullDirection,
  variant,
}: {
  isGrabbed: boolean;
  isCaught: boolean;
  pullDirection: 1 | -1;
  variant: VictimVariant;
}) {
  return (
    <motion.div
      className={`terrified-person ${variant}`}
      initial={{ scale: 0.9, y: 10 }}
      animate={isCaught
        ? { opacity: 0, scale: 0.15, filter: 'blur(8px)' }
        : isGrabbed
        ? { x: [0, 4 * pullDirection, 0], y: [0, -3, 0], rotate: [0, 5 * pullDirection, 0], scale: [1, 0.98, 1] }
        : { scale: [0.92, 1, 0.98, 1], y: [10, 0, -2, 0] }}
      transition={{ duration: isCaught ? 0.22 : isGrabbed ? 0.55 : 0.55, ease: 'easeOut' }}
    >
      <motion.div
        className="person-head"
        animate={{ rotate: [-4, 4, -5, 3, 0] }}
        transition={{ duration: 0.45, repeat: Infinity, repeatDelay: 0.2 }}
      >
        <div className="person-hair" />
        <span className="person-brow left" />
        <span className="person-brow right" />
        <span className="person-eye left" />
        <span className="person-eye right" />
        <span className="person-mouth" />
        {variant === 'girl' && isGrabbed && (
          <>
            <span className="tear-stream left" />
            <span className="tear-stream right" />
          </>
        )}
      </motion.div>
      <div className="person-body" />
      <motion.div
        className="person-arm left"
        animate={{ rotate: [150, 162, 146, 158] }}
        transition={{ duration: 0.35, repeat: Infinity, repeatType: 'mirror' }}
      />
      <motion.div
        className="person-arm right"
        animate={{ rotate: [-150, -162, -146, -158] }}
        transition={{ duration: 0.35, repeat: Infinity, repeatType: 'mirror' }}
      />
    </motion.div>
  );
}
