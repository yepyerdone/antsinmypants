import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Play, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Timer, 
  Target,
  User,
  LogIn,
  Crown
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocFromServer,
  doc
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { GameState, Score, Mole } from './types';
import { db, auth, signInWithGoogle } from './firebase';

// Constants
const INITIAL_TIME = 10;
const TIME_BONUS = 3;
const MOLES_FOR_BONUS = 10;
const GRID_SIZE = 15;
const MIN_POP_DELAY = 400;
const MAX_POP_DELAY = 1200;
const POP_DURATION = 1000;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

type HitBurst = {
  id: number;
  moleId: number;
  label: string;
  type: Mole['type'];
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [moles, setMoles] = useState<Mole[]>(
    Array.from({ length: GRID_SIZE }, (_, i) => ({ id: i, active: false, type: 'standard' }))
  );
  const [molesInCurrentLevel, setMolesInCurrentLevel] = useState(0);
  const [highScores, setHighScores] = useState<Score[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hitBursts, setHitBursts] = useState<HitBurst[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const spawnCountRef = useRef(0);

  const scoreRef = useRef(score);
  const timeLeftRef = useRef(timeLeft);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && !playerName) {
        setPlayerName(u.displayName?.split(' ')[0] || 'Player');
      }
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, [playerName]);

  // Leaderboard Listener
  useEffect(() => {
    const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map(doc => doc.data() as Score);
      setHighScores(scores);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'scores');
    });

    return () => unsubscribe();
  }, []);

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3');
    audioRef.current.loop = true;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle Mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (!isMuted && gameState === GameState.PLAYING) {
        audioRef.current.play().catch(() => console.log('Audio autoplay blocked'));
      }
    }
  }, [isMuted, gameState]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === GameState.PLAYING && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState(GameState.GAME_OVER);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, timeLeft]);

  // Game Logic: Pop Moles
  const spawnMole = useCallback(() => {
    setMoles((prev) => {
      const inactiveIndices = prev
        .map((m, i) => (!m.active ? i : -1))
        .filter((i) => i !== -1);
      
      if (inactiveIndices.length === 0) return prev;
      
      const randomIndex = inactiveIndices[Math.floor(Math.random() * inactiveIndices.length)];
      
      // Determine if this is a special mole
      spawnCountRef.current += 1;
      const isGolden = spawnCountRef.current % 10 === 0;
      const isRed = !isGolden && spawnCountRef.current % 7 === 0;

      const newMoles = [...prev];
      newMoles[randomIndex] = { 
        ...newMoles[randomIndex], 
        active: true, 
        type: isGolden ? 'golden' : (isRed ? 'red' : 'standard') 
      };
      
      // Calculate pop duration based on score (decreases after 25)
      const currentPopDuration = scoreRef.current >= 25 
        ? Math.max(400, POP_DURATION - (scoreRef.current - 25) * 15) 
        : POP_DURATION;

      // Auto-hide mole after duration
      setTimeout(() => {
        setMoles((current) => {
          const updated = [...current];
          if (updated[randomIndex]) {
            updated[randomIndex] = { ...updated[randomIndex], active: false };
          }
          return updated;
        });
      }, currentPopDuration);
      
      return newMoles;
    });
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const gameLoop = () => {
      if (gameState !== GameState.PLAYING) return;

      spawnMole();

      const currentDelay = Math.max(
        MIN_POP_DELAY,
        MAX_POP_DELAY - (scoreRef.current * 5) - ((INITIAL_TIME - timeLeftRef.current) * 10)
      );

      timeoutId = setTimeout(gameLoop, currentDelay);
    };

    if (gameState === GameState.PLAYING) {
      gameLoop();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [gameState, spawnMole]); // Removed score and timeLeft from dependencies to prevent resets

  const whackMole = (id: number) => {
    if (gameState !== GameState.PLAYING) return;
    
    setMoles((prev) => {
      if (!prev[id].active) return prev;
      
      const mole = prev[id];
      let bonus = 0;
      let scoreInc = 1;

      if (mole.type === 'golden') {
        bonus = 3;
      } else if (mole.type === 'red') {
        bonus = -5;
        scoreInc = 0; // Penalty mole doesn't give score
      } else {
        bonus = 1;
      }

      const burstId = Date.now() + Math.random();
      const label = mole.type === 'golden' ? '+3s' : mole.type === 'red' ? '-5s' : '+1';
      setHitBursts((bursts) => [...bursts, { id: burstId, moleId: id, label, type: mole.type }]);
      window.setTimeout(() => {
        setHitBursts((bursts) => bursts.filter((burst) => burst.id !== burstId));
      }, 700);

      const newMoles = [...prev];
      newMoles[id] = { ...newMoles[id], active: false };
      
      // Update score and bonuses
      setScore((s) => s + scoreInc);
      setTimeLeft((t) => Math.max(0, t + bonus));
      
      return newMoles;
    });
  };

  const startGame = () => {
    if (!playerName.trim()) {
       alert("Please enter a nickname!");
       return;
    }
    setScore(0);
    setTimeLeft(INITIAL_TIME);
    spawnCountRef.current = 0;
    setMolesInCurrentLevel(0);
    setMoles(Array.from({ length: GRID_SIZE }, (_, i) => ({ id: i, active: false, type: 'standard' })));
    setGameState(GameState.PLAYING);
  };

  const submitScore = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'scores'), {
        playerName: playerName.slice(0, 15),
        score: score,
        userId: user.uid,
        timestamp: Date.now()
      });
      setGameState(GameState.START);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'scores');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetGame = () => {
    setGameState(GameState.START);
  };

  return (
    <div className="mole-mania-shell min-h-screen bg-[#FFDE59] font-sans flex flex-col select-none">
      {/* Header Section */}
      <header className="mole-mania-header flex items-center justify-between px-8 py-6 bg-[#FFBD59] shadow-md border-b-4 border-[#F5A623] sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <div className="mole-mania-stat mole-mania-stat--time bg-[#FF5757] text-white px-6 py-2 rounded-full border-4 border-white shadow-lg flex flex-col items-center">
            <span className="text-[10px] uppercase font-black tracking-widest block opacity-80">Time Left</span>
            <span className={`text-3xl font-bold leading-none tabular-nums ${timeLeft < 10 ? 'animate-pulse' : ''}`}>{timeLeft}s</span>
          </div>
          <div className="mole-mania-stat mole-mania-stat--score bg-[#54D2D2] text-white px-6 py-2 rounded-full border-4 border-white shadow-lg flex flex-col items-center">
            <span className="text-[10px] uppercase font-black tracking-widest block opacity-80">Score</span>
            <span className="text-3xl font-bold leading-none tabular-nums">{score.toLocaleString()}</span>
          </div>
        </div>
        
        <h1 className="mole-mania-title hidden md:block text-5xl lg:text-6xl font-black text-[#8B4513] drop-shadow-sm uppercase tracking-tighter italic">Mole Mania!</h1>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex bg-white p-3 rounded-2xl shadow-inner border-2 border-[#8B4513] flex-col items-end">
            <span className="text-[10px] font-bold text-[#8B4513] uppercase leading-none mb-1">Signed In As</span>
            <span className="text-sm font-black text-[#8B4513]">{user ? user.displayName?.split(' ')[0] : 'Guest'}</span>
          </div>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="w-14 h-14 bg-[#7ED957] rounded-full border-4 border-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            {isMuted ? <VolumeX className="text-white" size={24} /> : <Volume2 className="text-white" size={24} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row px-4 sm:px-6 py-4 gap-6 max-w-[1400px] mx-auto w-full">
        
        {/* Game Area */}
        <div className="mole-mania-board relative flex-1 bg-[#4CAF50] rounded-[32px] border-b-[10px] border-[#388E3C] shadow-2xl p-4 sm:p-6 flex flex-col items-center justify-center min-h-[400px]">
          <div className="mole-mania-skyline" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="mole-mania-grid grid grid-cols-5 gap-2 sm:gap-3 w-full max-w-3xl">
            {moles.map((mole) => (
              <div 
                key={mole.id}
                className={`mole-mania-hole relative bg-[#3E2723] rounded-full aspect-square shadow-[inset_0_10px_20px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-crosshair overflow-hidden ${mole.active ? 'mole-mania-hole--active' : ''} ${mole.active ? `mole-mania-hole--${mole.type}` : ''}`}
                onClick={() => whackMole(mole.id)}
              >
                <span className="mole-mania-hole-rim" />
                <span className="mole-mania-hole-shadow" />
                <AnimatePresence>
                  {mole.active && (
                    <motion.div
                      initial={{ y: 110, rotate: -8, scale: 0.84 }}
                      animate={{ y: 0, rotate: 0, scale: 1 }}
                      exit={{ y: 105, rotate: 8, scale: 0.82 }}
                      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                      className="absolute inset-0 flex items-center justify-center p-2 sm:p-4 z-10"
                    >
                      <div className={`mole-mania-mole w-full h-full rounded-t-full border-4 shadow-lg relative ${
                        mole.type === 'golden' ? 'bg-yellow-400 border-yellow-600 shadow-[0_0_15px_rgba(253,224,71,0.5)]' : 
                        mole.type === 'red' ? 'bg-red-500 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)]' :
                        'bg-[#8D6E63] border-[#5D4037]'
                      }`}>
                        <span className="mole-mania-ear mole-mania-ear--left" />
                        <span className="mole-mania-ear mole-mania-ear--right" />
                        <div className="mole-mania-eye absolute top-1/4 left-[15%] w-[18%] h-[18%] bg-black rounded-full" />
                        <div className="mole-mania-eye absolute top-1/4 right-[15%] w-[18%] h-[18%] bg-black rounded-full" />
                        <div className={`mole-mania-nose absolute top-1/2 left-1/2 -translate-x-1/2 w-[25%] h-[12%] rounded-full ${
                          mole.type === 'golden' ? 'bg-orange-300' : 
                          mole.type === 'red' ? 'bg-red-300' :
                          'bg-[#F48FB1]'
                        }`} />
                        <span className="mole-mania-tooth mole-mania-tooth--left" />
                        <span className="mole-mania-tooth mole-mania-tooth--right" />
                        <span className="mole-mania-paw mole-mania-paw--left" />
                        <span className="mole-mania-paw mole-mania-paw--right" />
                        {mole.type === 'golden' && (
                          <div className="mole-mania-crown absolute -top-4 left-1/2 -translate-y-1/2">
                            <Crown size={16} className="text-yellow-600 fill-yellow-400" />
                          </div>
                        )}
                        {mole.type === 'red' && (
                          <div className="mole-mania-target absolute -top-4 left-1/2 -translate-y-1/2">
                            <Target size={16} className="text-red-700" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {hitBursts.filter((burst) => burst.moleId === mole.id).map((burst) => (
                    <motion.span
                      key={burst.id}
                      initial={{ opacity: 0, y: 8, scale: 0.6 }}
                      animate={{ opacity: 1, y: -30, scale: 1.1 }}
                      exit={{ opacity: 0, y: -44, scale: 0.9 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className={`mole-mania-hit-burst mole-mania-hit-burst--${burst.type}`}
                    >
                      {burst.label}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Overlays */}
          <AnimatePresence>
            {gameState === GameState.START && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[40px] flex flex-col items-center justify-center p-8 text-center z-20 m-2"
              >
                <div className="bg-white p-8 rounded-[32px] border-b-8 border-gray-200 shadow-xl max-w-md w-full">
                  <h2 className="text-4xl font-black text-[#8B4513] uppercase tracking-tighter italic mb-4">Ready to Rumble?</h2>
                  <p className="text-gray-600 font-bold mb-8">Moles +1s. Golden +3s. Avoid Red moles (-5s)!</p>
                  
                  <div className="space-y-4 mb-8">
                    <input 
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Your Nickname"
                      className="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-[#FFBD59] transition-all font-bold text-center"
                      maxLength={15}
                    />
                    {!user && (
                      <button 
                        onClick={signInWithGoogle}
                        className="text-xs font-bold text-[#54D2D2] hover:underline uppercase tracking-widest"
                      >
                        Sign in for global rankings
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={startGame}
                    className="w-full bg-[#7ED957] hover:bg-[#6ec949] text-white font-black py-5 rounded-2xl shadow-[0_8px_0_#388E3C] hover:shadow-[0_4px_0_#388E3C] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all uppercase tracking-widest text-xl"
                  >
                    Play Now!
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === GameState.GAME_OVER && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-[#FF5757]/90 backdrop-blur-md rounded-[40px] flex flex-col items-center justify-center p-8 text-center z-20 m-2"
              >
                <div className="bg-white p-10 rounded-[40px] shadow-2xl border-b-8 border-gray-200 max-w-md w-full">
                  <h2 className="text-5xl font-black text-[#FF5757] uppercase tracking-tighter italic mb-2">Time Up!</h2>
                  <p className="text-gray-400 font-black uppercase text-xs tracking-widest mb-6">Final Score</p>
                  <div className="text-7xl font-black text-[#8B4513] mb-10">{score}</div>
                  
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={startGame}
                      className="w-full bg-[#54D2D2] hover:bg-[#48b9b9] text-white font-black py-4 rounded-2xl shadow-[0_6px_0_#39a0a0] transition-all uppercase tracking-widest"
                    >
                      Try Again
                    </button>
                    <button 
                      onClick={submitScore}
                      disabled={isSubmitting}
                      className="w-full bg-[#FFBD59] hover:bg-[#f5a623] text-white font-black py-4 rounded-2xl shadow-[0_6px_0_#d9921f] transition-all uppercase tracking-widest disabled:opacity-50"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit to Board'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Leaderboard Sidebar */}
        <aside className="w-full lg:w-80 bg-white rounded-[40px] border-b-[8px] border-[#E0E0E0] p-6 flex flex-col shadow-xl h-fit sticky lg:top-32">
          <h2 className="text-center text-3xl font-black text-[#54D2D2] uppercase tracking-tighter italic mb-6">Hall of Fame</h2>
          
          <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {highScores.length > 0 ? highScores.map((s, i) => (
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={s.timestamp} 
                className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                  i === 0 ? 'bg-[#FFF9C4] border-[#FFD700]' : 
                  i === 1 ? 'bg-[#F5F5F5] border-[#BDBDBD]' : 
                  i === 2 ? 'bg-[#EFEBE9] border-[#A1887F]' : 
                  'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-black ${
                    i === 0 ? 'text-[#FBC02D]' : 
                    i === 1 ? 'text-gray-400' : 
                    i === 2 ? 'text-[#8D6E63]' : 
                    'text-gray-300'
                  }`}>
                    {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}.`}
                  </span>
                  <span className="font-bold text-gray-700 truncate max-w-[100px]">{s.playerName}</span>
                </div>
                <span className="font-black tabular-nums text-gray-800">{s.score.toLocaleString()}</span>
              </motion.div>
            )) : (
              <div className="py-8 text-center text-gray-300 font-bold italic animate-pulse">
                Fetching legends...
              </div>
            )}
          </div>
          
          <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-100 flex flex-col items-center">
             {!user && (
               <button 
                 onClick={signInWithGoogle}
                 className="text-[10px] font-black text-[#54D2D2] uppercase tracking-[0.2em] mb-2 hover:underline"
               >
                 Sign in to participate
               </button>
             )}
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-[#7ED957] rounded-full animate-pulse" />
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Live Feed</span>
             </div>
          </div>
        </aside>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-20 sm:h-16 px-10 flex flex-col sm:flex-row items-center justify-between bg-[#FFBD59]/50 border-t-2 border-[#FFBD59]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#7ED957] rounded-full"></div>
            <span className="text-sm font-bold text-[#8B4513] uppercase tracking-tight">Spawn: {Math.max(1, (MAX_POP_DELAY - (MAX_POP_DELAY - MIN_POP_DELAY) * (score/100)) / 100).toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${score >= 25 ? 'bg-[#FF5757] animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-bold text-[#8B4513] uppercase tracking-tight">Reaction: {(score >= 25 ? Math.max(400, POP_DURATION - (score - 25) * 15) : POP_DURATION) / 1000}s</span>
          </div>
        </div>
        <div className="text-xs sm:text-sm font-black text-[#8B4513] italic uppercase flex gap-4">
          <span>{10 - (spawnCountRef.current % 10)} to Golden</span>
          <span>{7 - (spawnCountRef.current % 7)} to Red</span>
        </div>
        <div className="flex gap-4">
           <span className="text-[10px] font-black bg-white/40 px-3 py-1 rounded-full text-[#8B4513] tracking-widest">VER 2.0.0</span>
        </div>
      </footer>
    </div>
  );
}
