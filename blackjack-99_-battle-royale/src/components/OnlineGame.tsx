import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Card, Player, PlayerStatus } from '../types';
import { calculateScore, createDeck, isBlackjack } from '../lib/blackjack';
import { CardComponent } from './CardComponent';
import { BattleRoyaleHUD, SidebarPlayerList } from './BattleRoyaleHUD';
import { cn } from '../lib/utils';
import { Trophy, Skull, User, LogOut, Timer as TimerIcon } from 'lucide-react';
import confetti from 'canvas-confetti';

import { getUserStats, trackGameResult } from '../lib/user';
import { DealerAvatar, DealerMood } from './DealerAvatar';

interface OnlineGameProps {
  roomId: string;
  isHost: boolean;
  onExit: () => void;
}

export function OnlineGame({ roomId, isHost, onExit }: OnlineGameProps) {
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [eliminated, setEliminated] = useState(false);
  const [hasTrackedResult, setHasTrackedResult] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user || hasTrackedResult) return;

    if (room?.status === 'finished') {
       const isWin = room.winnerId === user.uid;
       trackGameResult(user.uid, 'online', isWin, user.displayName || 'Player');
       setHasTrackedResult(true);

       if (isWin) {
         confetti({
           particleCount: 200,
           spread: 100,
           origin: { y: 0.6 }
         });
       }
    }
    
    const myPlayer = players.find(p => p.userId === user.uid);
    if (myPlayer?.status === 'eliminated' && !hasTrackedResult) {
       trackGameResult(user.uid, 'online', false);
       setHasTrackedResult(true);
    }
  }, [room?.status, room?.winnerId, players, user, hasTrackedResult]);

  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomId);
    const unsubRoom = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        onExit();
        return;
      }
      setRoom({ id: snapshot.id, ...snapshot.data() });
    });

    const playersRef = collection(db, `rooms/${roomId}/players`);
    const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
      const playerList = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setPlayers(playerList);
      
      const me = playerList.find(p => p.userId === user?.uid);
      if (me?.status === 'eliminated') setEliminated(true);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId, user, onExit]);

  // Host Logic: Game Loop
  useEffect(() => {
    if (!isHost || !room || room.status !== 'playing') return;

    // Phase: Player Turn
    if (room.phase === 'player-turn') {
      const allDone = players.filter(p => !['eliminated'].includes(p.status)).every(p => p.status !== 'playing');
      if (allDone) {
        updateDoc(doc(db, 'rooms', roomId), { phase: 'dealer-turn', dealerHidden: false });
      }
    }

    // Phase: Dealer Turn
    if (room.phase === 'dealer-turn') {
      const dScore = calculateScore(room.dealerHand);
      if (dScore < 17) {
        const timer = setTimeout(() => {
          const deck = createDeck(); // In a real app we'd sync the deck, but fine for now
          const newCard = deck.pop()!;
          updateDoc(doc(db, 'rooms', roomId), { 
            dealerHand: [...room.dealerHand, newCard]
          });
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        updateDoc(doc(db, 'rooms', roomId), { phase: 'round-end' });
      }
    }

    // Phase: Round End
    if (room.phase === 'round-end') {
      const dealerScore = calculateScore(room.dealerHand);
      const timer = setTimeout(() => {
        // Resolve and start next round
        const alivePlayers = players.filter(p => p.status !== 'eliminated');
        alivePlayers.forEach(p => {
          const pScore = calculateScore(p.hand);
          if (pScore > 21 || (dealerScore <= 21 && pScore < dealerScore)) {
            updateDoc(doc(db, `rooms/${roomId}/players`, p.id), { status: 'eliminated' });
          } else {
             // Reset for next round
             updateDoc(doc(db, `rooms/${roomId}/players`, p.id), { status: 'playing', hand: [] });
          }
        });

        // Check for winner
        const remaining = players.filter(p => p.status !== 'eliminated');
        if (remaining.length === 1) {
          updateDoc(doc(db, 'rooms', roomId), { status: 'finished', winnerId: remaining[0].userId });
          confetti();
        } else {
          // Prepare next round
          const deck = createDeck();
          const d1 = deck.pop()!;
          const d2 = deck.pop()!;
          
          updateDoc(doc(db, 'rooms', roomId), { 
            phase: 'dealing',
            round: (room.round || 1) + 1,
            dealerHand: [d1, d2],
            dealerHidden: true
          });

          // Hand out cards in dealing phase
          setTimeout(() => {
            remaining.forEach(p => {
              const c1 = deck.pop()!;
              const c2 = deck.pop()!;
              updateDoc(doc(db, `rooms/${roomId}/players`, p.id), { hand: [c1, c2] });
            });
            updateDoc(doc(db, 'rooms', roomId), { phase: 'player-turn' });
          }, 2000);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isHost, room, players, roomId]);

  const startGame = async () => {
    if (!isHost) return;
    const deck = createDeck();
    const d1 = deck.pop()!;
    const d2 = deck.pop()!;

    await updateDoc(doc(db, 'rooms', roomId), { 
      status: 'playing', 
      phase: 'dealing',
      dealerHand: [d1, d2],
      dealerHidden: true
    });

    // Hand out cards
    players.forEach(async (p) => {
      const c1 = deck.pop()!;
      const c2 = deck.pop()!;
      await updateDoc(doc(db, `rooms/${roomId}/players`, p.id), { hand: [c1, c2], status: 'playing' });
    });

    setTimeout(() => {
      updateDoc(doc(db, 'rooms', roomId), { phase: 'player-turn' });
    }, 1500);
  };

  const handleAction = async (action: 'hit' | 'stand') => {
    const me = players.find(p => p.userId === user?.uid);
    if (!me || me.status !== 'playing' || !room || room.phase !== 'player-turn') return;

    if (action === 'stand') {
      await updateDoc(doc(db, `rooms/${roomId}/players`, me.id), { status: 'standing' });
    } else {
      const deck = createDeck();
      const newCard = deck.pop()!;
      const nextHand = [...me.hand, newCard];
      const score = calculateScore(nextHand);
      const nextStatus = score > 21 ? 'busted' : 'playing';
      await updateDoc(doc(db, `rooms/${roomId}/players`, me.id), { 
        hand: nextHand,
        status: nextStatus
      });
    }
  };

  if (!room) return null;

  const myPlayer = players.find(p => p.userId === user?.uid);

  const getDealerMood = (): DealerMood => {
    if (!room) return 'neutral';
    const dealerScore = calculateScore(room.dealerHand);
    const playerScore = myPlayer ? calculateScore(myPlayer.hand) : 0;

    if (room.phase === 'dealer-turn') return 'thinking';
    if (room.phase === 'round-end' || room.status === 'finished') {
      if (dealerScore > 21) return 'shocked';
      if (playerScore > 21 || (dealerScore <= 21 && dealerScore > playerScore)) return 'happy';
      if (playerScore <= 21 && (dealerScore < playerScore)) return 'sad';
    }
    if (myPlayer?.status === 'busted' || myPlayer?.status === 'eliminated') return 'smug';
    return 'neutral';
  };

  return (
    <div className="flex-1 flex flex-col relative xl:px-64">
      <BattleRoyaleHUD players={players} round={room.round || 1} />
      
      {/* Dual Sidebars */}
      <SidebarPlayerList 
        players={players.filter(p => p.userId !== user?.uid).slice(0, Math.ceil((players.length - 1) / 2))} 
        side="left" 
      />
      <SidebarPlayerList 
        players={players.filter(p => p.userId !== user?.uid).slice(Math.ceil((players.length - 1) / 2))} 
        side="right" 
      />

      {room.status === 'waiting' ? (
        <div className="flex-1 flex flex-col items-center justify-center">
           <div className="text-center mb-12">
              <div className="text-sm font-bold text-stake-green uppercase tracking-[0.3em] mb-4">Lobby Active</div>
              <h2 className="text-6xl font-black italic uppercase tracking-tighter mb-4">Waiting Room</h2>
              <p className="text-text-secondary">Current Participants: {players.length}</p>
           </div>
           
           <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-12 px-6">
              {players.map(p => (
                <div key={p.id} className="flex flex-col items-center space-y-2">
                   <div className="w-16 h-16 bg-bg-accent rounded-2xl border border-stake-blue flex items-center justify-center shadow-lg">
                      <User className="text-text-secondary" />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-wider truncate w-20 text-center">{p.name}</span>
                </div>
              ))}
           </div>

           {isHost ? (
             <button 
               onClick={startGame}
               className="bg-stake-green text-bg-dark font-black px-16 py-5 rounded-2xl uppercase tracking-widest shadow-2xl shadow-stake-green/20 hover:scale-105 transition-transform"
             >
               Start Battle Royale
             </button>
           ) : (
             <div className="text-text-secondary animate-pulse font-bold uppercase tracking-widest">
                Waiting for host to start...
             </div>
           )}
        </div>
      ) : room.status === 'playing' ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-4 pt-4">
           {/* Dealer */}
           <div className="relative group flex flex-col items-center">
              {/* Dealer Avatar Backdrop */}
              <div className="absolute left-1/2 -top-16 -translate-x-1/2 w-48 h-48 -z-10 bg-gradient-to-b from-indigo-accent/20 via-indigo-accent/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-1000" />
              
              <div className="relative z-10 flex flex-col items-center">
                <DealerAvatar mood={getDealerMood()} className="mb-1 scale-75" />
                <div className="text-[10px] uppercase font-black text-indigo-accent tracking-[0.4em] text-center mb-2 drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]">The Dealer</div>
                
                <div className="flex justify-center space-x-2 min-h-[100px] scale-90">
                  {room.dealerHand?.map((c: any, i: number) => (
                    <CardComponent key={i} card={c} hidden={room.dealerHidden && i === 1} index={i} />
                  ))}
                </div>
              </div>

              {!room.dealerHidden && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white text-bg-dark font-black px-4 py-1 rounded-full text-xs animate-in zoom-in shadow-xl">
                  TOTAL: {calculateScore(room.dealerHand)}
                </div>
              )}
           </div>

           <div className="w-full max-w-4xl h-px bg-stake-blue/50" />

           {/* Me */}
           <div className="flex flex-col items-center w-full max-w-4xl py-2">
              <div className="flex space-x-3 mb-4 min-h-[110px] scale-90">
                 {myPlayer?.hand?.map((c, i) => (
                   <CardComponent key={i} card={c} index={i} />
                 ))}
              </div>

              {myPlayer && (
                 <div className="flex flex-col items-center">
                    <div className="bg-black/40 px-6 py-2 rounded-2xl border border-white/5 mb-4 shadow-inner flex items-center gap-4">
                       <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Total Score</span>
                       <span className="text-3xl font-black text-white tabular-nums leading-none">{calculateScore(myPlayer.hand)}</span>
                    </div>

                    {room.phase === 'player-turn' && myPlayer.status === 'playing' && (
                       <div className="flex space-x-6">
                          <button 
                            onClick={() => handleAction('hit')}
                            className="bg-stake-green text-bg-dark h-16 w-36 font-black rounded-2xl shadow-xl shadow-stake-green/10 flex flex-col items-center justify-center group transform transition-all active:scale-95"
                          >
                            <span className="text-[9px] font-black opacity-60 uppercase tracking-widest leading-tight">Add Card</span>
                            <span className="text-xl uppercase">Hit</span>
                          </button>
                          <button 
                            onClick={() => handleAction('stand')}
                            className="bg-stake-red text-white h-16 w-36 font-black rounded-2xl shadow-xl shadow-stake-red/10 flex flex-col items-center justify-center group border border-white/10 transform transition-all active:scale-95"
                          >
                            <span className="text-[9px] font-black opacity-60 uppercase tracking-widest leading-tight">Stay Here</span>
                            <span className="text-xl uppercase">Stand</span>
                          </button>
                       </div>
                    )}

                    {myPlayer.status !== 'playing' && myPlayer.status !== 'eliminated' && (
                       <div className="text-stake-green font-black uppercase tracking-[0.3em] bg-stake-green/10 px-8 py-3 rounded-xl border border-stake-green/30 animate-pulse">
                          {myPlayer.status}
                       </div>
                    )}
                 </div>
              )}
           </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-stake-green/5">
           <Trophy size={80} className="text-stake-green mb-6" />
           <h2 className="text-6xl font-black italic uppercase tracking-tighter mb-2">BATTLE OVER</h2>
           <p className="text-text-secondary text-xl mb-12">Winner: {players.find(p => p.userId === room.winnerId)?.name || 'Unknown'}</p>
           <button 
             onClick={onExit}
             className="bg-white text-bg-dark font-black px-12 py-4 rounded-xl flex items-center space-x-3"
           >
              <LogOut size={20} />
              <span>Exit Lobby</span>
           </button>
        </div>
      )}

      {/* Elimination Overlay */}
      <AnimatePresence>
        {eliminated && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="fixed inset-0 z-[100] bg-bg-dark/90 backdrop-blur-xl flex flex-col items-center justify-center p-8"
           >
              <Skull size={100} className="text-red-500 mb-8" />
              <h2 className="text-7xl font-black italic uppercase tracking-tighter text-white mb-2">ELIMINATED</h2>
              <p className="text-text-secondary text-xl mb-12 text-center">You didn't survive values in Round {room.round}. Better luck next time.</p>
              <button 
                onClick={onExit}
                className="bg-white text-bg-dark font-black px-12 py-4 rounded-xl hover:scale-105 transition-all"
              >
                Back to Menu
              </button>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
