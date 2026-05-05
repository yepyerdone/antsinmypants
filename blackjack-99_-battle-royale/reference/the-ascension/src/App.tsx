import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle } from './lib/firebase';
import { UserProfile, getRank, calculateEloChange } from './types';
import ProfileSetup from './components/ProfileSetup';
import Verification from './components/Verification';
import Home from './components/Home';
import Game from './components/Game';
import { RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubProfile();
  }, [user]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      setIsLoggingIn(false);
    }
  };

  const handleMatchFinish = async () => {
    if (!activeMatchId || !profile || !user) return;

    // The game component handles the winnerId calc, but let's do ELO here 
    // to ensure it happens with the latest profile state
    setActiveMatchId(null);
  };

  // ELO Sync logic - This is a bit tricky in client-only.
  // We'll listen for match finished and if we haven't updated our stats for THIS match, do it.
  useEffect(() => {
     if (!activeMatchId || !profile) return;
     
     const unsubMatch = onSnapshot(doc(db, 'matches', activeMatchId), async (snap) => {
        const match = snap.data();
        if (match?.status === 'finished' && match.winnerId !== undefined) {
           // We need to check if we already processed this match.
           // For simplicity in a demo, we'll just check if updatedAt is very recent 
           // and we are currently in the match.
           // Better: Add a 'processedPlayers' array to match.
           const processed = match.processedPlayers || [];
           if (!processed.includes(user?.uid)) {
              const isWinner = match.winnerId === user?.uid;
              const isDraw = match.winnerId === null;
              
              const myElo = profile.elo;
              const opponentElo = match.player1Id === user?.uid ? match.player2Elo : match.player1Elo;
              
              const eloChange = calculateEloChange(myElo, opponentElo, isWinner);
              // If draw, we could do 0 or partial. Let's do 0 for now.
              const finalChange = isDraw ? 0 : eloChange;
              
              const newElo = myElo + finalChange;
              const newRank = getRank(newElo);
              
              await updateDoc(doc(db, 'users', user!.uid), {
                 elo: newElo,
                 rank: newRank,
                 wins: profile.wins + (isWinner ? 1 : 0),
                 losses: profile.losses + (!isWinner && !isDraw ? 1 : 0),
              });

              await updateDoc(doc(db, 'matches', activeMatchId), {
                 processedPlayers: [...processed, user?.uid]
              });
           }
        }
     });
     return () => unsubMatch();
  }, [activeMatchId, profile?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <RefreshCw className="animate-spin text-white/20" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-lg w-full text-center space-y-12"
        >
          <div className="space-y-4">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="inline-block"
            >
              <Zap size={64} className="mx-auto text-white" />
            </motion.div>
            <h1 className="text-7xl font-black italic tracking-tighter leading-none">THE<br/>ASCENSION</h1>
            <p className="text-white/40 font-mono tracking-[0.2em] text-sm uppercase">Facial Dominance Authority</p>
          </div>

          <p className="text-white/60 text-lg leading-relaxed">
            Determine your genetic status. Match with specimens globally. Extract metrics. Ascend.
          </p>

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="mog-button w-full py-6 text-2xl flex items-center justify-center gap-4 group"
          >
            {isLoggingIn ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <>
                <span>BEGIN EVALUATION</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  →
                </motion.span>
              </>
            )}
          </button>

          <div className="pt-12 flex justify-center gap-8 opacity-20 font-mono text-[10px] tracking-widest uppercase">
            <span>Biometric Link Active</span>
            <span>v1.0.42</span>
            <span>Cloud Sync: Ready</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    return <ProfileSetup uid={user.uid} onComplete={() => {}} />;
  }

  if (!profile.isVerified) {
    return <Verification uid={user.uid} onComplete={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <AnimatePresence mode="wait">
        {activeMatchId ? (
          <motion.div
            key="game"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Game 
              matchId={activeMatchId} 
              user={profile} 
              onFinish={handleMatchFinish} 
            />
          </motion.div>
        ) : (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <Home 
              user={profile} 
              onPlay={(id) => setActiveMatchId(id)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
