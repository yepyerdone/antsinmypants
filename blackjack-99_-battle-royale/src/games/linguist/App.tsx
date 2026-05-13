import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, BarChart2, ChevronLeft, Lock, CheckCircle2, XCircle, Home } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { WORDS, KEYBOARD_ROWS, INITIAL_STATS, type GameStats, type LevelAttempt, type LevelResult, type Status } from './constants';

const LOCAL_STORAGE_KEY = 'linguist_progress_guest';
const LINGUIST_PROGRESS_COLLECTION = 'linguist_progress';

type SavedProgress = {
  stats: GameStats;
  levelResults: Record<string, LevelResult>;
  activeAttempts: Record<string, LevelAttempt>;
};

function createInitialProgress(): SavedProgress {
  return {
    stats: INITIAL_STATS,
    levelResults: {},
    activeAttempts: {},
  };
}

function getLocalProgressKey(uid: string | null) {
  return uid ? `linguist_progress_${uid}` : LOCAL_STORAGE_KEY;
}

function normalizeProgress(value: Partial<SavedProgress> | null | undefined): SavedProgress {
  const progress = createInitialProgress();
  return {
    stats: { ...progress.stats, ...(value?.stats || {}) },
    levelResults: value?.levelResults || {},
    activeAttempts: value?.activeAttempts || {},
  };
}

