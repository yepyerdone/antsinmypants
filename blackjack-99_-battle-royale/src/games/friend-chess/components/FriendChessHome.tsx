import React, { useState, useEffect } from 'react';
import {
  getFriendChessFirebase,
  signInFriendChessAnonymous,
  signOutFriendChess,
} from '../lib/friendChessFirebase';
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
import { updateProfile } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/friendChessUtils';
import { nanoid } from 'nanoid';
import type { LobbyData, UserProfile } from '../types';
import { DEFAULT_THEME, FC_COLLECTIONS } from '../constants';
import {
  LogOut,
  Plus,
  User,
  LayoutDashboard,
  Settings as SettingsIcon,
  Trophy,
  ChevronRight,
  History,
} from 'lucide-react';
import { motion } from 'motion/react';

interface FriendChessHomeProps {
  onJoinLobby: (id: string) => void;
  onShowHistory: (game?: LobbyData) => void;
  onShowSettings: () => void;
}

export default function FriendChessHome({ onJoinLobby, onShowHistory, onShowSettings }: FriendChessHomeProps) {
  const { db, auth } = getFriendChessFirebase();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tempName, setTempName] = useState('');
  const [recentGames, setRecentGames] = useState<LobbyData[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number>(600);

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

  const handleEnterHall = async () => {
    if (!tempName.trim()) return;
    setLoading(true);
    setAuthError(null);
    try {
      const name = tempName.trim();

      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await updateProfile(auth.currentUser, { displayName: name });
        await ensureUserDoc(auth.currentUser.uid, name);
        setUser({ ...auth.currentUser });
        return;
      }

      if (auth.currentUser?.isAnonymous) {
        await updateProfile(auth.currentUser, { displayName: name });
        await ensureUserDoc(auth.currentUser.uid, name);
        setUser({ ...auth.currentUser });
        return;
      }

      const cred = await signInFriendChessAnonymous();
      const signedIn = cred.user;
      await updateProfile(signedIn, { displayName: name });
      await ensureUserDoc(signedIn.uid, name);
      setUser(signedIn);
    } catch (err: unknown) {
      console.error(err);
      const anyErr = err as { code?: string; message?: string };
      const code = anyErr?.code ?? '';
      const msg = anyErr?.message ?? '';

      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        setAuthError(
          'Anonymous sign-in is turned off for this Firebase project. In Firebase Console → Authentication → Sign-in method, enable Anonymous.',
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'This exact website domain is not allowed to use Firebase Auth. In Firebase Console → Authentication → Settings → Authorized domains, add your production host (e.g. your-app.vercel.app or your custom domain), save, then try again.',
        );
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Network error while contacting Firebase. Check connection, VPN, or ad blockers.');
      } else if (code === 'permission-denied' || msg.includes('permission-denied')) {
        setAuthError(
          'Firestore denied writing your player profile. Publish rules for friendChessUsers (see firestore.friend-chess.rules in the repo) on the same Firebase project you use in production.',
        );
      } else {
        setAuthError(msg || 'Failed to join the hall. Check your connection or Firebase setup.');
      }
    } finally {
      setLoading(false);
    }
  };

  const createLobby = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const code = nanoid(6).toUpperCase();
      const docRef = await addDoc(collection(db, FC_COLLECTIONS.lobbies), {
        code,
        playerW: user.uid,
        whiteName: user.displayName || 'Anonymous',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        status: 'waiting',
        turn: 'w',
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
      handleFirestoreError(err, OperationType.WRITE, FC_COLLECTIONS.lobbies);
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
        blackName: user.displayName || 'Anonymous',
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
          blackName: user.displayName || 'Anonymous',
          status: 'playing',
          'clocks.lastTickAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onJoinLobby(lobbyDoc.id);
      } else {
        const code = `QM-${nanoid(4).toUpperCase()}`;
        const docRef = await addDoc(collection(db, FC_COLLECTIONS.lobbies), {
          code,
          playerW: user.uid,
          whiteName: user.displayName || 'Anonymous',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
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
      setAuthError('Matchmaking failed. Please try again.');
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
          <p className="text-[#888] text-lg mb-10 tracking-wide uppercase font-bold">Friend Chess</p>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="ENTER YOUR NAME"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="w-full bg-fc-bg-dark border border-fc-border-dim rounded-md px-6 py-4 text-center text-lg tracking-widest outline-none focus:border-fc-gold text-white uppercase font-bold"
              maxLength={20}
            />
            {authError && (
              <p className="text-red-500 text-xs bg-red-500/10 p-3 rounded border border-red-500/20 leading-relaxed">{authError}</p>
            )}
            <button
              onClick={handleEnterHall}
              disabled={!tempName.trim() || loading}
              className="w-full bg-fc-gold hover:bg-fc-gold-light text-black font-bold py-4 px-8 rounded-md flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl uppercase tracking-widest text-sm disabled:opacity-50"
            >
              <User size={18} />
              JOIN
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-fc-bg-dark text-[#E0E0E0] font-sans flex overflow-hidden">
      <aside className="w-64 border-r border-fc-border-dim flex flex-col shrink-0 hidden lg:flex">
        <div className="p-8">
          <h1 className="text-xl font-bold tracking-widest text-fc-gold flex items-center gap-2 uppercase">CHESS</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-[#666] mb-4 mt-6">Navigation</div>
          <button className="w-full text-left bg-[#141414] border border-[#222] p-3 rounded-lg flex items-center gap-3 text-white transition-all">
            <LayoutDashboard size={18} />
            <span className="text-sm">Dashboard</span>
          </button>

          <button
            onClick={() => onShowHistory()}
            className="w-full text-left p-3 text-sm text-[#888] hover:bg-[#111] hover:text-white rounded-lg cursor-pointer transition-all flex items-center gap-3"
          >
            <History size={18} />
            <span className="text-sm">History</span>
          </button>
        </nav>

        <div className="p-6 mt-auto border-t border-fc-border-dim">
          <button
            onClick={onShowSettings}
            className="w-full bg-[#1A1A1A] border border-[#333] text-white py-2 rounded-md text-sm hover:bg-[#222] mb-4 transition-colors flex items-center justify-center gap-2"
          >
            <SettingsIcon size={16} />
            Settings
          </button>
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-fc-gold" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-fc-gold to-[#8C7642]"></div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user.displayName}</p>
              <p className="text-[11px] text-[#666] uppercase tracking-wider">Player</p>
            </div>
            <button
              type="button"
              title="Signs out of every game on this site (one Firebase account)."
              onClick={() => void signOutFriendChess()}
              className="ml-auto text-gray-600 hover:text-red-400"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-auto">
        <header className="h-16 border-b border-fc-border-dim flex items-center justify-between px-8 bg-fc-bg-header shrink-0">
          <div className="flex gap-8 text-sm h-full items-center"></div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row p-6 lg:p-12 gap-8 justify-center items-center">
          <div className="w-full max-w-xl space-y-6">
            <div className="bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#666] font-bold mb-4">Select Format</h3>
              <div className="grid grid-cols-3 gap-3">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedTime(opt.seconds)}
                    className={`py-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      selectedTime === opt.seconds
                        ? 'border-fc-gold bg-fc-gold/10 text-fc-gold shadow-[0_0_15px_rgba(196,164,100,0.1)]'
                        : 'border-fc-border-dim bg-[#0d0d0d] text-[#666] hover:border-[#444]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div
                onClick={createLobby}
                className="bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl hover:border-fc-gold transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-fc-gold/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-fc-gold transition-all">
                  <Plus size={24} className="text-fc-gold group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1 uppercase tracking-wider">New Table</h3>
                <p className="text-xs text-[#666] leading-relaxed">Create a private lobby and challenge a friend.</p>
              </div>

              <div
                onClick={handleQuickMatch}
                className={`bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl hover:border-fc-gold transition-all cursor-pointer group relative overflow-hidden ${
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
              </div>
            </div>

            <div className="bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl space-y-6">
              <div>
                <h2 className="text-xs font-bold mb-2 tracking-[0.2em] text-[#666] uppercase">Join with code</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ENTER CODE..."
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-fc-bg-dark border border-fc-border-dim rounded-md px-4 py-3 text-sm uppercase tracking-widest outline-none focus:border-fc-gold text-white font-mono"
                    maxLength={6}
                  />
                  <button
                    onClick={joinLobby}
                    disabled={!joinCode || loading}
                    className="bg-[#222] hover:bg-[#333] px-6 py-3 rounded-md text-xs font-bold tracking-widest disabled:opacity-30 transition-all uppercase"
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
            </div>
          </div>

          <div className="hidden lg:flex w-80 flex-col gap-4">
            <div className="bg-fc-bg-panel border border-fc-border-dim p-6 rounded-xl flex-1 max-h-[400px] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-6 text-[10px] uppercase text-[#666] font-bold tracking-widest">
                Recent Opponents
              </div>
              <div className="space-y-4 flex-1 overflow-auto pr-2">
                {recentGames.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-30">
                    <User size={32} className="mb-4" />
                    <p className="text-[10px] uppercase tracking-widest font-bold">No history yet</p>
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
                  View Full Archives
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
