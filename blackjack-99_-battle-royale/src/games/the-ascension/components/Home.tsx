import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Trophy, Users, Zap, ShieldAlert, RefreshCw } from 'lucide-react';
import { ASCENSION_MATCHES_COLLECTION, ASCENSION_USERS_COLLECTION } from '../collections';

interface HomeProps {
  user: UserProfile;
  onPlay: (matchId: string) => void;
}

export default function Home({ user, onPlay }: HomeProps) {
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [isFindingMatch, setIsFindingMatch] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'HUB' | 'LEADERBOARD'>('HUB');

  useEffect(() => {
    const q = query(collection(db, ASCENSION_USERS_COLLECTION), orderBy('elo', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const users: UserProfile[] = [];
      snap.forEach(doc => users.push(doc.data() as UserProfile));
      setLeaderboard(users);
    });
    return () => unsub();
  }, []);

  const findMatch = async () => {
    setIsFindingMatch(true);
    setMatchError(null);

    try {
      const q = query(
        collection(db, ASCENSION_MATCHES_COLLECTION), 
        where('status', '==', 'searching'),
        limit(1)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const matchDoc = snap.docs[0];
        const matchData = matchDoc.data();

        if (matchData.player1Id === user.uid) {
           onPlay(matchDoc.id);
           return;
        }

        await updateDoc(doc(db, ASCENSION_MATCHES_COLLECTION, matchDoc.id), {
          player2Id: user.uid,
          player2Username: user.username,
          player2Elo: user.elo,
          status: 'in_progress',
          updatedAt: serverTimestamp()
        });
        onPlay(matchDoc.id);
      } else {
        const newMatch = await addDoc(collection(db, ASCENSION_MATCHES_COLLECTION), {
          player1Id: user.uid,
          player1Username: user.username,
          player1Elo: user.elo,
          status: 'searching',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        const unsub = onSnapshot(doc(db, ASCENSION_MATCHES_COLLECTION, newMatch.id), (snap) => {
          const data = snap.data();
          if (data?.status === 'in_progress') {
            unsub();
            onPlay(newMatch.id);
          }
        });
      }
    } catch (err) {
      console.error(err);
      setMatchError("Matchmaking failed.");
      setIsFindingMatch(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative pt-20 pb-12 px-6 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 space-y-6"
        >
          <div className="space-y-4">
            <h1 className="text-8xl md:text-9xl font-black italic tracking-tighter leading-none select-none">
              THE<br/>ASCENSION
            </h1>
            <div className="flex items-center justify-center gap-4 text-white/30 font-mono tracking-[0.4em] uppercase text-xs md:text-sm">
              <div className="h-[1px] w-12 bg-white/10" />
              Genetic Specimen Evaluation Hub
              <div className="h-[1px] w-12 bg-white/10" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => setActiveTab('HUB')}
              className={`px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'HUB' ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              DASHBOARD
            </button>
            <button 
              onClick={() => setActiveTab('LEADERBOARD')}
              className={`px-8 py-3 rounded-full font-bold transition-all ${activeTab === 'LEADERBOARD' ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              LEADERBOARD
            </button>
          </div>
        </motion.div>
      </div>

      <main className="max-w-6xl mx-auto p-6 pb-20">
        <AnimatePresence mode="wait">
          {activeTab === 'HUB' ? (
            <motion.div 
              key="hub"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-8"
            >
              {/* Profile Card */}
              <div className="md:col-span-7 space-y-8">
                <div className="mog-card p-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap size={120} />
                  </div>
                  
                  <div className="relative z-10 space-y-8">
                    <div className="space-y-1">
                       <p className="text-white/40 font-mono text-xs uppercase tracking-[0.2em]">{user.rank} TIER SPECIMEN</p>
                       <h2 className="text-6xl font-black italic tracking-tighter leading-none">{user.username}</h2>
                    </div>

                    <div className="flex items-end gap-12">
                      <div className="space-y-1">
                        <p className="text-white/30 text-[10px] font-mono tracking-widest uppercase">Metric Score</p>
                        <p className="text-4xl font-bold font-mono">{user.elo}</p>
                      </div>
                      {user.pslScore && (
                        <div className="space-y-1">
                          <p className="text-white/30 text-[10px] font-mono tracking-widest uppercase">Base PSL</p>
                          <p className="text-4xl font-bold font-mono text-white/60">{user.pslScore.toFixed(1)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button 
                        onClick={findMatch}
                        disabled={isFindingMatch}
                        className="mog-button flex-1 py-5 text-xl flex items-center justify-center gap-3 relative overflow-hidden"
                      >
                         {isFindingMatch ? (
                            <RefreshCw className="animate-spin" />
                         ) : (
                           <>
                             <Zap size={20} />
                             ENTER ASCENSION
                           </>
                         )}
                      </button>
                      <button 
                         onClick={() => updateDoc(doc(db, ASCENSION_USERS_COLLECTION, user.uid), { isVerified: false })}
                         className="px-8 py-5 bg-white/5 border border-white/10 rounded-full font-bold hover:bg-white/10 transition-all text-sm uppercase tracking-widest"
                      >
                        RE-CALIBRATE
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="mog-card p-6 flex flex-col items-center justify-center text-center">
                      <div className="text-xs text-white/30 font-mono mb-1 uppercase">Victories</div>
                      <div className="text-4xl font-black italic">{user.wins}</div>
                   </div>
                   <div className="mog-card p-6 flex flex-col items-center justify-center text-center">
                      <div className="text-xs text-white/30 font-mono mb-1 uppercase">Defeats</div>
                      <div className="text-4xl font-black italic opacity-40">{user.losses}</div>
                   </div>
                </div>
              </div>

              {/* Tiers Card */}
              <div className="md:col-span-5 space-y-6">
                 <div className="flex items-center gap-3 text-white/50 text-sm font-bold uppercase tracking-widest px-2">
                    <Trophy size={16} />
                    Rank Boundaries
                 </div>
                 <div className="mog-card p-8 space-y-4">
                    <RankTier label="CHAD" range="1500+" color="text-white font-black" active={user.rank === 'CHAD'} />
                    <RankTier label="CHADLITE" range="1000-1500" color="text-white font-bold" active={user.rank === 'CHADLITE'} />
                    <RankTier label="HTN" range="750-1000" color="text-white/80" active={user.rank === 'HTN'} />
                    <RankTier label="MTN" range="500-750" color="text-white/60" active={user.rank === 'MTN'} />
                    <RankTier label="LTN" range="200-500" color="text-white/40" active={user.rank === 'LTN'} />
                    <RankTier label="CHUD" range="0-200" color="text-white/20" active={user.rank === 'CHUD'} />
                 </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="mog-card overflow-hidden">
                <div className="grid grid-cols-[60px_1fr_100px_80px_100px] p-6 bg-white/5 border-b border-white/10 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
                  <span>Index</span>
                  <span>Specimen</span>
                  <span>Tier</span>
                  <span className="text-right">PSL</span>
                  <span className="text-right">Metric</span>
                </div>
                <div className="divide-y divide-white/5">
                  {leaderboard.map((player, i) => (
                    <div 
                      key={player.uid} 
                      className={`grid grid-cols-[60px_1fr_100px_80px_100px] p-6 items-center transition-colors hover:bg-white/[0.02] ${player.uid === user.uid ? 'bg-white/[0.07] border-y border-white/10' : ''}`}
                    >
                      <span className="font-mono text-white/20 text-sm">{(i + 1).toString().padStart(2, '0')}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{player.username}</span>
                        {player.uid === user.uid && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      </div>
                      <span className="text-[10px] font-mono opacity-50 px-2 py-0.5 bg-white/5 rounded border border-white/5 inline-block w-fit">{player.rank}</span>
                      <span className="text-right font-mono text-white/40">{player.pslScore?.toFixed(1) || '-'}</span>
                      <span className="text-right font-mono font-bold text-xl">{player.elo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {matchError && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-full font-bold shadow-[0_0_40px_rgba(220,38,38,0.3)] animate-bounce z-50">
          {matchError}
        </div>
      )}
    </div>
  );
}

function RankTier({ label, range, color, active }: { label: string, range: string, color: string, active?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-3 px-4 rounded-xl transition-all ${active ? 'bg-white/10 border border-white/20' : 'border-b border-white/5 last:border-0'}`}>
      <div className="flex items-center gap-3">
        {active && <div className="w-1 h-1 rounded-full bg-white" />}
        <span className={`${color} ${active ? 'tracking-widest' : ''}`}>{label}</span>
      </div>
      <span className="font-mono text-[10px] opacity-40">{range}</span>
    </div>
  )
}
