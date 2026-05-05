import React, { useState } from 'react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ASCENSION_USERS_COLLECTION } from '../collections';

interface ProfileSetupProps {
  uid: string;
  defaultUsername?: string;
  onComplete: () => void;
}

export default function ProfileSetup({ uid, defaultUsername = '', onComplete }: ProfileSetupProps) {
  const [username, setUsername] = useState(defaultUsername);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3 || isLoading) return;

    setIsLoading(true);
    try {
      await setDoc(doc(db, ASCENSION_USERS_COLLECTION, uid), {
        uid,
        username,
        elo: 0,
        rank: 'CHUD',
        wins: 0,
        losses: 0,
        winStreak: 0,
        createdAt: serverTimestamp(),
      });
      onComplete();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,#111_0%,#000_100%)]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full mog-card p-8 space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tighter italic">IDENTITY</h1>
          <p className="text-white/40 text-sm">Choose your moniker before ascending.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-center">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="USERNAME"
              className="w-full bg-white/5 border-b border-white/20 px-4 py-4 text-center text-2xl font-black italic focus:outline-none focus:border-white transition-colors"
              maxLength={20}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={username.length < 3 || isLoading}
            className="mog-button w-full py-4 text-xl"
          >
            {isLoading ? "INITIALIZING..." : "ENTER THE VOID"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
