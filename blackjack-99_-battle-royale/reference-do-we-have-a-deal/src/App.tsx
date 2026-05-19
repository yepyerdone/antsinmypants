/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { TitleScreen } from './components/TitleScreen';
import { Briefcase } from './components/Briefcase';
import { MoneyLadder } from './components/MoneyLadder';
import { BankerOffer } from './components/BankerOffer';
import { StatsScreen } from './components/StatsScreen';
import { 
  CASH_VALUES, 
  ROUND_STRUCTURE, 
  GameState, 
  BriefcaseData, 
  GameStats 
} from './types';
import { calculateBankerOffer, getBankerMessage } from './logic/bankerAI';
import { audioManager } from './logic/audioSystem';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, HelpCircle, RefreshCcw, Volume2, VolumeX, Sparkles } from 'lucide-react';

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<GameState>('START');
  const [cases, setCases] = useState<BriefcaseData[]>([]);
  const [personalCase, setPersonalCase] = useState<BriefcaseData | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [casesToOpenInRound, setCasesToOpenInRound] = useState(0);
  const [revealedValues, setRevealedValues] = useState<number[]>([]);
  const [currentOffer, setCurrentOffer] = useState(0);
  const [offerMessage, setOfferMessage] = useState("");
  const [lastOpenedValue, setLastOpenedValue] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [collectedPrizes, setCollectedPrizes] = useState<number[]>([]);
  const [stats, setStats] = useState<GameStats>({
    wonAmount: 0,
    peakOffer: 0,
    caseValue: 0,
    decisions: []
  });

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('casequest_prizes');
    if (saved) {
      try {
        setCollectedPrizes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load trophies", e);
      }
    }
  }, []);

  const savePrize = useCallback((amount: number) => {
    // Only collect if it's one of the standard prizes (handles banker offers becoming "prizes")
    if (CASH_VALUES.includes(amount)) {
      setCollectedPrizes(prev => {
        if (prev.includes(amount)) return prev;
        const next = [...prev, amount];
        localStorage.setItem('casequest_prizes', JSON.stringify(next));
        return next;
      });
    }
  }, []);

  // Initialize Game
  const initGame = useCallback(() => {
    try {
      const shuffledValues = [...CASH_VALUES].sort(() => Math.random() - 0.5);
      const newCases: BriefcaseData[] = shuffledValues.map((value, index) => ({
        id: index + 1,
        value,
        isOpen: false,
        isPersonal: false
      }));
      setCases(newCases);
      setPersonalCase(null);
      setRoundIndex(0);
      setCasesToOpenInRound(ROUND_STRUCTURE[0]);
      setRevealedValues([]);
      setLastOpenedValue(null);
      setGameState('SELECT_PERSONAL');
      window.scrollTo(0, 0); // Reset scroll
    } catch (e) {
      console.error("Failed to initialize game", e);
    }
  }, []);

  // Handle Case Click
  const handleCaseClick = (caseId: number) => {
    if (gameState === 'SELECT_PERSONAL') {
      const updatedCases = cases.map(c => 
        c.id === caseId ? { ...c, isPersonal: true } : c
      );
      setCases(updatedCases);
      setPersonalCase(updatedCases.find(c => c.id === caseId) || null);
      setGameState('PLAYING');
      audioManager.playClick();
      return;
    }

    if (gameState === 'PLAYING') {
      const clickedCase = cases.find(c => c.id === caseId);
      if (!clickedCase || clickedCase.isOpen || clickedCase.isPersonal) return;

      const updatedCases = cases.map(c => 
        c.id === caseId ? { ...c, isOpen: true } : c
      );
      setCases(updatedCases);
      setRevealedValues(prev => [...prev, clickedCase.value]);
      setLastOpenedValue(clickedCase.value);
      setCasesToOpenInRound(prev => prev - 1);
      audioManager.playCaseOpen();

      // Trigger crowd reaction
      if (clickedCase.value <= 1000) {
        // Good reveal
        audioManager.playCheer();
      } else if (clickedCase.value >= 50000) {
        // Bad reveal
        audioManager.playDisappointment();
      }
    }
  };

  // Check Round Completion
  useEffect(() => {
    if (gameState === 'PLAYING' && casesToOpenInRound === 0) {
      // Calculate Offer
      const remainingValues = cases
        .filter(c => !c.isOpen || (c.isPersonal && !c.isOpen))
        .map(c => c.value);
      
      const offer = calculateBankerOffer(remainingValues, roundIndex);
      const msg = getBankerMessage(offer, remainingValues.reduce((a, b) => a + b, 0) / remainingValues.length);
      
      setCurrentOffer(offer);
      setOfferMessage(msg);
      setStats(prev => ({
        ...prev,
        peakOffer: Math.max(prev.peakOffer, offer)
      }));

      setTimeout(() => setGameState('OFFER'), 1000);
    }
  }, [casesToOpenInRound, gameState, cases, roundIndex]);

  // Handle Banker Decision
  const handleBankerDecision = (accepted: boolean) => {
    if (accepted) {
      savePrize(currentOffer);
      setStats(prev => ({
        ...prev,
        wonAmount: currentOffer,
        caseValue: personalCase?.value || 0
      }));
      setGameState('SUMMARY');
      audioManager.playWin();
    } else {
      audioManager.playClick();
      const nextRound = roundIndex + 1;
      if (nextRound < ROUND_STRUCTURE.length) {
        setRoundIndex(nextRound);
        setCasesToOpenInRound(ROUND_STRUCTURE[nextRound]);
        setGameState('PLAYING');
      } else {
        // Final two cases
        setGameState('FINAL_SWAP');
      }
    }
  };

  const handleFinalChoice = (swap: boolean) => {
    const closedCases = cases.filter(c => !c.isOpen);
    const otherCase = closedCases.find(c => c.id !== personalCase?.id);
    
    let finalWin = personalCase?.value || 0;
    if (swap && otherCase) {
      finalWin = otherCase.value;
    }

    savePrize(finalWin);
    setStats(prev => ({
      ...prev,
      wonAmount: finalWin,
      caseValue: personalCase?.value || 0
    }));
    setGameState('SUMMARY');
    audioManager.playWin();
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    audioManager.setMute(newMute);
  };

  // Global Keyboard Handlers
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') initGame();
      if (e.key === 'm' || e.key === 'M') toggleMute();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [initGame, isMuted]);

  if (gameState === 'START') {
    return <TitleScreen onStart={initGame} collectedPrizes={collectedPrizes} />;
  }

  return (
    <div className="studio-shell min-h-screen text-white font-sans selection:bg-yellow-500/30">
      {/* Header UI */}
      <header className="fixed top-0 inset-x-0 h-16 bg-slate-900/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-300 to-yellow-700 rounded flex items-center justify-center font-bold text-black shadow-lg">D</div>
          <span className="font-black tracking-tighter text-xl hidden sm:block">DO WE HAVE A DEAL?</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 text-xs uppercase font-bold text-slate-500">
            <RefreshCcw size={14} /> Press 'R' to Restart
          </div>
          <button 
            onClick={toggleMute}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 max-w-[1500px] mx-auto">
        <div className="audience-band rounded-t-3xl" />
        <div className="stage-floor rounded-b-3xl px-4 py-8 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">
        
        {/* Left: Money Ladder */}
        <aside className="lg:col-span-3 order-2 lg:order-1">
          <MoneyLadder revealedValues={revealedValues} />
        </aside>

        {/* Center: Briefcase Grid */}
        <section className="lg:col-span-6 order-1 lg:order-2 flex flex-col items-center">
          <div className="mb-8 text-center">
            {gameState === 'SELECT_PERSONAL' ? (
              <motion.div initial={{ y: -20 }} animate={{ y: 0 }}>
                <h2 className="text-2xl font-bold text-yellow-500 mb-1">Choose Your Lucky Case</h2>
                <p className="text-slate-400 text-sm">Select one briefcase to keep until the end.</p>
              </motion.div>
            ) : gameState === 'PLAYING' ? (
              <motion.div initial={{ y: -20 }} animate={{ y: 0 }}>
                <h2 className="text-2xl font-bold mb-1">
                  Open <span className="text-yellow-500">{casesToOpenInRound}</span> More Cases
                </h2>
                <p className="text-slate-400 text-sm uppercase tracking-widest font-semibold">Round {roundIndex + 1}</p>
              </motion.div>
            ) : gameState === 'FINAL_SWAP' ? (
              <div className="bg-slate-900 p-6 rounded-2xl border border-yellow-600/30 text-center">
                <h2 className="text-2xl font-bold mb-4">The Final Decision</h2>
                <p className="text-slate-400 mb-6">You have two cases left. One is yours, one is on the table. Do you want to swap?</p>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => handleFinalChoice(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold">KEEP ORIGINAL</button>
                  <button onClick={() => handleFinalChoice(true)} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold text-black">SWAP CASES</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative w-full max-w-3xl">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-x-3 gap-y-3 justify-items-center mb-10">
              {cases.map(c => (
                <Briefcase 
                  key={c.id} 
                  data={c} 
                  onClick={() => handleCaseClick(c.id)}
                  disabled={gameState !== 'PLAYING' && gameState !== 'SELECT_PERSONAL'}
                />
              ))}
            </div>
          </div>

          <AnimatePresence>
            {lastOpenedValue !== null && gameState === 'PLAYING' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.5 }}
                className="mt-8 show-card px-8 py-4 rounded-2xl border shadow-2xl"
              >
                <div className="text-xs uppercase text-slate-500 font-bold mb-1">Last Revealed</div>
                <div className={`text-4xl font-black ${lastOpenedValue > 50000 ? 'text-red-500' : 'text-green-400'}`}>
                  ${lastOpenedValue.toLocaleString()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Right: Info & Status */}
        <aside className="lg:col-span-3 order-3 space-y-6">
          <div className="show-card p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Trophy size={16} className="text-yellow-500" /> Current Stats
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-slate-600 font-black uppercase">Avg. Probable Value</div>
                <div className="text-2xl font-bold text-blue-400">
                  ${Math.round(cases.filter(c => !c.isOpen).reduce((a,b)=>a+b.value, 0) / Math.max(1, cases.filter(c => !c.isOpen).length)).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-600 font-black uppercase">Best Offer So Far</div>
                <div className="text-xl font-bold text-green-500">${stats.peakOffer.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {personalCase && (
            <div className="show-card border-l-4 border-yellow-500 p-6 rounded-r-2xl">
              <div className="text-xs text-slate-500 font-bold uppercase mb-1">Your Personal Case</div>
              <div className="text-3xl font-black italic">No. {personalCase.id}</div>
              <div className="text-[10px] text-slate-600 mt-2">SEALED WORLDWIDE</div>
            </div>
          )}

          <div className="show-card p-6 rounded-2xl flex items-start gap-4">
            <Sparkles size={24} className="text-amber-300 shrink-0" />
            <div>
              <p className="text-xs text-blue-200/70 font-medium">
                The banker's offer is based on the average of remaining values but includes a risk adjustment. Small amounts are your friend if you have a big case!
              </p>
            </div>
          </div>
        </aside>
          </div>
        </div>
      </main>

      <footer className="mt-12 py-12 px-6 border-t border-white/5 text-center text-slate-600 text-xs">
        <p>© 2026 Do We Have a Deal? Studios • Not associated with any television network • Play responsibly.</p>
      </footer>

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'OFFER' && (
          <BankerOffer 
            offer={currentOffer} 
            message={offerMessage}
            onDeal={() => handleBankerDecision(true)}
            onNoDeal={() => handleBankerDecision(false)}
          />
        )}
        {gameState === 'SUMMARY' && (
          <StatsScreen 
            stats={stats} 
            onRestart={initGame} 
            onMainMenu={() => setGameState('START')} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
