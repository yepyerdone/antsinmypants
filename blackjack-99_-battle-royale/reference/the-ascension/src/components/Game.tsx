import { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeFace } from '../lib/gemini';
import { db } from '../lib/firebase';
import { doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Match, UserProfile, calculateEloChange, getRank } from '../types';

interface GameProps {
  matchId: string;
  user: UserProfile;
  onFinish: () => void;
}

export default function Game({ matchId, user, onFinish }: GameProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isPlayer1 = match?.player1Id === user.uid;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'matches', matchId), (snap) => {
      if (snap.exists()) {
        setMatch({ id: snap.id, ...snap.data() } as Match);
      }
    });

    // Setup camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => {
        console.error("Camera error:", err);
        setError("Camera access is required for The Ascension.");
      });

    return () => unsub();
  }, [matchId]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      const result = await analyzeFace(base64);
      
      const updateData: any = {
        updatedAt: serverTimestamp(),
      };

      if (isPlayer1) {
        updateData.player1Score = result.mogScore;
        updateData.player1Analysis = result.analysis;
      } else {
        updateData.player2Score = result.mogScore;
        updateData.player2Analysis = result.analysis;
      }

      await updateDoc(doc(db, 'matches', matchId), updateData);
      setHasSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze facial structure.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Check for winner
  useEffect(() => {
    if (match?.player1Score && match?.player2Score && match.status !== 'finished') {
      const determineWinner = async () => {
        const p1Score = match.player1Score!;
        const p2Score = match.player2Score!;
        let winnerId = null;
        if (p1Score > p2Score) winnerId = match.player1Id;
        else if (p2Score > p1Score) winnerId = match.player2Id;

        await updateDoc(doc(db, 'matches', matchId), {
          status: 'finished',
          winnerId,
          updatedAt: serverTimestamp(),
        });

        // Update ELO for current user
        if (winnerId !== null) {
          const isWinner = winnerId === user.uid;
          const opponentElo = isPlayer1 ? (match.player2Score || 1000) : (match.player1Score || 1000); // Using score as placeholder if elo not synced? No, wait, matches should store ELO of players at start.
          // Let's assume we fetch opponent ELO or it's in the match metadata.
          // For simplicity, I'll update match to include initial ELOs.
        }
      };
      determineWinner();
    }
  }, [match?.player1Score, match?.player2Score]);

  // Handle final elo update once match is finished and we know winner
  useEffect(() => {
    if (match?.status === 'finished' && match.winnerId !== undefined) {
       const updateStats = async () => {
          const isWinner = match.winnerId === user.uid;
          const isDraw = match.winnerId === null;
          
          // We need opponent's initial elo. Let's assume matches collection HAS this.
          // (I will update Matchmaking to include these)
          // For now, let's just do a local update if not already done.
       };
    }
  }, [match?.status]);

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      <div className="text-center">
        <h2 className="text-4xl font-extrabold tracking-tighter mb-2">ASCENDING...</h2>
        <p className="text-white/50">{match?.player1Username} vs {match?.player2Username}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* User View */}
        <div className="mog-card overflow-hidden">
          <div className="p-4 border-bottom border-white/10 flex justify-between items-center">
            <span className="font-bold">{user.username} (You)</span>
            {match && (isPlayer1 ? match.player1Score : match.player2Score) && (
              <span className="px-3 py-1 bg-white text-black font-mono text-sm rounded-full">
                {(isPlayer1 ? match.player1Score : match.player2Score)?.toFixed(1)}
              </span>
            )}
          </div>
          <div className="aspect-video bg-black relative flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale brightness-75 contrast-125" />
            <canvas ref={canvasRef} className="hidden" />
            
            {!hasSubmitted && !isAnalyzing && (
              <button 
                onClick={captureAndAnalyze}
                className="absolute mog-button flex items-center gap-2"
              >
                <Camera size={20} />
                ANALYZE FACE
              </button>
            )}

            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="animate-spin text-white" size={40} />
                <span className="font-bold tracking-widest animate-pulse">EXTRACTING METRICS...</span>
              </div>
            )}
          </div>
          {(isPlayer1 ? match?.player1Analysis : match?.player2Analysis) && (
            <div className="p-4 text-sm text-white/70 italic">
              "{isPlayer1 ? match?.player1Analysis : match?.player2Analysis}"
            </div>
          )}
        </div>

        {/* Opponent View */}
        <div className="mog-card overflow-hidden">
          <div className="p-4 border-bottom border-white/10 flex justify-between items-center">
            <span className="font-bold">{isPlayer1 ? match?.player2Username : match?.player1Username}</span>
            {match && (isPlayer1 ? match.player2Score : match.player1Score) && (
              <span className="px-3 py-1 bg-white/20 text-white font-mono text-sm rounded-full">
                {(isPlayer1 ? match.player2Score : match.player1Score)?.toFixed(1)}
              </span>
            )}
          </div>
          <div className="aspect-video bg-black/50 flex items-center justify-center relative">
             {! (isPlayer1 ? match?.player2Score : match?.player1Score) ? (
                <div className="flex flex-col items-center gap-2 opacity-30 text-center px-4">
                   <Zap size={32} />
                   <span className="text-xs font-mono uppercase tracking-[0.2em]">Opponent is preparing facial metrics...</span>
                </div>
             ) : (
                <div className="flex flex-col items-center gap-4 text-center px-6">
                   <Trophy size={48} className="text-white/20" />
                   <div className="text-3xl font-black italic">METRICS RECEIVED</div>
                   <div className="text-white/50 text-sm">Opponent has submitted for evaluation.</div>
                </div>
             )}
          </div>
          {(isPlayer1 ? match?.player2Analysis : match?.player1Analysis) && (
             <div className="p-4 text-sm text-white/70 italic">
                "{isPlayer1 ? match?.player2Analysis : match?.player1Analysis}"
             </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {match?.status === 'finished' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-xl"
          >
            <div className="max-w-md w-full text-center space-y-8">
               <div className="text-sm font-mono text-white/40 uppercase tracking-[0.3em]">Evaluation Complete</div>
               
               <div className="space-y-2">
                 <div className="text-6xl font-black italic tracking-tighter">
                   {match.winnerId === user.uid ? "ASCENDED" : (match.winnerId === null ? "STALEMATE" : "DEFEATED")}
                 </div>
                 <div className="text-white/50">
                    {match.winnerId === user.uid ? "You are the dominant facial specimen." : "You were mogged."}
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="mog-card p-6">
                     <div className="text-xs text-white/40 mb-1">YOU</div>
                     <div className="text-3xl font-bold">{(isPlayer1 ? match.player1Score : match.player2Score)?.toFixed(1)}</div>
                  </div>
                  <div className="mog-card p-6">
                     <div className="text-xs text-white/40 mb-1">OPPONENT</div>
                     <div className="text-3xl font-bold opacity-50">{(isPlayer1 ? match.player2Score : match.player1Score)?.toFixed(1)}</div>
                  </div>
               </div>

               <button onClick={onFinish} className="mog-button w-full">RETURN TO HUB</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
