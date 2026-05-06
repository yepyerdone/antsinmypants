import { useState, useEffect, useCallback, useMemo } from 'react';
import USMap from './components/USMap';
import GuessInput from './components/GuessInput';
import Stats from './components/Stats';
import Leaderboard from './components/Leaderboard';
import GameOver from './components/GameOver';
import { getStatesData } from './lib/mapUtils';
import { StateData } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { MapIcon, Trophy, Info, RefreshCw } from 'lucide-react';

export default function App() {
  const [states, setStates] = useState<StateData[]>([]);
  const [guessedStates, setGuessedStates] = useState<Set<string>>(new Set());
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  // Initialize map data
  useEffect(() => {
    const data = getStatesData();
    setStates(data);
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && !isGameOver) {
      interval = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isGameOver]);

  const handleGuess = useCallback((guess: string) => {
    const normalizedGuess = guess.trim().toLowerCase();
    
    // Find if the guess matches any state name
    const state = states.find(s => s.name.toLowerCase() === normalizedGuess);
    
    if (state && !guessedStates.has(normalizedGuess)) {
      if (!isActive) setIsActive(true);
      
      const newGuessed = new Set(guessedStates);
      newGuessed.add(normalizedGuess);
      setGuessedStates(newGuessed);
      
      // Check for win
      if (newGuessed.size === states.length && states.length > 0) {
        setIsVictory(true);
        setIsGameOver(true);
        setShowResults(true);
        setIsActive(false);
      }
      
      return true; // Match found
    }
    return false;
  }, [states, guessedStates, isActive]);

  const giveUp = () => {
    setIsVictory(false);
    setIsGameOver(true);
    setShowResults(true);
    setIsActive(false);
  };

  const resetGame = () => {
    setGuessedStates(new Set());
    setTime(0);
    setHasStarted(false);
    setIsActive(false);
    setIsGameOver(false);
    setShowResults(false);
    setIsVictory(false);
  };

  const startGame = () => {
    setHasStarted(true);
    setIsActive(true);
  };

  const remainingStates = useMemo(() => {
    return states.length - guessedStates.size;
  }, [states.length, guessedStates.size]);

  return (
    <div className="states-master-page min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-white">
      <header className="states-master-header sticky z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <MapIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-white">STATES MASTER</h1>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">US Geography Challenge</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Score</span>
              <span className="text-lg font-black text-indigo-400">{guessedStates.size} / {states.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Session Time</span>
              <span className="text-lg font-mono font-black text-slate-300">
                {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-8 pb-10 px-6 max-w-7xl mx-auto min-h-[calc(100vh-80px)] flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
          
          <div className="lg:col-span-8 space-y-6 flex flex-col h-full">
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-black text-white tracking-tight">Can you name all 50 states?</h2>
              </div>

              {!hasStarted ? (
                <div className="flex justify-center py-4">
                  <button
                    onClick={startGame}
                    className="group relative px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-600/20"
                  >
                    <span className="flex items-center gap-3">
                      START MISSION
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        →
                      </motion.div>
                    </span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <GuessInput 
                    onGuess={handleGuess} 
                    isGameOver={isGameOver} 
                    disabled={isGameOver}
                  />
                  {!isGameOver && (
                    <div className="flex justify-center">
                      <button 
                        onClick={giveUp}
                        className="text-[10px] font-bold text-slate-600 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Give up & reveal results
                      </button>
                    </div>
                  )}
                  {isGameOver && !showResults && (
                    <div className="flex justify-center">
                      <button 
                        onClick={() => setShowResults(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl transition-all"
                      >
                        Show Results Popup
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0">
              <USMap 
                states={states} 
                guessedStates={guessedStates} 
                hoveredState={hoveredState}
                onStateHover={setHoveredState}
              />
            </div>

            {/* Alphabetical Checklist */}
            <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">States Checklist</h3>
                <span className="text-[10px] text-slate-600 font-mono italic">Sorted A-Z</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-2 gap-x-4">
                {[...states].sort((a, b) => a.name.localeCompare(b.name)).map((state) => {
                  const isGuessed = guessedStates.has(state.name.toLowerCase());
                  return (
                    <div 
                      key={state.id} 
                      className={`text-[11px] font-bold transition-all flex items-center gap-2 ${
                        isGuessed ? 'text-emerald-400' : 'text-slate-700'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isGuessed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-800'}`} />
                      <span className={isGuessed ? 'opacity-100' : 'opacity-40'}>
                        {isGuessed ? state.name : '••••••••'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl shrink-0">
                <Info className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Start with the big ones! Spelling counts. Some states are small, but they all count towards the record.
                </p>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
            <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-2xl shadow-indigo-500/20">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="h-4 w-4 text-indigo-200" />
                <h3 className="font-bold uppercase tracking-widest text-[10px] opacity-80">Mission Progress</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-3xl font-black tracking-tighter">{Math.round((guessedStates.size / (states.length || 1)) * 100)}%</span>
                    <span className="text-indigo-200 text-xs font-bold">{guessedStates.size} / {states.length}</span>
                  </div>
                  <div className="h-3 bg-indigo-900/30 rounded-full overflow-hidden p-0.5">
                    <motion.div 
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(guessedStates.size / (states.length || 1)) * 100}%` }}
                      transition={{ type: 'spring', damping: 20 }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl p-3">
                    <span className="block text-[9px] font-bold uppercase tracking-wider opacity-60 mb-0.5">Remaining</span>
                    <span className="text-lg font-bold">{remainingStates}</span>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <span className="block text-[9px] font-bold uppercase tracking-wider opacity-60 mb-0.5">Pace</span>
                    <span className="text-lg font-bold">{guessedStates.size > 0 ? (time / guessedStates.size).toFixed(1) : '0'}s</span>
                  </div>
                </div>
              </div>
            </div>

            <Leaderboard />
          </aside>
        </div>
      </main>

      <AnimatePresence>
        {isGameOver && showResults && (
          <GameOver 
            time={time} 
            onRestart={resetGame} 
            onClose={() => setShowResults(false)}
            isVictory={isVictory}
          />
        )}
      </AnimatePresence>

      <footer className="py-12 border-t border-slate-900 text-center">
        <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">
          Created for Map Lovers & Geography Buffs
        </p>
      </footer>
    </div>
  );
}
