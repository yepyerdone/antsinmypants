/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, Player, GameState, PlayerStatus } from './types';
import { createDeck, calculateScore, isBlackjack, shuffle } from './lib/blackjack';
import { CardComponent } from './components/CardComponent';
import { BattleRoyaleHUD, SidebarPlayerList } from './components/BattleRoyaleHUD';
import { cn } from './lib/utils';
import { Play, RotateCcw, User, Cpu, Info, Skull, Trophy, Timer as TimerIcon, BarChart3 } from 'lucide-react';
import confetti from 'canvas-confetti';

import { OnlineLobby } from './components/OnlineLobby';
import { OnlineGame } from './components/OnlineGame';
import { auth, testConnection } from './lib/firebase';
import { getUserStats, trackGameResult } from './lib/user';
import { DailyLeaderboard } from './components/DailyLeaderboard';
import { DealerAvatar, DealerMood } from './components/DealerAvatar';

import { AuthOverlay } from './components/AuthOverlay';
import { ProfileOverlay } from './components/ProfileOverlay';

const TURN_TIME_LIMIT = 15;
const BOT_DECISION_DELAY = 150; // Faster bot turns for better flow

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mode, setMode] = useState<'online' | 'offline' | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<{ id: string; isHost: boolean } | null>(null);
  const [eliminatedPlayer, setEliminatedPlayer] = useState<string | null>(null);
  const [lastEliminated, setLastEliminated] = useState<string | null>(null);
  const [userWins, setUserWins] = useState<number>(0);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    testConnection();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user) {
        getUserStats(user.uid)
          .then(stats => {
            if (stats) setUserWins(stats.totalWins || 0);
          })
          .catch(err => {
            console.error("Failed to load user stats on birth:", err);
          });
      }
    });

    const openAuthListener = () => setShowAuth(true);
    window.addEventListener('open-auth', openAuthListener);

    return () => {
      unsubscribe();
      window.removeEventListener('open-auth', openAuthListener);
    };
  }, []);

  const initializeGame = (playersCount: number) => {
    const deck = createDeck();
    const players: Player[] = [];
    
    // Core player (User)
    players.push({
      id: 'player-1',
      name: 'YOU',
      hand: [],
      status: 'playing',
      isBot: false,
      score: 0,
      wins: userWins,
    });

    const botPrefixes = ['Lucky', 'Vegas', 'Shark', 'Ace', 'King', 'Queen', 'Joker', 'Dealers', 'High', 'Low', 'Roll', 'Bet', 'BJ', 'Sigma', 'Omega', 'Pro', 'Elite'];
    const botSuffixes = ['_99', 'King', 'Slayer', '_BJ', 'Master', '_Pro', 'Winner', '_Ace', 'Vortex', 'Pulse', 'Strike', 'Rush', 'Gamble'];

    // Bots
    for (let i = 2; i <= playersCount; i++) {
      const prefix = botPrefixes[Math.floor(Math.random() * botPrefixes.length)];
      const suffix = botSuffixes[Math.floor(Math.random() * botSuffixes.length)];
      const number = Math.floor(Math.random() * 99);
      
      players.push({
        id: `bot-${i}`,
        name: `${prefix}${suffix}${number}`,
        hand: [],
        status: 'playing',
        isBot: true,
        score: 0,
        wins: Math.floor(Math.random() * 45), // Random wins for bots to show skill variety
      });
    }

    setGameState({
      players,
      dealer: { hand: [], score: 0, hidden: true },
      deck,
      round: 1,
      phase: 'betting',
      currentPlayerIndex: 0,
      timeLeft: TURN_TIME_LIMIT,
      winnerId: null,
    });

    // Start with dealing
    setTimeout(() => startRound(players, deck), 500);
  };

  const startRound = (currentPlayers: Player[], currentDeck: Card[]) => {
    const alivePlayers = currentPlayers.filter(p => !['eliminated', 'winner'].includes(p.status));
    
    // If only one player left, they win!
    if (alivePlayers.length === 1) {
       endGame(alivePlayers[0].id);
       return;
    }

    // Reset status but keep those eliminated
    const resetingPlayers = currentPlayers.map(p => {
      if (p.status === 'eliminated') return p;
      return { ...p, hand: [], status: 'playing' as PlayerStatus };
    });

    let deck = [...currentDeck];
    if (deck.length < (alivePlayers.length + 1) * 4) {
      deck = createDeck();
    }

    // Deal
    const updatedPlayers = resetingPlayers.map(p => {
      if (p.status === 'eliminated') return p;
      const card1 = deck.pop()!;
      const card2 = deck.pop()!;
      return { ...p, hand: [card1, card2] };
    });

    const dealerCard1 = deck.pop()!;
    const dealerCard2 = deck.pop()!;

    setGameState(prev => prev ? {
      ...prev,
      players: updatedPlayers,
      dealer: { hand: [dealerCard1, dealerCard2], score: calculateScore([dealerCard1, dealerCard2]), hidden: true },
      deck,
      phase: 'player-turn',
      currentPlayerIndex: 0,
      timeLeft: TURN_TIME_LIMIT,
    } : null);
  };

  const endGame = (winnerId: string) => {
    setGameState(prev => prev ? {
      ...prev,
      phase: 'game-over',
      winnerId,
      players: prev.players.map(p => p.id === winnerId ? { ...p, status: 'winner' } : p)
    } : null);
    confetti();
  };

  const handleHit = useCallback(() => {
    if (!gameState || gameState.phase !== 'player-turn') return;
    
    // Find the human player (player-1)
    const playerIndex = gameState.players.findIndex(p => p.id === 'player-1');
    if (playerIndex === -1 || gameState.players[playerIndex].status !== 'playing') return;

    const newDeck = [...gameState.deck];
    const newCard = newDeck.pop()!;
    const updatedPlayers = [...gameState.players];
    const player = updatedPlayers[playerIndex];
    const newHand = [...player.hand, newCard];
    const newScore = calculateScore(newHand);
    const newStatus = newScore > 21 ? 'busted' : 'playing';

    updatedPlayers[playerIndex] = {
      ...player,
      hand: newHand,
      status: newStatus as any,
    };

    setGameState(prev => prev ? {
      ...prev,
      players: updatedPlayers,
      deck: newDeck,
    } : null);
  }, [gameState]);

  const handleStand = useCallback(() => {
    if (!gameState || gameState.phase !== 'player-turn') return;
    
    const playerIndex = gameState.players.findIndex(p => p.id === 'player-1');
    if (playerIndex === -1 || gameState.players[playerIndex].status !== 'playing') return;

    const updatedPlayers = [...gameState.players];
    updatedPlayers[playerIndex].status = 'standing';

    setGameState(prev => prev ? {
      ...prev,
      players: updatedPlayers,
    } : null);
  }, [gameState]);

  // Global Synchronized Timer
  useEffect(() => {
    if (!gameState || gameState.phase !== 'player-turn') return;
    
    const timer = setInterval(() => {
      setGameState(prev => {
        if (!prev) return null;
        if (prev.timeLeft <= 1) {
           // Timer hit zero!
           // All active players who haven't stood or busted are forced to stand
           const finalPlayers = prev.players.map(p => 
              p.status === 'playing' ? { ...p, status: 'standing' as any } : p
           );
           return {
              ...prev,
              players: finalPlayers,
              phase: 'dealer-turn',
              dealer: { ...prev.dealer, hidden: false },
              timeLeft: 0
           };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.phase]);

  // Parallel Bot Logic (Bots act during the synchronized window)
  useEffect(() => {
    if (!gameState || gameState.phase !== 'player-turn') return;

    const botsThinking = gameState.players.filter(p => p.isBot && p.status === 'playing');
    if (botsThinking.length === 0) return;

    const timer = setTimeout(() => {
      setGameState(prev => {
        if (!prev) return null;
        
        let changed = false;
        let newDeck = [...prev.deck];
        const newPlayers = prev.players.map(p => {
          if (p.isBot && p.status === 'playing') {
            const score = calculateScore(p.hand);
            const dealerUpCard = prev.dealer.hand[0];
            const dealerScore = calculateScore([dealerUpCard]);

            // Simple bot strategy with a bit of randomness so they don't all act at once
            if (Math.random() > 0.7) {
              changed = true;
              let action: 'hit' | 'stand' = 'stand';
              if (score < 12) action = 'hit';
              else if (score >= 12 && score <= 16) {
                action = dealerScore >= 7 ? 'hit' : 'stand';
              }

              if (action === 'hit' && newDeck.length > 0) {
                const card = newDeck.pop()!;
                const hand = [...p.hand, card];
                const s = calculateScore(hand);
                return { ...p, hand, status: s > 21 ? 'busted' : 'playing' as any };
              } else {
                return { ...p, status: 'standing' as any };
              }
            }
          }
          return p;
        });

        if (!changed) return prev;
        return { ...prev, players: newPlayers, deck: newDeck };
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.timeLeft]);

  // Dealer Turn Effect
  useEffect(() => {
    if (!gameState || gameState.phase !== 'dealer-turn' || gameState.gameOver) return;

    const timer = setTimeout(() => {
      const dealerScore = calculateScore(gameState.dealer.hand);
      
      if (dealerScore < 17) {
        setGameState(prev => {
          if (!prev) return null;
          const newDeck = [...prev.deck];
          if (newDeck.length === 0) return prev;
          const newCard = newDeck.pop()!;
          return {
            ...prev,
            dealer: {
              ...prev.dealer,
              hand: [...prev.dealer.hand, newCard],
              hidden: false
            },
            deck: newDeck
          };
        });
      } else {
        // Dealer is done, wait a bit then resolve
        setTimeout(() => {
          setGameState(prev => prev ? { ...prev, phase: 'round-end' } : null);
        }, 1000);
      }
    }, 800); 

    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.dealer.hand]);

  // Round Resolution
  useEffect(() => {
    if (!gameState || gameState.phase !== 'round-end') return;

    const dealerScore = calculateScore(gameState.dealer.hand);
    const updatedPlayers = gameState.players.map(p => {
      if (p.status === 'eliminated') return p;
      const playerScore = calculateScore(p.hand);
      
      // Elimination conditions
      let shouldEliminate = false;
      if (playerScore > 21) shouldEliminate = true;
      else if (dealerScore <= 21 && playerScore < dealerScore) shouldEliminate = true;

      if (shouldEliminate) {
        if (p.id === 'player-1') {
          setEliminatedPlayer('YOU');
          if (auth.currentUser) {
            trackGameResult(auth.currentUser.uid, 'offline', false);
          }
        }
        return { ...p, status: 'eliminated' as PlayerStatus };
      }
      return p;
    });

    const timer = setTimeout(() => {
      setGameState(prev => {
        if (!prev) return null;
        // Check if game over (only your player left alive)
        const alivePlayers = updatedPlayers.filter(p => p.status !== 'eliminated');
        if (alivePlayers.length <= 1) {
           const winner = alivePlayers[0] || updatedPlayers.find(p => p.id === 'player-1');
           
           // If user wins, increment count
           if (winner?.id === 'player-1') {
              const newWins = userWins + 1;
              setUserWins(newWins);
              
              if (auth.currentUser) {
                trackGameResult(auth.currentUser.uid, 'offline', true, auth.currentUser.displayName || undefined);
              }
              
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
              });
           }

           return {
              ...prev,
              players: updatedPlayers,
              phase: 'game-over',
              winnerId: winner?.id || null,
              gameOver: true
           };
        }

        return {
          ...prev,
          players: updatedPlayers,
          round: prev.round + 1,
        };
      });
      
      setGameState(prev => {
        if (!prev || prev.phase === 'game-over') return prev;
        startRound(prev.players, prev.deck);
        return prev;
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameState?.phase]);

  const currentPlayer = gameState ? gameState.players.find(p => p.id === 'player-1') : null;

  const getDealerMood = (): DealerMood => {
    if (!gameState) return 'neutral';
    const dealerScore = calculateScore(gameState.dealer.hand);
    const playerScore = gameState.players[0] ? calculateScore(gameState.players[0].hand) : 0;

    if (gameState.phase === 'dealer-turn') return 'thinking';
    if (gameState.phase === 'round-end' || gameState.phase === 'game-over') {
      if (dealerScore > 21) return 'shocked';
      if (playerScore > 21 || (dealerScore <= 21 && dealerScore > playerScore)) return 'happy';
      if (playerScore <= 21 && (dealerScore < playerScore)) return 'sad';
    }
    if (gameState.players[0]?.status === 'busted') return 'smug';
    return 'neutral';
  };

  return (
    <div className="min-h-screen bg-bg-dark text-white font-sans selection:bg-stake-green selection:text-bg-dark overflow-hidden flex flex-col">
      {/* Profile Button in Corner */}
      <div className="fixed top-6 right-6 z-50">
        {currentUser ? (
          <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center space-x-3 bg-bg-accent hover:bg-white/5 border border-white/5 px-4 py-2 rounded-2xl transition-all"
          >
            <div className="w-8 h-8 bg-stake-green/20 rounded-full flex items-center justify-center border border-stake-green/30">
              <User size={16} className="text-stake-green" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Elite Player</div>
              <div className="text-xs font-black text-white truncate max-w-[100px]">{currentUser.displayName || 'PLAYER'}</div>
            </div>
          </button>
        ) : (
          <button 
            onClick={() => setShowAuth(true)}
            className="bg-stake-green text-bg-dark px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-400 transition-all shadow-lg shadow-stake-green/20"
          >
            Join Table
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
        {showProfile && <ProfileOverlay onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      {!mode && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-12"
          >
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className="p-4 bg-indigo-accent rounded-2xl rotate-12 shadow-2xl shadow-indigo-accent/30 border-2 border-white/10">
                <Skull className="text-white w-10 h-10" />
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic stake-gradient-text leading-none">
                Blackjack 99
              </h1>
            </div>
            <p className="text-gray-400 max-w-md mx-auto text-lg font-medium tracking-tight">
              The high-stakes survival battle royale. <span className="text-white">99 players</span> enter, only <span className="text-stake-green">one</span> survives.
            </p>

            {userWins > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 inline-flex items-center space-x-3 bg-stake-green/10 border border-stake-green/20 px-6 py-2 rounded-full shadow-lg shadow-stake-green/5"
              >
                <Trophy size={16} className="text-stake-green" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-stake-green">
                  {userWins} {userWins === 1 ? 'Victory' : 'Victories'} Recorded
                </span>
              </motion.div>
            )}
          </motion.div>

          <DailyLeaderboard />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            <motion.button
              whileHover={{ scale: 1.02, translateY: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('offline')}
              className="group relative overflow-hidden bg-bg-accent border-2 border-white/5 hover:border-stake-green/50 p-10 rounded-[2.5rem] transition-all duration-500 shadow-2xl"
            >
              <div className="absolute top-6 right-6 text-white/10 group-hover:text-stake-green/20 transition-all duration-500 transform group-hover:scale-125 group-hover:rotate-12">
                <Cpu size={64} />
              </div>
              <div className="flex flex-col items-start relative z-10">
                <div className="bg-stake-green/10 text-stake-green px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-stake-green/20">Solo Entry</div>
                <h3 className="text-3xl font-black mb-3 italic tracking-tight">Offline Arena</h3>
                <p className="text-gray-400 text-sm text-left max-w-[200px]">Hunt down 98 bots in a high-speed elimination match.</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, translateY: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('online')}
              className="group relative overflow-hidden bg-bg-accent border-2 border-white/5 hover:border-indigo-accent/50 p-10 rounded-[2.5rem] transition-all duration-500 shadow-2xl"
            >
              <div className="absolute top-6 right-6 text-white/10 group-hover:text-indigo-accent/20 transition-all duration-500 transform group-hover:scale-125 group-hover:rotate-12">
                <User size={64} />
              </div>
              <div className="flex flex-col items-start relative z-10">
                <div className="bg-indigo-accent/10 text-indigo-accent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-indigo-accent/20">Multiplayer</div>
                <h3 className="text-3xl font-black mb-3 italic tracking-tight">Online Royale</h3>
                <p className="text-gray-400 text-sm text-left max-w-[200px]">The ultimate test. Play against real survivors for the crown.</p>
              </div>
            </motion.button>
          </div>

          <div className="mt-12 flex items-center space-x-6 text-text-secondary">
             <div className="flex items-center space-x-2">
                <Info size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Fair Play Guaranteed</span>
             </div>
          </div>
        </div>
      )}

      {mode === 'online' && !onlineRoom && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-bg-dark">
          <div className="mb-8 flex items-center space-x-3">
             <div className="p-2 bg-stake-green rounded-xl rotate-12">
                <Skull className="text-bg-dark w-6 h-6" />
             </div>
             <h1 className="text-3xl font-black italic uppercase tracking-tighter">Online Royale</h1>
          </div>
          <OnlineLobby onJoinRoom={(id, isHost) => setOnlineRoom({ id, isHost })} />
          <button 
            onClick={() => setMode(null)}
            className="mt-8 text-text-secondary hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            ← Back to Menu
          </button>
        </div>
      )}

      {mode === 'online' && onlineRoom && (
        <OnlineGame 
          roomId={onlineRoom.id} 
          isHost={onlineRoom.isHost} 
          onExit={() => { setOnlineRoom(null); setMode(null); }}
        />
      )}

      {mode === 'offline' && !gameState && (
        <div className="flex-1 flex flex-col items-center justify-center">
           <Play 
             size={64} 
             className="text-stake-green animate-pulse cursor-pointer border-4 border-stake-green p-4 rounded-full"
             onClick={() => initializeGame(99)}
           />
           <span className="mt-4 text-xs font-bold uppercase tracking-widest text-text-secondary">Click to start Battle Royale</span>
           <button 
            onClick={() => setMode(null)}
            className="mt-12 text-text-secondary hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            ← Back to Menu
          </button>
        </div>
      )}

      {mode === 'offline' && gameState && (
        <div className="flex-1 relative flex flex-col p-4 md:p-8 xl:px-80">
          <BattleRoyaleHUD players={gameState.players} round={gameState.round} />
          
          {/* Dual Sidebars */}
          <SidebarPlayerList 
            players={gameState.players.filter(p => p.id !== 'player-1').slice(0, Math.ceil((gameState.players.length - 1) / 2))} 
            side="left" 
          />
          <SidebarPlayerList 
            players={gameState.players.filter(p => p.id !== 'player-1').slice(Math.ceil((gameState.players.length - 1) / 2))} 
            side="right" 
          />

          {/* Elimination Toast (Top Center) */}
          <AnimatePresence>
            {gameState.phase === 'round-end' && gameState.players.some(p => p.status === 'eliminated') && (
              <motion.div 
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 80, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className="fixed left-1/2 -translate-x-1/2 z-50 bg-stake-red px-6 py-2 rounded-full font-black text-[10px] shadow-2xl flex items-center gap-3 uppercase tracking-widest border border-white/20"
              >
                <Skull size={14} />
                PLAYER ELIMINATIONS IN PROGRESS
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dealer Area */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="relative group">
              {/* Dealer Avatar Backdrop */}
              <div className="absolute left-1/2 -top-16 -translate-x-1/2 w-48 h-48 -z-10 bg-gradient-to-b from-stake-green/20 via-stake-green/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-1000" />
              
              <div className="relative z-10 flex flex-col items-center">
                <DealerAvatar mood={getDealerMood()} className="mb-1 scale-75" />
                <div className="text-[10px] uppercase font-black text-stake-green tracking-[0.4em] text-center mb-2 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">The Dealer</div>
                
                <div className="flex justify-center space-x-2 min-h-[100px] scale-90">
                  {gameState.dealer.hand.map((card, i) => (
                    <CardComponent 
                      key={i} 
                      card={card} 
                      hidden={gameState.dealer.hidden && i === 1} 
                      index={i}
                    />
                  ))}
                </div>
              </div>

              {!gameState.dealer.hidden && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white text-bg-dark font-black px-4 py-1 rounded-full text-xs animate-in zoom-in shadow-xl">
                  TOTAL: {calculateScore(gameState.dealer.hand)}
                </div>
              )}
            </div>

            {/* Main Table Divider */}
            <div className="w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-stake-blue to-transparent opacity-50" />

            {/* User Area */}
            <div className="flex flex-col items-center relative py-2 w-full max-w-4xl">
              <div className="flex justify-center space-x-3 mb-4 min-h-[110px] scale-90">
                {gameState.players[0].hand.map((card, i) => (
                  <CardComponent key={i} card={card} index={i} />
                ))}
              </div>
              
              <div className="flex items-center space-x-4">
                 <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/5 flex items-center space-x-4 shadow-inner">
                    <User className="text-cyan-accent w-5 h-5" />
                    <div>
                      <div className="text-[9px] uppercase font-black text-gray-500 tracking-[0.2em]">Your Value</div>
                      <div className="text-2xl font-black text-white tabular-nums">{calculateScore(gameState.players[0].hand)}</div>
                    </div>
                 </div>

                 {gameState.phase === 'player-turn' && !currentPlayer?.isBot && (
                   <div className="flex items-center space-x-4">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleHit}
                        className="h-16 px-10 bg-stake-green text-bg-dark font-black rounded-2xl shadow-xl shadow-stake-green/10 uppercase tracking-widest flex flex-col items-center justify-center group"
                      >
                        <span className="text-[9px] font-black opacity-60 group-hover:opacity-100 uppercase tracking-[0.1em]">Take Card</span>
                        <span className="text-xl leading-none">Hit</span>
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStand}
                        className="h-16 px-10 bg-stake-red text-white font-black rounded-2xl shadow-xl shadow-stake-red/10 uppercase tracking-widest flex flex-col items-center justify-center group"
                      >
                        <span className="text-[9px] font-black opacity-60 group-hover:opacity-100 uppercase tracking-[0.1em]">Hold Total</span>
                        <span className="text-xl leading-none">Stand</span>
                      </motion.button>
                   </div>
                 )}
              </div>

              {/* Timer Bar */}
              {gameState.phase === 'player-turn' && !currentPlayer?.isBot && (
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-80 bg-white/5 p-4 rounded-2xl border border-white/5">
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-gray-400">
                        <TimerIcon size={12} />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Decision Timer</span>
                      </div>
                      <span className={cn("text-xs font-mono font-bold", gameState.timeLeft < 5 ? "text-stake-red animate-pulse" : "text-cyan-accent")}>
                        00:{gameState.timeLeft.toString().padStart(2, '0')}s
                      </span>
                   </div>
                   <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: '100%' }}
                        animate={{ width: `${(gameState.timeLeft / TURN_TIME_LIMIT) * 100}%` }}
                        className={cn("h-full bg-gradient-to-r from-blue-400 to-cyan-300 transition-colors", gameState.timeLeft < 5 && "from-stake-red to-red-400")}
                      />
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Overlays */}
          <AnimatePresence>
            {eliminatedPlayer && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-dark/80 backdrop-blur-xl p-8"
              >
                <div className="text-center">
                   <div className="inline-block p-6 bg-red-500 rounded-3xl shadow-2xl shadow-red-500/40 mb-6">
                      <Skull size={80} className="text-white" />
                   </div>
                   <h2 className="text-7xl font-black italic uppercase tracking-tighter text-white mb-2">ELIMINATED</h2>
                   <p className="text-text-secondary text-xl mb-12">You failed to survive Round {gameState.round}.</p>
                   <div className="flex flex-col space-y-4 items-center">
                     <button 
                       onClick={() => { setEliminatedPlayer(null); setGameState(null); }}
                       className="w-full bg-white text-bg-dark px-12 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-transform"
                     >
                       Try Again
                     </button>
                     <button 
                       onClick={() => { setEliminatedPlayer(null); setGameState(null); setMode(null); }}
                       className="text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                     >
                       Return to Menu
                     </button>
                   </div>
                </div>
              </motion.div>
            )}

            {gameState.phase === 'game-over' && gameState.winnerId && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-stake-green/10 backdrop-blur-xl p-8"
              >
                <div className="text-center max-w-lg">
                   <div className="inline-block p-8 bg-stake-green rounded-full shadow-2xl shadow-stake-green/40 mb-8 border-[12px] border-white/20">
                      <Trophy size={100} className="text-bg-dark" />
                   </div>
                   <h2 className="text-8xl font-black italic uppercase tracking-tighter text-white leading-none mb-4">CHAMPION</h2>
                   <p className="text-stake-green text-2xl font-bold uppercase tracking-[0.3em] mb-12">Sole Survivor</p>
                   
                   <div className="bg-bg-accent p-8 rounded-3xl border border-stake-green/30 mb-8">
                      <div className="text-text-secondary text-xs font-bold uppercase mb-2">Battle Statistics</div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-bg-dark p-4 rounded-xl border border-white/5">
                            <div className="text-[10px] text-text-secondary uppercase">Rounds Survived</div>
                            <div className="text-3xl font-black text-white">{gameState.round}</div>
                         </div>
                         <div className="bg-bg-dark p-4 rounded-xl border border-white/5">
                            <div className="text-[10px] text-text-secondary uppercase">Players Beaten</div>
                            <div className="text-3xl font-black text-white">{gameState.players.length - 1}</div>
                         </div>
                      </div>
                   </div>

                   <div className="flex flex-col space-y-4 items-center">
                     <button 
                       onClick={() => { setGameState(null); }}
                       className="w-full bg-stake-green text-bg-dark px-12 py-5 rounded-2xl font-black uppercase tracking-widest hover:shadow-xl hover:shadow-stake-green/20 transition-all flex items-center justify-center space-x-3"
                     >
                       <RotateCcw size={24} />
                       <span>Re-enter Arena</span>
                     </button>
                     <button 
                       onClick={() => { setGameState(null); setMode(null); }}
                       className="text-white/40 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
                     >
                       Return to Main Menu
                     </button>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
