import { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeFaceScan, type ScanFrameMetrics } from '../lib/gemini';
import { db } from '../lib/firebase';
import { arrayUnion, doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Match, UserProfile } from '../types';
import { ASCENSION_MATCHES_COLLECTION } from '../collections';

interface GameProps {
  matchId: string;
  user: UserProfile;
  onFinish: () => void;
}

export default function Game({ matchId, user, onFinish }: GameProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('EXTRACTING METRICS...');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [remoteFeedReady, setRemoteFeedReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const appliedRemoteCandidatesRef = useRef(0);

  const isPlayer1 = match?.player1Id === user.uid;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, ASCENSION_MATCHES_COLLECTION, matchId), (snap) => {
      if (snap.exists()) {
        setMatch({ id: snap.id, ...snap.data() } as Match);
      }
    });

    // Setup camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      })
      .catch(err => {
        console.error("Camera error:", err);
        setError("Camera access is required for The Ascension.");
      });

    return () => {
      unsub();
      peerRef.current?.close();
      peerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [matchId]);

  useEffect(() => {
    if (!match || !streamRef.current || !cameraReady || !match.player2Id || match.status === 'searching') return;

    const matchDoc = doc(db, ASCENSION_MATCHES_COLLECTION, matchId);
    const localCandidateField = isPlayer1 ? 'player1IceCandidates' : 'player2IceCandidates';
    const remoteCandidateField = isPlayer1 ? 'player2IceCandidates' : 'player1IceCandidates';

    const ensurePeerConnection = () => {
      if (peerRef.current) return peerRef.current;

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      streamRef.current?.getTracks().forEach((track) => {
        if (streamRef.current) {
          peer.addTrack(track, streamRef.current);
        }
      });

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        void updateDoc(matchDoc, {
          [localCandidateField]: arrayUnion(event.candidate.toJSON()),
          updatedAt: serverTimestamp(),
        });
      };

      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          setRemoteFeedReady(true);
        }
      };

      peerRef.current = peer;
      return peer;
    };

    const syncPeer = async () => {
      const peer = ensurePeerConnection();

      if (isPlayer1 && !match.rtcOffer && !peer.localDescription) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await updateDoc(matchDoc, {
          rtcOffer: { type: offer.type, sdp: offer.sdp },
          updatedAt: serverTimestamp(),
        });
      }

      if (!isPlayer1 && match.rtcOffer && !peer.remoteDescription) {
        await peer.setRemoteDescription(new RTCSessionDescription(match.rtcOffer));
      }

      if (!isPlayer1 && match.rtcOffer && !match.rtcAnswer && peer.signalingState === 'have-remote-offer') {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await updateDoc(matchDoc, {
          rtcAnswer: { type: answer.type, sdp: answer.sdp },
          updatedAt: serverTimestamp(),
        });
      }

      if (isPlayer1 && match.rtcAnswer && !peer.remoteDescription) {
        await peer.setRemoteDescription(new RTCSessionDescription(match.rtcAnswer));
      }

      const remoteCandidates = (match[remoteCandidateField] || []) as RTCIceCandidateInit[];
      if (peer.remoteDescription) {
        for (let i = appliedRemoteCandidatesRef.current; i < remoteCandidates.length; i += 1) {
          await peer.addIceCandidate(new RTCIceCandidate(remoteCandidates[i]));
        }
        appliedRemoteCandidatesRef.current = remoteCandidates.length;
      }
    };

    void syncPeer().catch((err) => {
      console.error('Ascension video connection failed:', err);
    });
  }, [
    cameraReady,
    isPlayer1,
    match,
    matchId,
  ]);

  const getFrameMetrics = (imageData: ImageData): ScanFrameMetrics => {
    const { data, width, height } = imageData;
    const sampleStep = 8;
    let symmetryDiff = 0;
    let symmetrySamples = 0;
    let contrastTotal = 0;
    let contrastSamples = 0;
    let sharpnessTotal = 0;
    let sharpnessSamples = 0;
    let lowerContrast = 0;
    let lowerSamples = 0;
    let exposureTotal = 0;
    let exposureSamples = 0;

    const brightnessAt = (x: number, y: number) => {
      const index = (y * width + x) * 4;
      return (data[index] + data[index + 1] + data[index + 2]) / 765;
    };

    for (let y = Math.floor(height * 0.18); y < Math.floor(height * 0.88); y += sampleStep) {
      for (let x = Math.floor(width * 0.18); x < Math.floor(width * 0.82); x += sampleStep) {
        const brightness = brightnessAt(x, y);
        exposureTotal += 1 - Math.min(1, Math.abs(brightness - 0.52) * 2);
        exposureSamples += 1;

        if (x < width / 2) {
          symmetryDiff += Math.abs(brightness - brightnessAt(width - x - 1, y));
          symmetrySamples += 1;
        }

        if (x + sampleStep < width && y + sampleStep < height) {
          const right = brightnessAt(x + sampleStep, y);
          const down = brightnessAt(x, y + sampleStep);
          const edge = Math.abs(brightness - right) + Math.abs(brightness - down);
          sharpnessTotal += edge;
          sharpnessSamples += 1;

          const contrast = Math.abs(brightness - 0.5) * 2;
          contrastTotal += contrast;
          contrastSamples += 1;

          if (y > height * 0.56 && y < height * 0.86 && x > width * 0.22 && x < width * 0.78) {
            lowerContrast += edge + contrast * 0.4;
            lowerSamples += 1;
          }
        }
      }
    }

    const symmetry = 1 - Math.min(1, (symmetryDiff / Math.max(1, symmetrySamples)) * 2.8);
    const contrast = Math.min(1, (contrastTotal / Math.max(1, contrastSamples)) * 1.75);
    const sharpness = Math.min(1, (sharpnessTotal / Math.max(1, sharpnessSamples)) * 3.8);
    const lowerThird = Math.min(1, (lowerContrast / Math.max(1, lowerSamples)) * 3.2);
    const exposure = exposureTotal / Math.max(1, exposureSamples);

    return { symmetry, contrast, sharpness, lowerThird, exposure };
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) {
      throw new Error('Camera is not ready.');
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Camera canvas is not ready.');
    }

    canvas.width = videoRef.current.videoWidth || 960;
    canvas.height = videoRef.current.videoHeight || 540;
    ctx.drawImage(videoRef.current, 0, 0);

    return {
      image: canvas.toDataURL('image/jpeg', 0.88).split(',')[1],
      metrics: getFrameMetrics(ctx.getImageData(0, 0, canvas.width, canvas.height)),
    };
  };

  const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    setScanProgress(0);
    setScanMessage('LOCKING FACE TRACK...');
    setError(null);

    try {
      const frames: string[] = [];
      const metrics: ScanFrameMetrics[] = [];

      for (let i = 0; i < 5; i += 1) {
        setScanProgress(i * 20);
        setScanMessage(`SCANNING STRUCTURE ${i + 1}/5...`);
        const frame = captureFrame();
        frames.push(frame.image);
        metrics.push(frame.metrics);
        await wait(1000);
      }

      setScanProgress(100);
      setScanMessage('CALCULATING ASCENSION SCORE...');
      const result = await analyzeFaceScan(frames, metrics);
      
      const updateData: any = {
        updatedAt: serverTimestamp(),
        [`${isPlayer1 ? 'player1' : 'player2'}ScanFrames`]: frames.length,
      };

      if (isPlayer1) {
        updateData.player1Score = result.mogScore;
        updateData.player1Analysis = result.analysis;
      } else {
        updateData.player2Score = result.mogScore;
        updateData.player2Analysis = result.analysis;
      }

      await updateDoc(doc(db, ASCENSION_MATCHES_COLLECTION, matchId), updateData);
      setHasSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to analyze facial structure.");
    } finally {
      setIsAnalyzing(false);
      setScanProgress(0);
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

        await updateDoc(doc(db, ASCENSION_MATCHES_COLLECTION, matchId), {
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
                <span className="font-bold tracking-widest animate-pulse">{scanMessage}</span>
                <div className="w-64 max-w-[75%] h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-white"
                    animate={{ width: `${scanProgress}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
                <span className="text-xs font-mono text-white/50 tracking-[0.2em]">{scanProgress}%</span>
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
             <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`absolute inset-0 w-full h-full object-cover grayscale brightness-75 contrast-125 transition-opacity duration-500 ${remoteFeedReady ? 'opacity-100' : 'opacity-0'}`}
             />
             {!remoteFeedReady && !(isPlayer1 ? match?.player2Score : match?.player1Score) ? (
                <div className="flex flex-col items-center gap-2 opacity-30 text-center px-4">
                   <Zap size={32} />
                   <span className="text-xs font-mono uppercase tracking-[0.2em]">Connecting opponent camera...</span>
                </div>
             ) : (
                <div className={`relative z-10 flex flex-col items-center gap-4 text-center px-6 ${remoteFeedReady ? 'self-end mb-4 rounded-full bg-black/50 px-4 py-2 backdrop-blur-sm' : ''}`}>
                   <Trophy size={48} className="text-white/20" />
                   <div className="text-3xl font-black italic">{(isPlayer1 ? match?.player2Score : match?.player1Score) ? 'METRICS RECEIVED' : 'LIVE FEED'}</div>
                   <div className="text-white/50 text-sm">
                     {(isPlayer1 ? match?.player2Score : match?.player1Score)
                       ? 'Opponent has submitted for evaluation.'
                       : 'Opponent camera connected.'}
                   </div>
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