export default function App() {
  const navigate = useNavigate();
  const { firebaseUser, displayName, isGuest } = useAuth();
  const firebaseUid = firebaseUser && !isGuest ? firebaseUser.uid : null;
  const progressKey = getLocalProgressKey(firebaseUid);
  const [progress, setProgress] = useState<SavedProgress>(createInitialProgress);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [showStats, setShowStats] = useState(false);
  const [message, setMessage] = useState("");
  const stats = progress.stats;

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setLoadingProgress(true);
      setSyncError(null);
      const localSaved = localStorage.getItem(progressKey);
      const localProgress = localSaved ? normalizeProgress(JSON.parse(localSaved) as Partial<SavedProgress>) : createInitialProgress();

      if (!firebaseUid) {
        if (!cancelled) {
          setProgress(localProgress);
          setLoadingProgress(false);
        }
        return;
      }

      try {
        const progressRef = doc(db, LINGUIST_PROGRESS_COLLECTION, firebaseUid);
        const progressSnap = await getDoc(progressRef);
        const remoteProgress = progressSnap.exists()
          ? normalizeProgress(progressSnap.data() as Partial<SavedProgress>)
          : localProgress;

        if (!progressSnap.exists()) {
          await setDoc(progressRef, {
            ...remoteProgress,
            uid: firebaseUid,
            playerName: displayName || firebaseUser?.displayName || 'Player',
            updatedAt: serverTimestamp(),
          });
        }

        if (!cancelled) {
          setProgress(remoteProgress);
          localStorage.setItem(progressKey, JSON.stringify(remoteProgress));
        }
      } catch (error) {
        console.error('Failed to load Linguist progress:', error);
        if (!cancelled) {
          setProgress(localProgress);
          setSyncError('Cloud progress could not load. Your local progress is available on this device.');
        }
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    }

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [displayName, firebaseUid, firebaseUser?.displayName, progressKey]);

  const saveProgress = useCallback(async (nextProgress: SavedProgress) => {
    setProgress(nextProgress);
    localStorage.setItem(progressKey, JSON.stringify(nextProgress));

    if (!firebaseUid) return;

    try {
      await setDoc(doc(db, LINGUIST_PROGRESS_COLLECTION, firebaseUid), {
        ...nextProgress,
        uid: firebaseUid,
        playerName: displayName || firebaseUser?.displayName || 'Player',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSyncError(null);
    } catch (error) {
      console.error('Failed to save Linguist progress:', error);
      setSyncError('Cloud save failed. This attempt is saved locally for now.');
    }
  }, [displayName, firebaseUid, firebaseUser?.displayName, progressKey]);

  const targetWord = currentLevel !== null ? WORDS[currentLevel - 1] : "";

  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedLimit, setRevealedLimit] = useState(5);

  const resetGame = useCallback(() => {
    setGuesses([]);
    setCurrentGuess("");
    setGameState("playing");
    setMessage("");
    setIsRevealing(false);
    setRevealedLimit(5);
  }, []);

  const onLevelSelect = (level: number) => {
    const levelKey = String(level);
    const completed = progress.levelResults[levelKey];
    const activeAttempt = progress.activeAttempts[levelKey];

    if (completed) {
      setMessage(`Level ${level} is already locked.`);
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    if (level <= stats.unlockedLevels) {
      setCurrentLevel(level);
      resetGame();
      setGuesses(activeAttempt?.guesses || []);
    } else {
      setMessage("Complete previous levels to unlock!");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const finishAttempt = (won: boolean, tries: number, finalGuesses: string[]) => {
    if (currentLevel === null) return;

    const levelKey = String(currentLevel);
    const completedAt = Date.now();

    const nextStats = (() => {
      const prev = stats;
      const newTotalGames = prev.totalGames + 1;
      const newTotalWins = prev.totalWins + (won ? 1 : 0);
      const newCurrentStreak = won ? prev.currentStreak + 1 : 0;
      const newMaxStreak = Math.max(prev.maxStreak, newCurrentStreak);
      const newDistribution = { ...prev.distribution };
      if (won) newDistribution[tries]++;

      return {
        ...prev,
        totalGames: newTotalGames,
        totalWins: newTotalWins,
        winRate: Math.round((newTotalWins / newTotalGames) * 100),
        currentStreak: newCurrentStreak,
        maxStreak: newMaxStreak,
        distribution: newDistribution,
        unlockedLevels: currentLevel === prev.unlockedLevels 
          ? Math.min(100, prev.unlockedLevels + 1) 
          : prev.unlockedLevels
      };
    })();

    const nextActiveAttempts = { ...progress.activeAttempts };
    delete nextActiveAttempts[levelKey];

    const nextProgress: SavedProgress = {
      stats: nextStats,
      activeAttempts: nextActiveAttempts,
      levelResults: {
        ...progress.levelResults,
        [levelKey]: {
          level: currentLevel,
          word: targetWord,
          guesses: finalGuesses,
          status: won ? "won" : "lost",
          tries: won ? tries : 6,
          completedAt,
        },
      },
    };

    void saveProgress(nextProgress);
  };

  const getStatus = (letter: string, index: number, word: string) => {
    if (targetWord[index] === letter) return "CORRECT";
    if (targetWord.includes(letter)) return "PRESENT";
    return "ABSENT";
  };

  const handleKeydown = useCallback((key: string) => {
    if (gameState !== "playing" || currentLevel === null || isRevealing) return;

    if (key === "ENTER") {
      if (currentGuess.length !== 5) {
        setMessage("Too short");
        setTimeout(() => setMessage(""), 2000);
        return;
      }
      
      const newGuesses = [...guesses, currentGuess];
      const levelKey = String(currentLevel);
      const nextProgress: SavedProgress = {
        ...progress,
        activeAttempts: {
          ...progress.activeAttempts,
          [levelKey]: {
            level: currentLevel,
            word: targetWord,
            guesses: newGuesses,
            startedAt: progress.activeAttempts[levelKey]?.startedAt || Date.now(),
            updatedAt: Date.now(),
          },
        },
      };

      void saveProgress(nextProgress);
      setIsRevealing(true);
      setRevealedLimit(0);
      setGuesses(newGuesses);
      setCurrentGuess("");

      // Increment revealedLimit one by one to match flip animation
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          setRevealedLimit(prev => prev + 1);
        }, (i + 1) * 250);
      }

      // Delay checking game state until after the reveal animation
      setTimeout(() => {
        setIsRevealing(false);
        if (currentGuess === targetWord) {
          setGameState("won");
          finishAttempt(true, newGuesses.length, newGuesses);
          setMessage("Brilliant!");
        } else if (newGuesses.length === 6) {
          setGameState("lost");
          finishAttempt(false, 0, newGuesses);
          setMessage(`Game Over. Word: ${targetWord}`);
        }
      }, 1600);
    } else if (key === "DELETE" || key === "BACKSPACE") {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, guesses, gameState, targetWord, currentLevel, isRevealing, progress, saveProgress, stats]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeydown(e.key.toUpperCase());
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKeydown]);

  const getLetterStatusOnKeyboard = (key: string) => {
    let bestStatus: Status = "EMPTY";
    // Only show keyboard status for revealed letters
    const revealedGuesses = isRevealing ? guesses.slice(0, -1) : guesses;
    revealedGuesses.forEach(guess => {
      for (let i = 0; i < guess.length; i++) {
        if (guess[i] === key) {
          const status = getStatus(guess[i], i, targetWord) as Status;
          if (status === "CORRECT") bestStatus = "CORRECT";
          else if (status === "PRESENT" && bestStatus !== "CORRECT") bestStatus = "PRESENT";
          else if (status === "ABSENT" && bestStatus === "EMPTY") bestStatus = "ABSENT";
        }
      }
    });
    return bestStatus;
  };

  if (loadingProgress) {
    return (
      <div className="min-h-screen bg-[#121213] text-white flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="text-4xl font-black tracking-tighter italic">LINGUIST</div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.35em] text-white/40 font-bold">Loading saved progress</div>
        </div>
      </div>
    );
  }

  if (currentLevel === null) {
    return (
      <div className="min-h-screen bg-[#121213] text-white p-4 sm:p-8 font-sans">
        <header className="max-w-6xl mx-auto flex items-center justify-between mb-12 border-b border-[#3a3a3c] pb-6">
          <div className="flex flex-col">
            <h1 className="text-5xl font-black tracking-tighter italic leading-none">LINGUIST</h1>
            <p className="text-[10px] uppercase tracking-[0.4em] opacity-40 mt-2 font-bold">The Ultimate Lexicon Challenge</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-xs bg-white/10 text-white rounded-full font-bold hover:bg-white/20 transition-all border border-white/10 inline-flex items-center gap-2"
            >
              <Home className="w-3.5 h-3.5" /> HOME
            </button>
            <button 
              onClick={async () => {
                if (!confirm("Reset all Linguist progress and stats on this profile?")) return;
                const emptyProgress = createInitialProgress();
                localStorage.removeItem(progressKey);
                await saveProgress(emptyProgress);
                setCurrentLevel(null);
              }}
              className="px-4 py-2 text-xs bg-rose-500/10 text-rose-500 rounded-full font-bold hover:bg-rose-500/20 transition-all border border-rose-500/20"
            >
              RESET DATA
            </button>
            <button 
              onClick={() => setShowStats(true)}
              className="p-3 bg-[#1e1e1f] border border-[#3a3a3c] rounded-xl hover:bg-neutral-800 transition-all shadow-lg"
            >
              <BarChart2 className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-xs font-black mb-6 opacity-40 uppercase tracking-[0.2em] flex items-center gap-2">
              <Lock className="w-3 h-3" /> Progression Hub
            </h2>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
              {Array.from({ length: 100 }, (_, i) => i + 1).map(level => {
                const isUnlocked = level <= stats.unlockedLevels;
                const result = progress.levelResults[String(level)];
                const isCompleted = Boolean(result);
                const isCurrent = level === stats.unlockedLevels;
                const isAttempting = Boolean(progress.activeAttempts[String(level)] && !result);
                return (
                  <button
                    key={level}
                    onClick={() => onLevelSelect(level)}
                    disabled={!isUnlocked || isCompleted}
                    className={`
                      relative aspect-square flex items-center justify-center rounded-lg font-bold text-lg transition-all
                      ${isUnlocked && !isCompleted ? 'bg-[#1e1e1f] border border-[#3a3a3c] hover:border-white/40 text-white cursor-pointer active:scale-95' : 'bg-neutral-900/50 border border-transparent text-neutral-700 cursor-not-allowed'}
                      ${isCurrent && !isCompleted ? 'ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''}
                      ${result?.status === 'won' ? 'bg-[#538d4e] border-[#538d4e] text-white' : ''}
                      ${result?.status === 'lost' ? 'bg-[#8b0000] border-[#8b0000] text-white/80' : ''}
                      ${isAttempting ? 'ring-2 ring-[#b59f3b] text-[#b59f3b]' : ''}
                    `}
                    title={result ? `Level ${level} completed. Attempts are locked.` : isAttempting ? `Continue level ${level}` : `Level ${level}`}
                  >
                    {level}
                    {!isUnlocked && <Lock className="absolute top-1 right-1 w-2.5 h-2.5 opacity-20" />}
                    {result?.status === 'won' && <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-white fill-[#121213]" />}
                    {result?.status === 'lost' && <XCircle className="absolute -top-1 -right-1 w-4 h-4 text-white fill-[#121213]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:block space-y-12">
            <section>
              <h2 className="text-xs font-black mb-6 opacity-40 uppercase tracking-[0.2em]">Quick Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1e1e1f] p-4 rounded-2xl border border-[#3a3a3c]">
                  <div className="text-2xl font-black">{stats.totalGames}</div>
                  <div className="text-[10px] opacity-40 uppercase font-bold">Played</div>
                </div>
                <div className="bg-[#1e1e1f] p-4 rounded-2xl border border-[#3a3a3c]">
                  <div className="text-2xl font-black">{stats.winRate}%</div>
                  <div className="text-[10px] opacity-40 uppercase font-bold">Wins</div>
                </div>
              </div>
            </section>
            
            <section>
              <h2 className="text-xs font-black mb-6 opacity-40 uppercase tracking-[0.2em]">Current Streak</h2>
              <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-6 rounded-3xl border border-emerald-500/20 text-center">
                <div className="text-5xl font-black text-emerald-400">{stats.currentStreak}</div>
                <div className="text-xs font-bold opacity-60 uppercase mt-2">Level Streak</div>
              </div>
            </section>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">
          {firebaseUid && !isGuest ? 'Progress saves to your profile.' : 'Guest progress saves locally on this device.'}
          {syncError && <div className="mt-2 text-rose-400 normal-case tracking-normal">{syncError}</div>}
        </div>

        <StatsModal show={showStats} onClose={() => setShowStats(false)} stats={stats} />
        {message && <Toast message={message} />}
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#121213] text-white flex flex-col md:flex-row font-sans select-none overflow-hidden">
      {/* Game Side */}
      <div className="linguist-game-side flex-1 flex flex-col p-2 sm:p-4 md:p-6 md:border-r border-[#3a3a3c] overflow-hidden">
        <header className="linguist-game-header max-w-md w-full mx-auto flex items-center justify-between mb-4 sm:mb-6 shrink-0">
          <button 
            onClick={() => setCurrentLevel(null)}
            className="p-2 sm:p-3 bg-[#1e1e1f] border border-[#3a3a3c] rounded-xl hover:bg-neutral-800 transition-all shadow-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className="bg-[#538d4e] px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-1 inline-block">Level {currentLevel}</div>
            <p className="text-[10px] opacity-50 font-bold tracking-widest uppercase block">Target: 5 Letters</p>
          </div>
          <div className="w-10 sm:w-12 h-10 sm:h-12" /> {/* Balanced spacer since reset is removed */}
        </header>

        <main className="linguist-game-stage flex-1 flex flex-col items-center justify-center gap-1 sm:gap-1.5 relative min-h-0">
          <div className="linguist-board grid grid-rows-6 gap-1 sm:gap-1.5">
            {Array.from({ length: 6 }).map((_, rowIndex) => {
              const guess = guesses[rowIndex] || (rowIndex === guesses.length ? currentGuess : "");
              const isSubmitted = rowIndex < guesses.length;
              
              return (
                <div key={rowIndex} className="linguist-board-row flex gap-1 sm:gap-2">
                  {Array.from({ length: 5 }).map((_, colIndex) => {
                    const letter = guess[colIndex] || "";
                    
                    const isLatestGuess = isRevealing && rowIndex === guesses.length - 1;
                    const isOldGuess = rowIndex < (isRevealing ? guesses.length - 1 : guesses.length);
                    const shouldShowStatus = isOldGuess || (isLatestGuess && colIndex < revealedLimit);
                    const status = shouldShowStatus ? (getStatus(letter, colIndex, targetWord) as Status) : "EMPTY" as Status;
                    
                    return (
                      <motion.div
                        key={colIndex}
                        initial={false}
                        animate={isSubmitted ? { rotateX: [0, 90, 0] } : {}}
                        transition={{ duration: 0.5, delay: colIndex * 0.25 }}
                        className={`
                          linguist-tile flex items-center justify-center text-2xl sm:text-3xl font-black rounded-sm border-2 transition-all
                          ${!isSubmitted && letter ? 'border-neutral-500 scale-105' : 'border-[#3a3a3c]'}
                          ${status === 'CORRECT' ? 'bg-[#538d4e] border-[#538d4e] text-white shadow-[0_0_15px_rgba(83,141,78,0.3)]' : ''}
                          ${status === 'PRESENT' ? 'bg-[#b59f3b] border-[#b59f3b] text-white shadow-[0_0_15px_rgba(181,159,59,0.3)]' : ''}
                          ${status === 'ABSENT' ? 'bg-[#8b0000] border-[#8b0000] text-white shadow-[0_0_15px_rgba(139,0,0,0.3)]' : ''}
                        `}
                      >
                        {letter}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {gameState !== "playing" && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
              >
                <div className="bg-[#1e1e1f] border border-[#3a3a3c] p-8 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 min-w-[320px] pointer-events-auto backdrop-blur-md">
                  <div className="text-center">
                    <h3 className={`text-3xl font-black tracking-tighter italic ${gameState === 'won' ? 'text-emerald-400' : 'text-rose-500'}`}>
                      {gameState === 'won' ? 'LEVEL COMPLETE' : 'TRY AGAIN?'}
                    </h3>
                    <div className="mt-4 inline-flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full border border-white/5">
                      <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">The Word:</span>
                      <span className="text-lg font-black tracking-widest uppercase">{targetWord}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setCurrentLevel(null)}
                      className="flex-1 py-4 bg-[#121213] border border-[#3a3a3c] hover:border-white/20 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest"
                    >
                      Menu
                    </button>
                    {currentLevel < 100 && (
                      <button 
                        onClick={() => onLevelSelect(currentLevel + 1)}
                        className="flex-[2] py-4 bg-white text-black hover:bg-neutral-200 rounded-2xl font-black transition-all uppercase text-sm"
                      >
                        Next Level
                      </button>
                    )}
                    {gameState === 'lost' && (
                      <div className="flex-1 py-4 bg-transparent border border-rose-500/20 text-rose-500 rounded-2xl font-bold transition-all uppercase text-[10px] tracking-widest flex items-center justify-center italic opacity-70">
                        Attempt locked
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="linguist-keyboard max-w-md w-full mx-auto pb-4 px-2 shrink-0">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {KEYBOARD_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center gap-1 sm:gap-1.5 flex-1">
                {row.map(key => {
                  const status = getLetterStatusOnKeyboard(key) as Status;
                  return (
                    <button
                      key={key}
                      onClick={() => handleKeydown(key)}
                      className={`
                        linguist-key h-12 sm:h-14 flex items-center justify-center rounded-lg font-bold text-[10px] sm:text-xs tracking-tight transition-all active:scale-90
                        ${key === 'ENTER' || key === 'DELETE' ? 'px-2 sm:px-6 bg-[#818384] text-white' : 'flex-1'}
                        ${status === 'EMPTY' ? 'bg-[#818384]/30 hover:bg-[#818384]/50 text-white/70' : ''}
                        ${status === 'CORRECT' ? 'bg-[#538d4e] text-white shadow-[0_0_10px_rgba(83,141,78,0.4)]' : ''}
                        ${status === 'PRESENT' ? 'bg-[#b59f3b] text-white shadow-[0_0_10px_rgba(181,159,59,0.4)]' : ''}
                        ${status === 'ABSENT' ? 'bg-[#8b0000] text-white/50 opacity-40' : ''}
                      `}
                    >
                      {key === 'DELETE' ? 'DEL' : key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </footer>
      </div>

      {/* Info Side (Progression Hub in Game View) */}
      <aside className="hidden lg:flex w-80 bg-[#1e1e1f] flex-col p-8 border-l border-[#3a3a3c] overflow-y-auto">
        <h2 className="text-xs font-black text-[#818384] uppercase tracking-[0.2em] mb-8">Performance Radar</h2>
        
        <div className="space-y-10">
          <section className="grid grid-cols-2 gap-4">
            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
              <div className="text-2xl font-black">{stats.totalGames}</div>
              <div className="text-[10px] text-[#818384] uppercase font-bold">Games</div>
            </div>
            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
              <div className="text-2xl font-black">{stats.winRate}%</div>
              <div className="text-[10px] text-[#818384] uppercase font-bold">Win Rate</div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black text-[#818384] uppercase tracking-widest mb-4">Guess Distribution</h3>
            <div className="space-y-2">
              {Object.entries(stats.distribution).sort((a, b) => Number(a[0]) - Number(b[0])).map(([tries, count]) => {
                const numericCount = count as number;
                const percentage = stats.totalWins > 0 ? (numericCount / stats.totalWins) * 100 : 0;
                return (
                  <div key={tries} className="flex items-center gap-3 w-full">
                    <span className="text-[10px] font-bold text-[#818384] w-2">{tries}</span>
                    <div className="flex-1 bg-black/30 h-4 rounded-sm overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(percentage, 5)}%` }}
                        className={`h-full flex items-center justify-end px-2 text-[8px] font-black ${numericCount > 0 ? 'bg-[#538d4e]' : 'bg-[#818384]/10'}`}
                      >
                        {numericCount > 0 ? numericCount : ''}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Streak</p>
                <p className="text-2xl font-black text-emerald-400">{stats.currentStreak}</p>
              </div>
              <Trophy className="text-emerald-500 w-8 h-8 opacity-20" />
            </div>
          </section>
        </div>

        <footer className="mt-auto pt-8 border-t border-[#3a3a3c]">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[#818384] text-[10px] font-black uppercase tracking-widest">Mastery Level</p>
                <p className="text-2xl font-black italic tracking-tighter mt-1">LINGUIST</p>
              </div>
              <div className="text-right">
                <p className="text-[#818384] text-[10px] font-black uppercase tracking-widest">Max Streak</p>
                <p className="text-xl font-bold">{stats.maxStreak}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowStats(true)}
              className="w-full py-3 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
            >
              <BarChart2 className="w-4 h-4" /> Comprehensive Stats
            </button>
          </div>
        </footer>
      </aside>

      {message && <Toast message={message} />}
      <StatsModal show={showStats} onClose={() => setShowStats(false)} stats={stats} />
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 bg-white text-black px-8 py-3 rounded-full font-black shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-white/20 uppercase text-sm tracking-widest pointer-events-none"
      >
        {message}
      </motion.div>
    </AnimatePresence>
  );
}

function StatsModal({ show, onClose, stats }: { show: boolean, onClose: () => void, stats: GameStats }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-[#121213]/90 backdrop-blur-xl" 
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-[#1e1e1f] border border-[#3a3a3c] rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#538d4e] via-[#b59f3b] to-[#8b0000]" />
        
        <h2 className="text-3xl font-black mb-10 tracking-tighter text-center italic">PERFORMANCE AUDIT</h2>
        
        <div className="grid grid-cols-4 gap-6 mb-12">
          <StatBox label="Played" value={stats.totalGames} />
          <StatBox label="Win Rate" value={`${stats.winRate}%`} />
          <StatBox label="Streak" value={stats.currentStreak} />
          <StatBox label="Mastery" value={stats.maxStreak} />
        </div>

        <div className="mb-10">
          <h3 className="text-[10px] font-black tracking-[0.3em] mb-6 opacity-40 uppercase text-center">Solve Efficiency</h3>
          <div className="space-y-4">
            {Object.entries(stats.distribution).sort((a, b) => Number(a[0]) - Number(b[0])).map(([tries, count]) => {
              const numericCount = count as number;
              const percentage = stats.totalWins > 0 ? (numericCount / stats.totalWins) * 100 : 0;
              return (
                <div key={tries} className="flex items-center gap-4">
                  <span className="font-mono text-xs font-black text-[#818384] w-4">{tries}</span>
                  <div className="flex-1 bg-black/40 h-8 rounded-lg overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(percentage, 5)}%` }}
                      className={`h-full flex items-center justify-end px-4 text-[10px] font-black ${numericCount > 0 ? 'bg-[#538d4e] shadow-[0_0_15px_rgba(83,141,78,0.3)]' : 'bg-[#818384]/10 opacity-20'}`}
                    >
                      {numericCount > 0 ? numericCount : ''}
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-5 bg-white text-black rounded-3xl font-black text-lg hover:bg-neutral-200 transition-all uppercase tracking-widest shadow-xl"
        >
          Return to Lexicon
        </button>
      </motion.div>
    </div>
  );
}

function StatBox({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="text-center group">
      <div className="text-4xl font-black tracking-tighter group-hover:scale-110 transition-transform">{value}</div>
      <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}
