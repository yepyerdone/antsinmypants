import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, RefreshCw, RefreshCcw, RotateCcw, Sparkles, Trophy, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { analyzeAscensionImage } from './lib/gemini';
import { getAscensionScores, submitAscensionScore, type AscensionScoreEntry } from './lib/leaderboard';

type Phase = 'ready' | 'camera' | 'analyzing' | 'complete';

export default function TheAscension() {
  const navigate = useNavigate();
  const { displayName, firebaseUser, isGuest } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');
  const [scores, setScores] = useState<AscensionScoreEntry[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);
  const [submitName, setSubmitName] = useState(displayName || 'Player');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadScores = async () => {
    setScoresLoading(true);
    try {
      setScores(await getAscensionScores(10));
    } catch (loadError) {
      console.error('Failed to load The Ascension scores:', loadError);
    } finally {
      setScoresLoading(false);
    }
  };

  useEffect(() => {
    void loadScores();
  }, []);

  useEffect(() => {
    setSubmitName(displayName || 'Player');
  }, [displayName]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = async () => {
    setError('');
    setScore(null);
    setAnalysis('');
    setSubmitted(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPhase('camera');
    } catch (cameraError) {
      console.error('Camera access failed:', cameraError);
      setError('Camera access is needed to play The Ascension.');
      setPhase('ready');
    }
  };

  const captureAndAnalyze = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!video || !canvas || !context) {
      setError('Camera is still warming up. Try again in a second.');
      return;
    }

    setPhase('analyzing');
    setError('');
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 540;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL('image/jpeg', 0.88).split(',')[1] || '';
    const result = await analyzeAscensionImage(base64Image);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    setScore(result.score);
    setAnalysis(result.analysis);
    setPhase('complete');
  };

  const resetRun = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPhase('ready');
    setScore(null);
    setAnalysis('');
    setError('');
    setSubmitted(false);
  };

  const handleSubmitScore = async () => {
    if (!score || score <= 0) return;

    setSubmitting(true);
    setError('');

    try {
      await submitAscensionScore({
        name: submitName,
        score,
        uid: firebaseUser?.uid || null,
      });
      setSubmitted(true);
      await loadScores();
    } catch (submitError) {
      console.error('Failed to submit The Ascension score:', submitError);
      setError(isGuest ? 'Guest score submission needs Firebase anonymous auth to be available.' : 'Score submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="ascension-page">
      <div className="ascension-shell">
        <header className="ascension-header">
          <button type="button" className="ascension-back" onClick={() => navigate('/')}>
            <ArrowLeft size={17} />
            <span>Back to Games</span>
          </button>

          <div className="ascension-title">
            <span>
              <Sparkles size={16} />
              Camera score trial
            </span>
            <h1>The Ascension</h1>
          </div>
        </header>

        <section className="ascension-layout">
          <div className="ascension-arena">
            <div className="ascension-arena__header">
              <div>
                <span>Current run</span>
                <strong>{phase === 'complete' && score ? `${score.toFixed(1)} / 10` : 'Awaiting scan'}</strong>
              </div>
              <Zap size={22} />
            </div>

            <div className="ascension-stage">
              {phase === 'ready' && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ascension-ready">
                  <Trophy size={54} />
                  <h2>Step into the light.</h2>
                  <p>Start a camera run, lock in your frame, and submit the final score to the Ascension leaderboard.</p>
                  <button type="button" onClick={startCamera}>
                    <Camera size={19} />
                    <span>Start Run</span>
                  </button>
                </motion.div>
              )}

              {(phase === 'camera' || phase === 'analyzing') && (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="ascension-video" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="ascension-camera-controls">
                    {phase === 'camera' ? (
                      <button type="button" onClick={captureAndAnalyze}>
                        <Camera size={18} />
                        <span>Capture Score</span>
                      </button>
                    ) : (
                      <div className="ascension-analyzing">
                        <RefreshCcw size={32} />
                        <span>Ranking the run...</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {phase === 'complete' && score && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ascension-result">
                  <span>Evaluation Complete</span>
                  <strong>{score.toFixed(1)}</strong>
                  <p>{analysis}</p>
                  <div className="ascension-result__actions">
                    <button type="button" onClick={resetRun}>
                      <RotateCcw size={17} />
                      <span>Run Again</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {error && <div className="ascension-error">{error}</div>}

            {phase === 'complete' && score && score > 0 && (
              <form
                className="ascension-submit"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmitScore();
                }}
              >
                <label>
                  <span>Leaderboard name</span>
                  <input value={submitName} maxLength={16} onChange={(event) => setSubmitName(event.target.value)} />
                </label>
                <button type="submit" disabled={submitting || submitted || !submitName.trim()}>
                  {submitted ? 'Score Posted' : submitting ? 'Posting...' : 'Submit Score'}
                </button>
              </form>
            )}
          </div>

          <aside className="ascension-panel" aria-label="The Ascension leaderboard">
            <div className="ascension-panel__header">
              <div>
                <span>Top 10</span>
                <h2>Leaderboard</h2>
              </div>
              <button type="button" onClick={() => void loadScores()} aria-label="Refresh leaderboard">
                <RefreshCwIcon />
              </button>
            </div>

            <div className="ascension-score-list">
              {scoresLoading && <div className="ascension-empty">Loading scores...</div>}
              {!scoresLoading && scores.length === 0 && <div className="ascension-empty">No Ascension scores yet.</div>}
              {!scoresLoading &&
                scores.map((entry, index) => (
                  <div key={entry.id} className="ascension-score-row">
                    <span>{index + 1}</span>
                    <strong>{entry.name}</strong>
                    <b>{entry.score.toFixed(1)}</b>
                  </div>
                ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function RefreshCwIcon() {
  return <RefreshCw size={16} />;
}
