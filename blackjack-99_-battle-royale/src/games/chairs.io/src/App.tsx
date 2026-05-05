/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { auth, signIn, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LandingPage } from './components/LandingPage';
import { GameSession } from './components/GameSession';
import { LogOut, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Music size={48} className="text-orange-500" />
          </motion.div>
          <p className="text-sm tracking-widest uppercase opacity-50">Chairs.io</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-game-bg text-white font-sans selection:bg-game-accent selection:text-game-void overflow-x-hidden">
      <header className="fixed top-0 left-0 w-full p-8 flex justify-between items-center z-50 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="w-12 h-12 bg-game-accent rounded-xl border-b-4 border-yellow-600 flex items-center justify-center">
            <Music className="text-game-void" size={24} strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">Chairs.io</h1>
            <p className="label-micro !text-indigo-200">The Ultimate Battle</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-4 pointer-events-auto bg-game-void/80 backdrop-blur-xl px-6 py-3 rounded-2xl border-2 border-indigo-400/30 shadow-2xl">
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <img src={user.photoURL} className="w-8 h-8 rounded-full border-2 border-game-accent" alt="" referrerPolicy="no-referrer" />
              )}
              <span className="text-sm font-black uppercase italic tracking-tight">{user.displayName}</span>
            </div>
            <button 
              onClick={() => signOut()}
              className="p-2 hover:text-game-pop transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={18} strokeWidth={3} />
            </button>
          </div>
        )}
      </header>

      <main className="pt-32 pb-24 min-h-screen">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto p-12 text-center game-card"
            >
              <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-4">Ready to Play?</h1>
              <p className="text-indigo-200/60 mb-8 font-medium">One set of chairs. One crown. Don't be the last one standing without a seat.</p>
              <button
                onClick={signIn}
                className="w-full bg-game-pop text-white py-5 rounded-2xl btn-tactile border-pink-700 shadow-xl shadow-pink-500/20 text-xl"
              >
                Sign in with Google
              </button>
            </motion.div>
          ) : !currentGameId ? (
            <LandingPage key="landing" onJoinGame={(id) => setCurrentGameId(id)} />
          ) : (
            <GameSession key="game" gameId={currentGameId} onExit={() => setCurrentGameId(null)} />
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 w-full p-8 flex justify-between items-center pointer-events-none">
        <div className="flex gap-4 pointer-events-auto">
          <div className="bg-game-dark/60 backdrop-blur-md px-5 py-2 rounded-xl border border-white/5 flex items-center gap-3 shadow-lg">
            <div className="w-2 h-2 bg-game-success rounded-full animate-pulse shadow-[0_0_10px_#34d399]" />
            <span className="text-xs font-black uppercase italic tracking-widest text-indigo-200">System Online</span>
          </div>
        </div>
        <p className="text-indigo-300/60 font-black text-[10px] tracking-[0.3em] uppercase italic">
          BATTLE ROYALE <span className="text-white">v2.04</span>
        </p>
      </footer>
    </div>
  );
}
