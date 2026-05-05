import { useState, useEffect, useRef } from 'react';
import { Game, Player, Chair } from '../types';
import { gameService } from '../services/gameService';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Crown, ArrowLeft, Play, Timer, Music, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface GameSessionProps {
  gameId: string;
  onExit: () => void;
  key?: string;
}

export function GameSession({ gameId, onExit }: GameSessionProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null); // For future music support

  const isHost = game?.hostId === auth.currentUser?.uid;
  const me = players.find(p => p.uid === auth.currentUser?.uid);

  useEffect(() => {
    const unsubGame = gameService.subscribeToGame(gameId, setGame);
    const unsubPlayers = gameService.subscribeToPlayers(gameId, setPlayers);
    const unsubChairs = gameService.subscribeToChairs(gameId, setChairs);

    return () => {
      unsubGame();
      unsubPlayers();
      unsubChairs();
    };
  }, [gameId]);

  // Timer logic
  useEffect(() => {
    if (game?.status !== 'playing' || !game.timerStartTime) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - game.timerStartTime!) / 1000);
      const remaining = Math.max(0, game.timerValue - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && isHost) {
        // Round actually ends on timer reaching zero
        // In a real production app, we'd have a cloud function or stricter state
        // but for this demo, host triggers the transition
      }
    }, 100);

    return () => clearInterval(interval);
  }, [game?.status, game?.timerValue, game?.timerStartTime, isHost]);

  const handleStart = () => {
    if (players.length < 2) {
      alert('Need at least 2 players to start!');
      return;
    }
    gameService.startGame(gameId, players.length);
  };

  const handleClaim = (chairId: string) => {
    if (game?.status !== 'playing' || timeLeft > 0) return;
    if (me?.isEliminated || me?.chairId) return;
    gameService.claimChair(gameId, chairId);
  };

  if (!game) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 h-full flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-12">
        <button 
          onClick={onExit}
          className="flex items-center gap-2 group transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-game-pop flex items-center justify-center btn-tactile border-pink-700">
            <ArrowLeft className="text-white" size={18} strokeWidth={3} />
          </div>
          <span className="label-micro group-hover:text-white">Exit Arena</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="bg-game-dark px-6 py-3 rounded-2xl border-2 border-indigo-400/30 flex flex-col items-center">
            <span className="label-micro !text-indigo-300 leading-none mb-1">Room Code</span>
            <span className="text-xl font-black text-game-accent font-mono leading-none">{gameId}</span>
          </div>
        </div>
      </div>

      <main className="w-full grid grid-cols-1 md:grid-cols-12 gap-12 items-start h-full">
        <div className="md:col-span-8 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {game.status === 'lobby' && (
              <LobbyView 
                players={players} 
                isHost={isHost} 
                onStart={handleStart} 
              />
            )}

            {(game.status === 'playing' || game.status === 'elimination') && (
              <GameBoard 
                game={game} 
                players={players} 
                chairs={chairs} 
                timeLeft={timeLeft}
                me={me}
                isHost={isHost}
                onClaim={handleClaim}
              />
            )}

            {game.status === 'ended' && (
              <WinnerView
                 winner={players.find(p => p.uid === game.winnerId)}
                 onExit={onExit}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar: Survivors List */}
        <div className="md:col-span-4 space-y-8">
          <div className="bg-white rounded-[40px] p-8 text-game-dark shadow-2xl flex flex-col min-h-[400px]">
            <h2 className="text-2xl font-black uppercase italic mb-6 flex items-center gap-3">
              <span className="w-3 h-8 bg-game-bg rounded-full"></span>
              Survivors
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
              {players.sort((a, b) => (a.isEliminated === b.isEliminated ? 0 : a.isEliminated ? 1 : -1)).map((player) => (
                <div 
                  key={player.uid}
                  className={cn(
                    "flex justify-between items-center p-4 rounded-2xl transition-all border-b-4",
                    player.isEliminated 
                      ? "opacity-30 grayscale border-transparent" 
                      : "bg-indigo-50 border-indigo-100"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl border-b-4 flex items-center justify-center font-black italic shadow-sm"
                      style={{ 
                        backgroundColor: player.color, 
                        borderColor: `${player.color}99`,
                        color: 'white'
                      }}
                    >
                      {player.displayName[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className={cn("font-black tracking-tight uppercase italic", player.isEliminated && "line-through")}>
                        {player.displayName}
                      </span>
                      {player.uid === game.hostId && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Host</span>
                      )}
                    </div>
                  </div>
                  {player.isEliminated && (
                    <span className="text-[10px] font-black text-red-500/50 uppercase tracking-widest">Eliminated</span>
                  )}
                  {!player.isEliminated && player.chairId && (
                    <div className="w-6 h-6 rounded-md bg-game-success flex items-center justify-center">
                       <Play size={10} className="text-game-void" fill="currentColor" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-game-accent rounded-[32px] p-8 text-game-dark border-b-8 border-yellow-600 shadow-xl">
            <h3 className="text-xl font-black uppercase italic leading-tight mb-3">Be Ready!</h3>
            <p className="font-bold text-game-dark/80 leading-snug">
              Click a <span className="underline decoration-4">CHAIR</span> as soon as the music stops to stay in the game!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function LobbyView({ players, isHost, onStart }: { players: Player[], isHost: boolean, onStart: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="w-full game-card p-16 text-center"
    >
      <div className="mb-12">
        <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-4">Lobby Waiting</h2>
        <p className="text-indigo-200/60 font-medium max-w-sm mx-auto">Wait for the crew. The battle begins as soon as the host hits play.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 mb-16">
        {players.map((p) => (
          <motion.div
            key={p.uid}
            layout
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div 
              className="w-20 h-20 rounded-[2rem] border-b-8 flex items-center justify-center text-3xl font-black italic text-white shadow-2xl transition-transform hover:scale-110"
              style={{ backgroundColor: p.color, borderColor: `${p.color}88` }}
            >
              {p.displayName[0].toUpperCase()}
            </div>
          </motion.div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={players.length < 2}
          className="bg-game-pop text-white px-16 py-6 rounded-3xl btn-tactile border-pink-700 text-2xl shadow-[0_20px_50px_rgba(236,72,153,0.3)] disabled:opacity-30 disabled:translate-y-0"
        >
          Begin The Chaos
        </button>
      ) : (
        <div className="flex items-center justify-center gap-4 py-6 bg-game-void/40 rounded-2xl border border-white/5">
           <div className="w-3 h-3 bg-game-accent rounded-full animate-ping" />
           <p className="label-micro !text-game-accent mb-0">Waiting for host to drop the beat...</p>
        </div>
      )}
    </motion.div>
  );
}

function GameBoard({ game, players, chairs, timeLeft, me, isHost, onClaim }: { 
  game: Game, 
  players: Player[], 
  chairs: Chair[], 
  timeLeft: number, 
  me?: Player,
  isHost: boolean,
  onClaim: (id: string) => void
}) {
  const activePlayers = players.filter(p => !p.isEliminated);
  const rotationActive = timeLeft > 0;

  return (
    <div className="relative w-full aspect-square max-w-[650px]">
      {/* Game Overlays */}
      <div className="absolute top-0 left-0 w-full flex justify-between z-40">
        <div className="bg-game-void/80 backdrop-blur-md border-2 border-indigo-400/20 px-6 py-4 rounded-3xl">
           <span className="label-micro">Round</span>
           <div className="text-3xl font-black tracking-tighter uppercase italic">
             {game.currentRound < 10 ? `0${game.currentRound}` : game.currentRound}
           </div>
        </div>
        <div className="bg-game-void/80 backdrop-blur-md border-2 border-indigo-400/20 px-6 py-4 rounded-3xl text-right">
           <span className="label-micro">In Play</span>
           <div className="text-3xl font-black tracking-tighter uppercase italic text-game-success">
             {activePlayers.length} Souls
           </div>
        </div>
      </div>

      {/* The Central Timer Box Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
        <AnimatePresence mode="wait">
          {rotationActive ? (
            <motion.div 
              key="timer"
              className="bg-white text-game-void w-48 h-48 rounded-[3rem] flex flex-col items-center justify-center border-[12px] border-game-accent shadow-[0_30px_100px_rgba(0,0,0,0.4)]"
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 1.2, opacity: 0 }}
            >
              <span className="text-7xl font-black italic leading-none">{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
              <span className="label-micro !text-game-void/40 mt-1">Seconds</span>
            </motion.div>
          ) : (
            <motion.div
               key="stop"
               className="bg-red-500 px-12 py-6 rounded-3xl shadow-[0_0_80px_rgba(239,68,68,0.6)] border-b-8 border-red-800"
               initial={{ scale: 0.5, opacity: 0 }}
               animate={{ scale: [1, 1.2, 1], opacity: 1 }}
               transition={{ repeat: Infinity, duration: 0.5 }}
            >
               <span className="text-5xl font-black italic tracking-tighter text-white">CHAIRS!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Arena Ring */}
      <div className="relative w-full h-full flex items-center justify-center bg-game-dark/20 rounded-full border-8 border-dashed border-indigo-400/10">
        {/* Chairs */}
        <div className="absolute inset-0 z-20">
          {chairs.map((chair) => (
            <div
              key={chair.id}
              className="absolute"
              style={{
                left: `calc(50% + ${40 * Math.cos((chair.angle * Math.PI) / 180)}%)`,
                top: `calc(50% + ${40 * Math.sin((chair.angle * Math.PI) / 180)}%)`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <button
                onClick={() => onClaim(chair.id)}
                disabled={!!chair.claimedBy || rotationActive || me?.isEliminated || !!me?.chairId}
                className={cn(
                  "w-20 h-20 rounded-[1.5rem] flex items-center justify-center transition-all relative overflow-hidden border-b-4",
                  chair.claimedBy 
                    ? "bg-game-void shadow-inner border-transparent" 
                    : rotationActive 
                      ? "bg-game-dark/20 opacity-30 cursor-not-allowed border-transparent" 
                      : "bg-game-success hover:bg-game-accent hover:scale-110 active:scale-95 shadow-[0_15px_30px_rgba(52,211,153,0.3)] cursor-pointer border-emerald-700"
                )}
              >
                {!chair.claimedBy && !rotationActive && (
                  <div className="w-10 h-10 border-4 border-white/40 rounded-xl flex items-center justify-center" />
                )}
                
                {chair.claimedBy && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center font-black italic text-2xl text-white shadow-inner"
                    style={{ backgroundColor: players.find(p => p.uid === chair.claimedBy)?.color }}
                  >
                     {players.find(p => p.uid === chair.claimedBy)?.displayName[0].toUpperCase()}
                  </motion.div>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Players revolving */}
        <motion.div
           className="absolute inset-0 pointer-events-none"
           animate={{ rotate: rotationActive ? 360 : 0 }}
           transition={{ 
             duration: rotationActive ? 12 : 0.8, 
             repeat: rotationActive ? Infinity : 0, 
             ease: rotationActive ? "linear" : "backOut" 
           }}
        >
          {activePlayers.map((player, idx) => {
             const angle = (idx / activePlayers.length) * 360;
             return (
               <div
                 key={player.uid}
                 className="absolute"
                 style={{
                   left: `calc(50% + ${28 * Math.cos((angle * Math.PI) / 180)}%)`,
                   top: `calc(50% + ${28 * Math.sin((angle * Math.PI) / 180)}%)`,
                   transform: 'translate(-50%, -50%)',
                 }}
               >
                 <motion.div
                    animate={{ rotate: rotationActive ? -360 : 0 }}
                    transition={{ duration: rotationActive ? 12 : 0.8, repeat: rotationActive ? Infinity : 0, ease: rotationActive ? "linear" : "backOut" }}
                 >
                    <div 
                      className="w-14 h-14 rounded-full border-4 border-white shadow-[0_10px_20px_rgba(0,0,0,0.5)] ring-8 flex items-center justify-center font-black text-xl italic text-white"
                      style={{ backgroundColor: player.color, ringColor: `${player.color}33` }}
                    >
                      {player.displayName[0].toUpperCase()}
                    </div>
                 </motion.div>
               </div>
             );
          })}
        </motion.div>
      </div>

      {/* Elimination Modal/Overlay */}
      <AnimatePresence>
        {game.status === 'elimination' && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute -bottom-8 left-0 w-full z-50 px-12"
          >
            <div className="bg-game-void/90 backdrop-blur-2xl border-4 border-game-pop p-10 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-game-pop to-transparent" />
               <h4 className="text-game-pop font-black uppercase italic text-4xl mb-2 tracking-tighter">ELIMINATED</h4>
               <p className="text-xl font-medium text-white/80">
                  <span className="font-black italic text-game-accent">
                    {players.find(p => p.uid === game.lastEliminatedId)?.displayName}
                  </span> didn't grab a seat!
               </p>
               
               {isHost && (
                 <button
                   onClick={() => gameService.nextRound(game.id)}
                   className="mt-8 bg-white text-game-void px-12 py-4 rounded-2xl btn-tactile border-indigo-200 text-xl font-black uppercase italic"
                 >
                   Launch Next Round
                 </button>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WinnerView({ winner, onExit }: { winner?: Player, onExit: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-xl text-center py-10"
    >
      <motion.div
         animate={{ y: [0, -30, 0], rotate: [0, 5, -5, 0] }}
         transition={{ duration: 3, repeat: Infinity }}
         className="inline-block p-10 rounded-[3rem] bg-game-accent/20 border-4 border-game-accent mb-12 shadow-[0_0_100px_rgba(250,204,21,0.3)]"
      >
        <Crown size={120} className="text-game-accent" strokeWidth={3} />
      </motion.div>
      
      <h2 className="text-7xl font-black italic tracking-tighter mb-4 uppercase leading-none">CROWN TAKEN!</h2>
      <p className="text-indigo-200/50 text-2xl font-bold mb-16 uppercase tracking-widest leading-none">The Final King Remains</p>
      
      <div className="bg-white rounded-[48px] p-12 mb-16 relative overflow-hidden group shadow-2xl text-game-dark border-b-[16px] border-indigo-100">
         <div 
           className="w-32 h-32 mx-auto rounded-[2.5rem] border-8 flex items-center justify-center text-5xl font-black italic mb-6 shadow-xl"
           style={{ backgroundColor: winner?.color, borderColor: `${winner?.color}55`, color: 'white' }}
         >
           {winner?.displayName[0].toUpperCase()}
         </div>
         <h3 className="text-4xl font-black uppercase italic italic mb-2 tracking-tighter">{winner?.displayName}</h3>
         <p className="label-micro !text-indigo-400">The Ultimate Survivor</p>
      </div>

      <button
        onClick={onExit}
        className="px-16 py-6 bg-game-pop text-white rounded-3xl btn-tactile border-pink-700 text-2xl shadow-2xl"
      >
        Return To Safety
      </button>
    </motion.div>
  );
}
