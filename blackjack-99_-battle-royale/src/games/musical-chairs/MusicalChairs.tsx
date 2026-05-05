import React, { useEffect, useRef, useState } from 'react';

type Player = { id: string; name: string; eliminated: boolean };

export const Game: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [running, setRunning] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const roundRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // initialize default players (YOU + 7 bots)
    const initial: Player[] = [{ id: 'player-1', name: 'YOU', eliminated: false }];
    for (let i = 2; i <= 8; i++) {
      initial.push({ id: `bot-${i}`, name: `Bot ${i - 1}`, eliminated: false });
    }
    setPlayers(initial);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const startRound = () => {
    if (winner) return;
    setRunning(true);
    setMusicPlaying(true);

    // music plays for random 1.5-4.5s
    const t = 1500 + Math.floor(Math.random() * 3000);
    timeoutRef.current = window.setTimeout(() => stopMusic(), t);
  };

  const stopMusic = () => {
    setMusicPlaying(false);
    // eliminate one random non-eliminated player (prefer bots)
    setPlayers((prev) => {
      const alive = prev.filter((p) => !p.eliminated);
      if (alive.length <= 1) return prev;

      // prefer eliminating a bot; if only YOU remain with bots eliminated, eliminate a bot
      const bots = alive.filter((p) => p.id !== 'player-1');
      const candidatePool = bots.length > 0 ? bots : alive;
      const idx = Math.floor(Math.random() * candidatePool.length);
      const toEliminate = candidatePool[idx];

      const next = prev.map((p) => (p.id === toEliminate.id ? { ...p, eliminated: true } : p));

      // check winner
      const stillAlive = next.filter((p) => !p.eliminated);
      if (stillAlive.length === 1) {
        setWinner(stillAlive[0]);
        setRunning(false);
      } else {
        // prep next round automatically after a short pause
        roundRef.current += 1;
        timeoutRef.current = window.setTimeout(() => startRound(), 900);
      }

      return next;
    });
  };

  const resetGame = () => {
    setWinner(null);
    setRunning(false);
    setMusicPlaying(false);
    roundRef.current = 0;
    setPlayers((prev) => prev.map((p) => ({ ...p, eliminated: false })));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-900 text-white">
      <div className="w-full max-w-2xl bg-[#111827] p-8 rounded-2xl border border-white/5">
        <h2 className="text-3xl font-black mb-4">Musical Chairs</h2>

        <p className="text-sm text-gray-300 mb-6">
          A lightweight musical chairs simulator. Press Start to play — music will stop randomly and one player will be removed each round until a winner remains.
        </p>

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => (running ? stopMusic() : startRound())}
            className="bg-stake-green text-bg-dark px-4 py-2 rounded-2xl font-black uppercase text-sm"
          >
            {running ? (musicPlaying ? 'Stop Music' : 'Force Stop') : 'Start'}
          </button>

          <button
            onClick={resetGame}
            className="bg-white/5 px-4 py-2 rounded-2xl font-black uppercase text-sm"
          >
            Reset
          </button>

          <div className="ml-auto text-xs text-gray-400">Round: {roundRef.current}</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {players.map((p) => (
            <div
              key={p.id}
              className={`p-4 rounded-xl border border-white/5 text-center ${p.eliminated ? 'opacity-30 line-through' : ''}`}
            >
              <div className="text-sm font-black">{p.name}</div>
              <div className="text-[10px] text-gray-400 mt-1">{p.eliminated ? 'Out' : 'Seated'}</div>
            </div>
          ))}
        </div>

        {winner && (
          <div className="mt-6 bg-white/5 p-4 rounded-xl text-center">
            <div className="font-black text-lg">Winner: {winner.name}</div>
            <div className="text-xs text-gray-300 mt-1">Thanks for playing!</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Game;
