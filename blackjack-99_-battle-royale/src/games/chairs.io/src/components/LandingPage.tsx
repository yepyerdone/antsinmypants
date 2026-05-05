import { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Game } from '../types';
import { Plus, Users, Hash, ArrowRight, Music } from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onJoinGame: (id: string) => void;
  key?: string;
}

export function LandingPage({ onJoinGame }: LandingPageProps) {
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'games'), 
      where('status', '==', 'lobby'),
      where('isPublic', '==', true)
    );
    
    return onSnapshot(q, (snap) => {
      setActiveGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
    });
  }, []);

  const handleCreate = async (isPublic: boolean) => {
    setLoading(true);
    try {
      const id = await gameService.createGame(isPublic);
      if (id) onJoinGame(id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode) return;
    setLoading(true);
    try {
      await gameService.joinGame(joinCode);
      onJoinGame(joinCode);
    } catch (e) {
      alert('Game not found or error joining.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[1fr_400px] gap-12 items-start">
      <div className="space-y-12">
        <div>
          <h2 className="label-micro text-game-accent mb-2">Live Lobbies</h2>
          <h1 className="text-6xl font-black tracking-tighter uppercase italic mb-4">Jump Right In</h1>
          <p className="text-indigo-200/50 font-medium">Join a public game and battle players worldwide.</p>
        </div>

        <div className="grid gap-6">
          {activeGames.length === 0 ? (
            <div className="game-card p-16 text-center text-indigo-300/40 italic font-medium border-dashed">
              No public games right now. Start one yourself!
            </div>
          ) : (
            activeGames.map((game) => (
              <motion.button
                key={game.id}
                whileHover={{ x: 10, scale: 1.02 }}
                onClick={() => {
                   gameService.joinGame(game.id);
                   onJoinGame(game.id);
                }}
                className="bg-white text-game-dark p-8 rounded-3xl flex items-center justify-between group hover:bg-game-accent transition-all text-left shadow-xl shadow-black/10 border-b-8 border-indigo-200 hover:border-yellow-600"
              >
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
                    <Users size={24} className="opacity-30" />
                    Lobby #{game.id.slice(0, 5)}
                  </h3>
                  <p className="label-micro !text-indigo-500/50 mt-1">Status: Waiting for players...</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 group-hover:bg-game-void/10 flex items-center justify-center transition-colors">
                  <ArrowRight className="text-game-dark" />
                </div>
              </motion.button>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-6 pt-8">
          <button
            disabled={loading}
            onClick={() => handleCreate(true)}
            className="flex items-center gap-3 bg-game-pop text-white px-10 py-5 rounded-2xl btn-tactile border-pink-700 shadow-xl shadow-pink-500/20 text-xl font-black uppercase italic"
          >
            <Plus size={24} strokeWidth={3} />
            Create Public Game
          </button>
          
          <button
             disabled={loading}
             onClick={() => handleCreate(false)}
             className="flex items-center gap-3 bg-white/10 text-white px-10 py-5 rounded-2xl btn-tactile border-white/20 hover:bg-white/20 text-xl font-black uppercase italic"
          >
            <Hash size={24} strokeWidth={3} />
            Private Room
          </button>
        </div>
      </div>

      <div className="space-y-8 sticky top-36">
        <div className="bg-game-accent rounded-[40px] p-10 text-game-dark border-b-8 border-yellow-600 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300/30 rounded-full -mr-16 -mt-16" />
          <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3">
            <Hash size={28} strokeWidth={3} />
            Join Code
          </h3>
          
          <div className="space-y-6">
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. XJ28KL"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full bg-white/20 border-2 border-game-dark/10 rounded-2xl px-6 py-5 focus:outline-none focus:border-game-dark/30 transition-colors uppercase tracking-[0.2em] font-black text-2xl placeholder:text-game-dark/30"
              />
            </div>
            
            <button
              disabled={!joinCode || loading}
              onClick={handleJoinByCode}
              className="w-full bg-game-dark text-white py-5 rounded-2xl btn-tactile border-indigo-950 text-xl shadow-lg"
            >
              {loading ? 'Joining...' : 'Enter Arena'}
            </button>
          </div>
        </div>

        <div className="game-card p-10">
          <h4 className="flex items-center gap-3 text-game-accent text-xl font-black uppercase italic italic mb-6">
            <Music size={24} strokeWidth={3} />
            How to play
          </h4>
          <ul className="text-sm text-indigo-100/60 space-y-4 font-medium">
            <li className="flex gap-3">
              <span className="text-game-accent font-black italic">01.</span>
              Wait for the music to stop.
            </li>
            <li className="flex gap-3">
              <span className="text-game-accent font-black italic">02.</span>
              Click a CHAIR as fast as you can.
            </li>
            <li className="flex gap-3">
              <span className="text-game-accent font-black italic">03.</span>
              One person is eliminated per round.
            </li>
            <li className="flex gap-3">
              <span className="text-game-accent font-black italic">04.</span>
              Be the last one seated to WIN!
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
