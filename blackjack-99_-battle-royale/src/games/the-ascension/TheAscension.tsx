import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from './lib/firebase';
import { ASCENSION_MATCHES_COLLECTION, ASCENSION_USERS_COLLECTION } from './collections';
import { UserProfile, getRank, calculateAscensionEloChange } from './types';
import ProfileSetup from './components/ProfileSetup';
import Verification from './components/Verification';
import Home from './components/Home';
import Game from './components/Game';

export default function TheAscension() {
  const navigate = useNavigate();
  const { firebaseUser, displayName } = useAuth();
  const [user, setUser] = useState<User | null>(firebaseUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [nextBattleSearching, setNextBattleSearching] = useState(false);

  useEffect(() => {
    setUser(firebaseUser);
    if (!firebaseUser) {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, ASCENSION_USERS_COLLECTION, user.uid), (snap) => {
      if (snap.exists()) {
        const nextProfile = snap.data() as UserProfile;
        setProfile(nextProfile);

        if (nextProfile.winStreak === undefined) {
          void updateDoc(doc(db, ASCENSION_USERS_COLLECTION, user.uid), {
            elo: 0,
            rank: 'CHUD',
            winStreak: 0,
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubProfile();
  }, [user]);

  const handleMatchFinish = async () => {
    if (!activeMatchId || !profile || !user) return;
    setActiveMatchId(null);
    setNextBattleSearching(false);
  };

  const findNextBattle = async () => {
    if (!profile || !user) return;

    setNextBattleSearching(true);

    const openMatches = query(
      collection(db, ASCENSION_MATCHES_COLLECTION),
      where('status', '==', 'searching'),
      limit(1)
    );
    const snap = await getDocs(openMatches);

    if (!snap.empty) {
      const matchDoc = snap.docs[0];
      const matchData = matchDoc.data();

      if (matchData.player1Id === user.uid) {
        setNextBattleSearching(false);
        setActiveMatchId(matchDoc.id);
        return;
      }

      await updateDoc(doc(db, ASCENSION_MATCHES_COLLECTION, matchDoc.id), {
        player2Id: user.uid,
        player2Username: profile.username,
        player2Elo: profile.elo,
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
      setNextBattleSearching(false);
      setActiveMatchId(matchDoc.id);
      return;
    }

    const newMatch = await addDoc(collection(db, ASCENSION_MATCHES_COLLECTION), {
      player1Id: user.uid,
      player1Username: profile.username,
      player1Elo: profile.elo,
      status: 'searching',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const unsub = onSnapshot(doc(db, ASCENSION_MATCHES_COLLECTION, newMatch.id), (matchSnap) => {
      if (matchSnap.data()?.status === 'in_progress') {
        unsub();
        setNextBattleSearching(false);
        setActiveMatchId(newMatch.id);
      }
    });
  };

  useEffect(() => {
    if (!activeMatchId || !user) return;

    const unsubMatch = onSnapshot(doc(db, ASCENSION_MATCHES_COLLECTION, activeMatchId), async (snap) => {
      const match = snap.data();
      if (match?.status === 'finished' && match.winnerId !== undefined) {
        const matchRef = doc(db, ASCENSION_MATCHES_COLLECTION, activeMatchId);
        const userRef = doc(db, ASCENSION_USERS_COLLECTION, user.uid);

        await runTransaction(db, async (transaction) => {
          const [matchSnap, userSnap] = await Promise.all([transaction.get(matchRef), transaction.get(userRef)]);
          const latestMatch = matchSnap.data();
          const latestProfile = userSnap.data() as UserProfile | undefined;

          if (!latestMatch || !latestProfile || latestMatch.status !== 'finished' || latestMatch.winnerId === undefined) {
            return;
          }

          const processed = latestMatch.processedPlayers || [];
          if (processed.includes(user.uid)) {
            return;
          }

          const isWinner = latestMatch.winnerId === user.uid;
          const isDraw = latestMatch.winnerId === null;
          const currentWinStreak = latestProfile.winStreak || 0;
          const finalChange = isDraw ? 0 : calculateAscensionEloChange(isWinner, currentWinStreak);
          const newElo = latestProfile.elo + finalChange;
          const nextWinStreak = isDraw ? currentWinStreak : isWinner ? currentWinStreak + 1 : 0;

          transaction.update(userRef, {
            elo: newElo,
            rank: getRank(newElo),
            wins: latestProfile.wins + (isWinner ? 1 : 0),
            losses: latestProfile.losses + (!isWinner && !isDraw ? 1 : 0),
            winStreak: nextWinStreak,
          });

          transaction.update(matchRef, {
            processedPlayers: [...processed, user.uid],
          });
        });
      }
    });

    return () => unsubMatch();
  }, [activeMatchId, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <RefreshCw className="animate-spin text-white/20" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 z-[80] bg-white text-black px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest flex items-center gap-2"
      >
        <ArrowLeft size={15} />
        Back to Games
      </button>

      {!user ? (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="mog-card max-w-md p-8 space-y-4">
            <h1 className="text-5xl font-black italic tracking-tighter">THE ASCENSION</h1>
            <p className="text-white/50">Sign in from the arcade home screen to begin evaluation.</p>
          </div>
        </div>
      ) : !profile ? (
        <ProfileSetup uid={user.uid} defaultUsername={displayName} onComplete={() => {}} />
      ) : !profile.isVerified ? (
        <Verification uid={user.uid} onComplete={() => {}} />
      ) : (
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
                onNextBattle={findNextBattle}
                nextBattleSearching={nextBattleSearching}
              />
            </motion.div>
          ) : (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Home user={profile} onPlay={(id) => setActiveMatchId(id)} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
