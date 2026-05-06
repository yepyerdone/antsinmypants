import React, { useState, useEffect } from 'react';
import { getFriendChessFirebase } from '../lib/friendChessFirebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/friendChessUtils';
import { nanoid } from 'nanoid';
import type { LobbyData, UserProfile } from '../types';
import { BOT_DIFFICULTIES, DEFAULT_THEME, FC_COLLECTIONS } from '../constants';
import {
  Bot,
  Plus,
  User,
  Trophy,
  ChevronRight,
  Crown,
  Castle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { usePlayerIdentity } from '../../../hooks/usePlayerIdentity';

type LobbyVariant = 'standard' | 'chess960';

interface FriendChessHomeProps {
  onJoinLobby: (id: string) => void;
  onStartBotGame: (difficultyId: string, timeControl: number) => void;
  onShowHistory: (game?: LobbyData) => void;
}

const generateChess960FEN = (): string => {
  const positions: string[] = Array(8).fill('');
  const pickRandom = (items: number[]) => items.splice(Math.floor(Math.random() * items.length), 1)[0];

  const evenSquares = [0, 2, 4, 6];
  const oddSquares = [1, 3, 5, 7];
  positions[pickRandom(evenSquares)] = 'B';
  positions[pickRandom(oddSquares)] = 'B';

  const remainingAfterBishops = positions
    .map((value, index) => (value === '' ? index : -1))
    .filter((index): index is number => index !== -1);
  positions[pickRandom(remainingAfterBishops)] = 'Q';

  const remainingAfterQueen = positions
    .map((value, index) => (value === '' ? index : -1))
    .filter((index): index is number => index !== -1);
  positions[pickRandom(remainingAfterQueen)] = 'N';
  positions[pickRandom(remainingAfterQueen)] = 'N';

  const remaining = positions
    .map((value, index) => (value === '' ? index : -1))
    .filter((index): index is number => index !== -1)
    .sort((a, b) => a - b);

  positions[remaining[0]] = 'R';
  positions[remaining[1]] = 'K';
  positions[remaining[2]] = 'R';

  const whiteBackrank = positions.join('');
  const blackBackrank = positions.map((piece) => piece.toLowerCase()).join('');

  return `${blackBackrank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteBackrank} w KQkq - 0 1`;
};

export default function FriendChessHome({ onJoinLobby, onStartBotGame, onShowHistory }: FriendChessHomeProps) {
  const { db, auth } = getFriendChessFirebase();
  const { playerName } = usePlayerIdentity();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [recentGames, setRecentGames] = useState<LobbyData[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number>(600);
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState(BOT_DIFFICULTIES[2].id);

  const TIME_OPTIONS = [
    { label: 'Bullet 1m', seconds: 60, icon: 'Zap' },
    { label: 'Blitz 3m', seconds: 180, icon: 'Flame' },
    { label: 'Rapid 10m', seconds: 600, icon: 'Clock' },
  ];

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return unsub;
  }, [auth]);

  useEffect(() => {
    async function fetchRecentGamesAndProfile() {
      if (!user) return;
      try {
        const userRef = doc(db, FC_COLLECTIONS.users, user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        }

        const qW = query(
          collection(db, FC_COLLECTIONS.lobbies),
          where('playerW', '==', user.uid),
          where('status', '==', 'finished'),
        );
        const qB = query(
          collection(db, FC_COLLECTIONS.lobbies),
          where('playerB', '==', user.uid),
          where('status', '==', 'finished'),
        );

        const [snapW, snapB] = await Promise.all([getDocs(qW), getDocs(qB)]);

        const gamesList = [...snapW.docs, ...snapB.docs].map(
          (d) =>
            ({
              ...d.data(),
              id: d.id,
            }) as LobbyData,
        );

        gamesList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

        setRecentGames(gamesList.slice(0, 3));
      } catch (err) {
        console.error('Error fetching recent games:', err);
      }
    }
    fetchRecentGamesAndProfile();
  }, [user, db]);

  const ensureUserDoc = async (uid: string, displayName: string) => {
    const userRef = doc(db, FC_COLLECTIONS.users, uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName,
        theme: DEFAULT_THEME.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  useEffect(() => {
    if (!user) return;
    ensureUserDoc(user.uid, playerName).catch((err) => {
      console.error('Failed to sync friend chess user profile:', err);
    });
  }, [user, playerName]);

  const createLobby = async (variant: LobbyVariant = 'standard') => {
    if (!user) return;
    setLoading(true);
    setAuthError(null);
    try {
      const code = nanoid(6).toUpperCase();
      const isChess960 = variant === 'chess960';
      const initialFen = isChess960
        ? generateChess960FEN()
        : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      const docRef = await addDoc(collection(db, FC_COLLECTIONS.lobbies), {
        code,
        playerW: user.uid,
        whiteName: playerName,
        fen: initialFen,
        initialFen,
        status: 'waiting',
        turn: 'w',
        variant,
        moves: [],
        moveCount: 0,
        timeControl: selectedTime,
        clocks: {
          w: selectedTime,
          b: selectedTime,
          lastTickAt: null,
        },
        theme: userProfile?.theme || DEFAULT_THEME.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onJoinLobby(docRef.id);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, FC_COLLECTIONS.lobbies);
      } catch {
        // The helper logs detailed auth/path context for debugging.
      }
      const message = err instanceof Error ? err.message : '';
      setAuthError(
        message.includes('permission-denied')
          ? 'Permission denied creating table. Firestore rules may need to be deployed.'
          : message || 'Could not create table. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const joinLobby = async () => {
    if (!user || !joinCode) return;
    setLoading(true);
    setAuthError(null);
    try {
      const q = query(
        collection(db, FC_COLLECTIONS.lobbies),
        where('code', '==', joinCode.toUpperCase()),
        where('status', '==', 'waiting'),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setAuthError('Match not found or already full. Check the code and try again.');
        return;
      }

      const lobbyDoc = querySnapshot.docs[0];
      const lobbyData = lobbyDoc.data();

      if (lobbyData.playerW === user.uid) {
        onJoinLobby(lobbyDoc.id);
        return;
      }

      await updateDoc(doc(db, FC_COLLECTIONS.lobbies, lobbyDoc.id), {
        playerB: user.uid,
        blackName: playerName,
        status: 'playing',
        'clocks.lastTickAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onJoinLobby(lobbyDoc.id);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : '';
      if (msg?.includes('permission-denied')) {
        setAuthError('Permission Denied. You may not be allowed to join this table.');
      } else {
        setAuthError(msg || 'Error joining match.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickMatch = async () => {
    if (!user) return;
    setLoading(true);
    setIsMatching(true);
    setAuthError(null);

    try {
      const q = query(
        collection(db, FC_COLLECTIONS.lobbies),
        where('status', '==', 'waiting'),
        where('isQuickMatch', '==', true),
        where('timeControl', '==', selectedTime),
        limit(5),
      );

      const querySnapshot = await getDocs(q);
      const openLobbies = querySnapshot.docs.filter((d) => d.data().playerW !== user.uid);

      if (openLobbies.length > 0) {
        const lobbyDoc = openLobbies[0];
        await updateDoc(doc(db, FC_COLLECTIONS.lobbies, lobbyDoc.id), {
          playerB: user.uid,
          blackName: playerName,
          status: 'playing',
          'clocks.lastTickAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onJoinLobby(lobbyDoc.id);
      } else {
        const code = `QM-${nanoid(4).toUpperCase()}`;
        const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const docRef = await addDoc(collection(db, FC_COLLECTIONS.lobbies), {
          code,
          playerW: user.uid,
          whiteName: playerName,
          fen: initialFen,
          initialFen,
          variant: 'standard',
          status: 'waiting',
          turn: 'w',
          moveCount: 0,
          isQuickMatch: true,
          timeControl: selectedTime,
          clocks: {
            w: selectedTime,
            b: selectedTime,
            lastTickAt: null,
          },
          theme: userProfile?.theme || DEFAULT_THEME.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onJoinLobby(docRef.id);
      }
    } catch (err) {
      console.error('Quick Match Error:', err);
      const message = err instanceof Error ? err.message : '';
      setAuthError(
        message.includes('permission-denied')
          ? 'Matchmaking denied by Firestore rules. Deploy the updated rules and try again.'
          : message.includes('index')
            ? 'Matchmaking needs a Firestore index for this query.'
            : 'Matchmaking failed. Please try again.',
      );
    } finally {
      setLoading(false);
      setIsMatching(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-fc-bg-dark flex flex-col items-center justify-center p-6 text-white text-center font-sans">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-md"
        >
          <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 bg-fc-gold blur-3xl opacity-20 -z-10 animate-pulse"></div>
            <h1 className="text-6xl font-bold tracking-[0.2em] text-fc-gold flex justify-center items-center gap-2 uppercase">
              CHESS
            </h1>
          </div>
          <p className="text-[#888] text-lg mb-10 tracking-wide uppercase font-bold">Chess</p>

          <div className="space-y-4">
            {authError && (
              <p className="text-red-500 text-xs bg-red-500/10 p-3 rounded border border-red-500/20 leading-relaxed">{authError}</p>
            )}
            <div className="w-full bg-fc-bg-dark border border-fc-border-dim rounded-md px-6 py-4 text-center text-sm tracking-widest text-[#888] uppercase font-bold">
              Use the site start screen to choose Google, email, or guest mode.
            </div>
            <button
              onClick={() => window.location.assign('/')}
              disabled={loading}
              className="w-full bg-fc-gold hover:bg-fc-gold-light text-black font-bold py-4 px-8 rounded-md flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl uppercase tracking-widest text-sm disabled:opacity-50"
            >
              <User size={18} />
              Back to Site Sign In
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className="friend-chess-dashboard-view flex-1 flex flex-col overflow-auto">
        <header className="friend-chess-topbar h-16 border-b border-fc-border-dim flex items-center justify-between px-8 bg-fc-bg-header shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-fc-gold font-black">Dashboard</p>
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Choose your table</h2>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#9a9a9a] font-bold">
            <Castle size={16} className="text-fc-gold" />
            Play friends, quick matches, or the computer
          </div>
        </header>

        <div className="friend-chess-dashboard flex-1 flex flex-col lg:flex-row p-6 lg:p-12 gap-8 justify-center items-center">
          <div className="friend-chess-primary-column w-full max-w-xl space-y-6">
            <section className="friend-chess-panel friend-chess-time-panel bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-fc-gold font-black">Time Control</h3>
                  <p className="text-sm text-[#b8b8b8] font-semibold mt-1">Pick a clock for new tables and computer games.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedTime(opt.seconds)}
                    className={`friend-chess-time-option py-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      selectedTime === opt.seconds
                        ? 'is-selected border-fc-gold bg-fc-gold/10 text-fc-gold shadow-[0_0_15px_rgba(196,164,100,0.1)]'
                        : 'border-fc-border-dim bg-[#0d0d0d] text-[#666] hover:border-[#444]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <div className="grid sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => void createLobby('standard')}
                disabled={loading}
                className="friend-chess-action-card bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl hover:border-fc-gold transition-all cursor-pointer group text-left disabled:opacity-60 disabled:cursor-wait"
              >
                <div className="w-12 h-12 bg-fc-gold/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-fc-gold transition-all">
                  <Plus size={24} className="text-fc-gold group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1 uppercase tracking-wider">New Table</h3>
                <p className="text-xs text-[#666] leading-relaxed">Create a standard table with the classic chess setup.</p>
              </button>

              <button
                type="button"
                onClick={() => void createLobby('chess960')}
                disabled={loading}
                className="friend-chess-action-card bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl hover:border-fc-gold transition-all cursor-pointer group text-left disabled:opacity-60 disabled:cursor-wait"
              >
                <div className="w-12 h-12 bg-fc-gold/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-fc-gold transition-all">
                  <Crown size={24} className="text-fc-gold group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1 uppercase tracking-wider">New Fischer Table</h3>
                <p className="text-xs text-[#666] leading-relaxed">Create a Chess960 table with randomized back-rank pieces.</p>
              </button>

              <button
                type="button"
                onClick={() => void handleQuickMatch()}
                disabled={loading}
                className={`friend-chess-action-card bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl hover:border-fc-gold transition-all cursor-pointer group relative overflow-hidden text-left disabled:opacity-60 disabled:cursor-wait ${
                  isMatching ? 'pointer-events-none' : ''
                }`}
              >
                {isMatching && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-10"
                  >
                    <div className="w-5 h-5 border-2 border-fc-gold border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-bold tracking-widest text-fc-gold uppercase">Searching...</span>
                  </motion.div>
                )}
                <div className="w-12 h-12 bg-fc-gold/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-fc-gold transition-all">
                  <Trophy size={24} className="text-fc-gold group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1 uppercase tracking-wider">Quick Match</h3>
                <p className="text-xs text-[#666] leading-relaxed">Find a random opponent.</p>
              </button>
            </div>

            <section className="friend-chess-panel friend-chess-computer-panel bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xs font-bold mb-2 tracking-[0.2em] text-fc-gold uppercase">Play vs Computer</h2>
                  <p className="text-sm text-[#b8b8b8] leading-relaxed font-semibold">Choose a difficulty and play a local game against the computer.</p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartBotGame(selectedBotDifficulty, selectedTime)}
                  className="friend-chess-primary-button bg-fc-gold hover:bg-fc-gold-light text-black px-5 py-3 rounded-md text-xs font-bold tracking-widest transition-all uppercase flex items-center gap-2 shrink-0"
                >
                  <Bot size={16} />
                  Play vs Computer
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {BOT_DIFFICULTIES.map((difficulty) => (
                  <button
                    key={difficulty.id}
                    type="button"
                    onClick={() => setSelectedBotDifficulty(difficulty.id)}
                    className={`friend-chess-difficulty border rounded-lg px-3 py-3 text-left transition-all ${
                      selectedBotDifficulty === difficulty.id
                        ? 'is-selected border-fc-gold bg-fc-gold/10 text-fc-gold'
                        : 'border-fc-border-dim bg-[#0d0d0d] text-[#888] hover:border-[#444]'
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-widest font-bold">{difficulty.name}</span>
                    <span className="block text-[10px] uppercase tracking-wider opacity-70 mt-1">{difficulty.estimatedElo}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="friend-chess-panel friend-chess-join-panel bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl space-y-6">
              <div>
                <h2 className="text-xs font-bold mb-2 tracking-[0.2em] text-fc-gold uppercase">Join with code</h2>
                <p className="text-sm text-[#b8b8b8] font-semibold mb-4">Enter a six-character table code from a friend.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ENTER CODE..."
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="friend-chess-code-input flex-1 bg-fc-bg-dark border border-fc-border-dim rounded-md px-4 py-3 text-sm uppercase tracking-widest outline-none focus:border-fc-gold text-white font-mono"
                    maxLength={6}
                  />
                  <button
                    onClick={joinLobby}
                    disabled={!joinCode || loading}
                    className="friend-chess-secondary-button bg-[#222] hover:bg-[#333] px-6 py-3 rounded-md text-xs font-bold tracking-widest disabled:opacity-30 transition-all uppercase"
                  >
                    JOIN
                  </button>
                </div>
                {authError && (
                  <p className="text-red-500 text-[10px] bg-red-500/5 p-2 rounded border border-red-500/10 text-center uppercase tracking-tighter mt-4">
                    {authError}
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="hidden lg:flex w-80 flex-col gap-4">
            <div className="friend-chess-panel friend-chess-recent-panel bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl flex-1 max-h-[400px] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-6 text-[10px] uppercase text-[#666] font-bold tracking-widest">
                Recent Opponents
              </div>
              <div className="space-y-4 flex-1 overflow-auto pr-2">
                {recentGames.length === 0 ? (
                  <div className="friend-chess-empty-state flex flex-col items-center justify-center h-full py-20 text-center">
                    <Castle size={36} className="mb-4 text-fc-gold" />
                    <p className="text-sm text-white uppercase tracking-widest font-black">No games yet</p>
                    <p className="text-xs text-[#9a9a9a] mt-2 max-w-[12rem]">Recent opponents appear after your completed games.</p>
                  </div>
                ) : (
                  recentGames.map((game) => {
                    const opponentName = game.playerW === user?.uid ? game.blackName : game.whiteName;
                    const result =
                      game.winner === (game.playerW === user?.uid ? 'White' : 'Black')
                        ? 'Victory'
                        : game.winner === 'Draw'
                          ? 'Draw'
                          : 'Defeat';

                    return (
                      <div
                        key={game.id}
                        onClick={() => onShowHistory(game)}
                        className="flex items-center gap-4 group cursor-pointer"
                      >
                        <div
                          className={`w-10 h-10 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center font-bold group-hover:border-fc-gold transition-all ${
                            result === 'Victory' ? 'text-fc-gold' : 'text-[#666]'
                          }`}
                        >
                          {opponentName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-white truncate">{opponentName}</p>
                          <p
                            className={`text-[10px] uppercase tracking-tighter font-bold ${
                              result === 'Victory' ? 'text-fc-gold' : 'text-[#444]'
                            }`}
                          >
                            {result} • {game.code}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-[#333] group-hover:text-fc-gold" />
                      </div>
                    );
                  })
                )}
              </div>

              {recentGames.length > 0 && (
                <button
                  onClick={() => onShowHistory()}
                  className="mt-6 w-full py-3 bg-[#111] border border-[#222] rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-fc-gold hover:border-fc-gold transition-all"
                >
                  View All Games
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
