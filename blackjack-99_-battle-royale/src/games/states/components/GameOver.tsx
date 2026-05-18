import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, RefreshCw, Send, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

interface GameOverProps {
  time: number;
  onRestart: () => void;
  onClose: () => void;
  isVictory: boolean;
}

export default function GameOver({ time, onRestart, onClose, isVictory }: GameOverProps) {
  const { displayName, isGuest, uid } = useAuth();
  const [playerName, setPlayerName] = useState(displayName);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isVictory || isGuest || !playerName.trim() || submitting || submitted) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'states_leaderboard'), {
        playerName: playerName.trim(),
        playerId: uid,
        timeSeconds: time,
        statesGuessed: 50,
        completedAt: serverTimestamp()
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting score:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-lg border border-slate-800 relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors border border-white/20"
        >
          <X className="h-6 w-6" /> 
        </button>

        <div className="bg-indigo-600 px-8 py-12 text-center text-white relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-amber-500 rounded-full border-8 border-slate-900 shadow-lg">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-4xl font-black mb-2 tracking-tight">{isVictory ? 'MISSION COMPLETE!' : 'GAME OVER'}</h2>
          <p className="text-indigo-100 text-lg opacity-80">{isVictory ? "You've successfully mapped the US." : "The mission was abandoned."}</p>
          <div className="mt-8 flex justify-center items-baseline gap-2">
            <span className="text-sm font-bold uppercase tracking-widest opacity-60">Final Time:</span>
            <span className="text-5xl font-mono font-black">{formatTime(time)}</span>
          </div>
        </div>

        <div className="p-10 space-y-8">
          {isVictory && isGuest ? (
            <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 text-center">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                Create an account to submit leaderboard times.
              </p>
            </div>
          ) : isVictory && !submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider text-center">
                Submit to Global Leaderboard
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  maxLength={32}
                  disabled={submitting}
                  className="flex-1 px-5 py-4 border-2 border-slate-800 rounded-2xl bg-slate-950 focus:outline-none focus:border-indigo-500 font-bold text-white transition-colors placeholder:text-slate-700"
                  placeholder="Enter your name..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={submitting || !playerName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-4 rounded-2xl font-bold transition-all flex items-center gap-2"
                >
                  {submitting ? '...' : <Send className="h-5 w-5" />}
                </button>
              </div>
            </form>
          ) : isVictory ? (
            <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 flex items-center gap-4 text-emerald-400 font-bold justify-center">
              Score submitted successfully!
            </div>
          ) : (
            <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 text-center">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                Finish all 50 states to submit a leaderboard time.
              </p>
            </div>
          )}

          <div className="pt-4 flex justify-center gap-4">
            <button
              onClick={onRestart}
              className="flex-1 bg-white hover:bg-slate-100 text-slate-900 font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <RefreshCw className="h-6 w-6" />
              PLAY AGAIN
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
