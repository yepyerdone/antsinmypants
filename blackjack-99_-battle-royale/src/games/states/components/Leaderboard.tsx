import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medal } from 'lucide-react';

interface LeaderboardEntry {
  playerName: string;
  timeSeconds: number;
}

export default function Leaderboard() {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScores() {
      try {
        const q = query(collection(db, 'states_leaderboard'), orderBy('timeSeconds', 'asc'), limit(10));
        const querySnapshot = await getDocs(q);
        const fetchedScores = querySnapshot.docs.map(doc => doc.data() as LeaderboardEntry);
        setScores(fetchedScores);
      } catch (error) {
        console.error('Error fetching scores:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchScores();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 rounded-3xl shadow-xl shadow-indigo-950/50 border border-slate-800 overflow-hidden">
      <div className="px-8 py-6 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Medal className="h-5 w-5 text-amber-500" />
          Global Leaderboard
        </h2>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Fastest Times</span>
      </div>
      
      <div className="divide-y divide-slate-800/50">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium tracking-tight">Loading speeds...</div>
        ) : scores.length === 0 ? (
          <div className="p-8 text-center text-slate-500 italic font-medium">No records yet. Be the first!</div>
        ) : (
          scores.map((score, index) => (
            <div key={index} className="px-8 py-4 flex items-center justify-between group hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${
                  index === 0 ? 'bg-amber-500/20 text-amber-500' :
                  index === 1 ? 'bg-slate-500/20 text-slate-300' :
                  index === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  {index + 1}
                </span>
                <span className="font-semibold text-slate-200">{score.playerName}</span>
              </div>
              <span className="font-mono text-indigo-400 font-bold">{formatTime(score.timeSeconds)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
