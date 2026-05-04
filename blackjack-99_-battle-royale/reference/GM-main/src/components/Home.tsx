import React, { useState, useEffect } from 'react';
import { db, auth, signIn, signOut } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { nanoid } from 'nanoid';
import { LobbyData, UserProfile } from '../types';
import { BOARD_THEMES, DEFAULT_THEME } from '../constants';
import { Sword, LogOut, Plus, LogIn, ChevronRight, User, LayoutDashboard, Settings as SettingsIcon, Trophy, HelpCircle, History } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeProps {
  onJoinLobby: (id: string) => void;
  onShowHistory: (game?: LobbyData) => void;
  onShowSettings: () => void;
}

export default function Home({ onJoinLobby, onShowHistory, onShowSettings }: HomeProps) {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tempName, setTempName] = useState('');
  const [recentGames, setRecentGames] = useState<LobbyData[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number>(600); // Default 10 min

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
  }, []);

  useEffect(() => {
    async function fetchRecentGamesAndProfile() {
      if (!user) return;
      try {
        // Fetch profile
        const profileSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
        if (!profileSnap.empty) {
          setUserProfile(profileSnap.docs[0].data() as UserProfile);
        }

        const qW = query(
          collection(db, 'lobbies'), 
          where('playerW', '==', user.uid),
          where('status', '==', 'finished')
        );
        const qB = query(
          collection(db, 'lobbies'), 
          where('playerB', '==', user.uid),
          where('status', '==', 'finished')
        );

        const [snapW, snapB] = await Promise.all([getDocs(qW), getDocs(qB)]);
        
        const gamesList = [...snapW.docs, ...snapB.docs].map(doc => ({
          ...doc.data(),
          id: doc.id
        } as LobbyData));

        // Sort by updatedAt desc
        gamesList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

        setRecentGames(gamesList.slice(0, 3));
      } catch (err) {
        console.error('Error fetching recent games:', err);
      }
    }
    fetchRecentGamesAndProfile();
  }, [user]);

  const handleEnterHall = async () => {
    if (!tempName.trim()) return;
    setLoading(true);
    setAuthError(null);
    try {
      await signIn();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: tempName });
        
        // Ensure Firestore profile exists
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: auth.currentUser.uid,
            displayName: tempName,
            theme: DEFAULT_THEME.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        setUser({ ...auth.currentUser });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        setAuthError('Anonymous Authentication is not enabled. Please go to the Firebase Console > Authentication > Sign-in method and enable "Anonymous".');
      } else {
        setAuthError(err.message || 'Failed to join the hall. Check your connection or Firebase setup.');
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
      const docRef = await addDoc(collection(db, 'lobbies'), {
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
          lastTickAt: null // Will start on first move or join
        },
        theme: userProfile?.theme || DEFAULT_THEME.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onJoinLobby(docRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'lobbies');
    } finally {
      setLoading(false);
    }
  };

  const joinLobby = async () => {
    if (!user || !joinCode) return;
    setLoading(true);
    setAuthError(null);
    try {
      const q = query(collection(db, 'lobbies'), where('code', '==', joinCode.toUpperCase()), where('status', '==', 'waiting'));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setAuthError('Match not found or already full. Check the code and try again.');
        return;
      }

      const lobbyDoc = querySnapshot.docs[0];
      const lobbyData = lobbyDoc.data();

      // If user is already the white player, just enter
      if (lobbyData.playerW === user.uid) {
        onJoinLobby(lobbyDoc.id);
        return;
      }

      await updateDoc(doc(db, 'lobbies', lobbyDoc.id), {
        playerB: user.uid,
        blackName: user.displayName || 'Anonymous',
        status: 'playing',
        'clocks.lastTickAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onJoinLobby(lobbyDoc.id);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('permission-denied')) {
        setAuthError('Permission Denied. You may not be allowed to join this table.');
      } else {
        setAuthError(err.message || 'Error joining match.');
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
      // 1. Look for waiting quick match lobbies created by someone else with the SAME time control
      const q = query(
        collection(db, 'lobbies'), 
        where('status', '==', 'waiting'),
        where('isQuickMatch', '==', true),
        where('timeControl', '==', selectedTime),
        limit(5) // Get a few to avoid potential collisions
      );
      
      const querySnapshot = await getDocs(q);
      const openLobbies = querySnapshot.docs.filter(doc => doc.data().playerW !== user.uid);

      if (openLobbies.length > 0) {
        // Join the first one found
        const lobbyDoc = openLobbies[0];
        await updateDoc(doc(db, 'lobbies', lobbyDoc.id), {
          playerB: user.uid,
          blackName: user.displayName || 'Anonymous',
          status: 'playing',
          'clocks.lastTickAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onJoinLobby(lobbyDoc.id);
      } else {
        // 2. Create a new quick match lobby
        const code = `QM-${nanoid(4).toUpperCase()}`;
        const docRef = await addDoc(collection(db, 'lobbies'), {
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
            lastTickAt: null
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
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center p-6 text-white text-center font-sans">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-md"
        >
          <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 bg-gold blur-3xl opacity-20 -z-10 animate-pulse"></div>
            <h1 className="text-6xl font-bold tracking-[0.2em] text-gold flex justify-center items-center gap-2 uppercase">
              CHESS
            </h1>
          </div>
          <p className="text-[#888] text-lg mb-10 tracking-wide uppercase font-bold">Play Chess</p>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="ENTER YOUR NAME" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="w-full bg-bg-dark border border-border-dim rounded-md px-6 py-4 text-center text-lg tracking-widest outline-none focus:border-gold text-white uppercase font-bold"
              maxLength={20}
            />
            {authError && (
              <p className="text-red-500 text-xs bg-red-500/10 p-3 rounded border border-red-500/20 leading-relaxed">
                {authError}
              </p>
            )}
            <button 
              onClick={handleEnterHall}
              disabled={!tempName.trim() || loading}
              className="w-full bg-gold hover:bg-gold-light text-black font-bold py-4 px-8 rounded-md flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl uppercase tracking-widest text-sm disabled:opacity-50"
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
    <div className="w-full h-screen bg-bg-dark text-[#E0E0E0] font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border-dim flex flex-col shrink-0 hidden lg:flex">
        <div className="p-8">
          <h1 className="text-xl font-bold tracking-widest text-gold flex items-center gap-2 uppercase">
            CHESS
          </h1>
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

        <div className="p-6 mt-auto border-t border-border-dim">
          <button 
            onClick={onShowSettings}
            className="w-full bg-[#1A1A1A] border border-[#333] text-white py-2 rounded-md text-sm hover:bg-[#222] mb-4 transition-colors flex items-center justify-center gap-2"
          >
            <SettingsIcon size={16} />
            Settings
          </button>
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-gold" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gold to-[#8C7642]"></div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user.displayName}</p>
              <p className="text-[11px] text-[#666] uppercase tracking-wider">Player</p>
            </div>
            <button onClick={signOut} className="ml-auto text-gray-600 hover:text-red-400">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-auto">
        <header className="h-16 border-b border-border-dim flex items-center justify-between px-8 bg-bg-header shrink-0">
          <div className="flex gap-8 text-sm h-full items-center">
          </div>
          

        </header>

        <div className="flex-1 flex flex-col lg:flex-row p-6 lg:p-12 gap-8 justify-center items-center">
          {/* Welcome/Action Section */}
          <div className="w-full max-w-xl space-y-6">
            {/* Time Control Selection */}
            <div className="bg-bg-panel border border-border-dim p-6 rounded-xl">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#666] font-bold mb-4">Select Format</h3>
              <div className="grid grid-cols-3 gap-3">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedTime(opt.seconds)}
                    className={`py-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      selectedTime === opt.seconds 
                        ? 'border-gold bg-gold/10 text-gold shadow-[0_0_15px_rgba(196,164,100,0.1)]' 
                        : 'border-border-dim bg-[#0d0d0d] text-[#666] hover:border-[#444]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Create Card */}
              <div 
                onClick={createLobby}
                className="bg-bg-panel border border-border-dim p-6 rounded-xl hover:border-gold transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-gold transition-all">
                  <Plus size={24} className="text-gold group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1 uppercase tracking-wider">New Table</h3>
                <p className="text-xs text-[#666] leading-relaxed">Create a private lobby and challenge a friend.</p>
              </div>

              {/* Quick Match Card */}
              <div 
                onClick={handleQuickMatch}
                className={`bg-bg-panel border border-border-dim p-6 rounded-xl hover:border-gold transition-all cursor-pointer group relative overflow-hidden ${isMatching ? 'pointer-events-none' : ''}`}
              >
                {isMatching && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-10"
                  >
                    <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-bold tracking-widest text-gold uppercase">Searching...</span>
                  </motion.div>
                )}
                <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-gold transition-all">
                  <Trophy size={24} className="text-gold group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1 uppercase tracking-wider">Quick Match</h3>
                <p className="text-xs text-[#666] leading-relaxed">Find a random opponent.</p>
              </div>
            </div>

            {/* Join Box */}
            <div className="bg-bg-panel border border-border-dim p-6 rounded-xl space-y-6">
              <div>
                <h2 className="text-xs font-bold mb-2 tracking-[0.2em] text-[#666] uppercase">Join with code</h2>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="ENTER CODE..." 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-bg-dark border border-border-dim rounded-md px-4 py-3 text-sm uppercase tracking-widest outline-none focus:border-gold text-white font-mono"
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

          {/* Recent Opponents Section */}
          <div className="hidden lg:flex w-80 flex-col gap-4">
            <div className="bg-bg-panel border border-border-dim p-6 rounded-xl flex-1 max-h-[400px] overflow-hidden flex flex-col">
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
                    const result = game.winner === (game.playerW === user?.uid ? 'White' : 'Black') ? 'Victory' : (game.winner === 'Draw' ? 'Draw' : 'Defeat');
                    
                    return (
                      <div 
                        key={game.id} 
                        onClick={() => onShowHistory(game)}
                        className="flex items-center gap-4 group cursor-pointer"
                      >
                        <div className={`w-10 h-10 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center font-bold group-hover:border-gold transition-all ${result === 'Victory' ? 'text-gold' : 'text-[#666]'}`}>
                          {opponentName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-white truncate">{opponentName}</p>
                          <p className={`text-[10px] uppercase tracking-tighter font-bold ${result === 'Victory' ? 'text-gold' : 'text-[#444]'}`}>
                            {result} • {game.code}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-[#333] group-hover:text-gold" />
                      </div>
                    );
                  })
                )}
              </div>
              
              {recentGames.length > 0 && (
                <button 
                  onClick={() => onShowHistory()}
                  className="mt-6 w-full py-3 bg-[#111] border border-[#222] rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-gold hover:border-gold transition-all"
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
