import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Eye, RotateCw, Scan, CheckCircle2, ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import { performPSLScan, type ScanFrameMetrics } from '../lib/gemini';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ASCENSION_USERS_COLLECTION } from '../collections';

interface VerificationProps {
  uid: string;
  onComplete: () => void;
}

type Step = 'INTRO' | 'BLINK' | 'TURN' | 'SCAN' | 'RESULT';

export default function Verification({ uid, onComplete }: VerificationProps) {
  const [step, setStep] = useState<Step>('INTRO');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pslResult, setPslResult] = useState<{ score: number, breakdown: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Persistence: Initialize camera once
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setCameraError("Camera access is required for verification.");
      }
    };

    if (step !== 'INTRO' && step !== 'RESULT' && !streamRef.current) {
      startCamera();
    }

    return () => {
      // Cleanup only on unmount
    };
  }, [step]);

  // Handle video ref assignment if it was missing 
  useEffect(() => {
    if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  // Automated scanning simulation for Blink and Turn
  useEffect(() => {
    let interval: any;
    if (step === 'BLINK' || step === 'TURN') {
      setScanProgress(0);
      interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            if (step === 'BLINK') setTimeout(() => setStep('TURN'), 500);
            if (step === 'TURN') setTimeout(() => setStep('SCAN'), 500);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [step]);

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

  const handlePslScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const frames: string[] = [];
      const metrics: ScanFrameMetrics[] = [];

      for (let i = 0; i < 5; i += 1) {
        setAnalysisProgress(i * 20);
        const frame = captureFrame();
        frames.push(frame.image);
        metrics.push(frame.metrics);
        await wait(1000);
      }

      setAnalysisProgress(100);
      const result = await performPSLScan(frames[0], metrics);
      setPslResult({ score: result.pslScore, breakdown: result.breakdown });
      
      await updateDoc(doc(db, ASCENSION_USERS_COLLECTION, uid), {
        pslScore: result.pslScore,
        isVerified: true
      });

      // Stop stream on result
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setStep('RESULT');
    } catch (err) {
      console.error(err);
      setCameraError(err instanceof Error ? err.message : 'Unable to complete PSL analysis.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black text-white relative">
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="max-w-md w-full relative z-10">
        <AnimatePresence mode="wait">
          {step === 'INTRO' && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-8"
            >
              <div className="space-y-4">
                <ShieldCheck size={64} className="mx-auto text-white" />
                <h1 className="text-5xl font-black italic tracking-tighter leading-none">VERIFICATION<br/>PROTOCOL</h1>
                <p className="text-white/50 max-w-sm mx-auto">
                  To ensure competitive integrity, we must verify your biological metrics and establish a baseline PSL score.
                </p>
              </div>
              <button 
                onClick={() => setStep('BLINK')} 
                className="mog-button w-full flex items-center justify-center gap-3"
              >
                <Zap size={20} />
                INITIALIZE BIOMETRICS
              </button>
            </motion.div>
          )}

          {(step === 'BLINK' || step === 'TURN' || step === 'SCAN') && (
            <motion.div
              key="active-scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="mog-card overflow-hidden relative shadow-[0_0_80px_rgba(255,255,255,0.05)]">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full aspect-video object-cover transition-all duration-1000 ${step === 'SCAN' ? 'grayscale-0 scale-105' : 'grayscale brightness-50'}`} 
                />
                
                {/* Scanning Overlays */}
                <div className="absolute inset-0 pointer-events-none">
                  {step === 'BLINK' && (
                    <div className="absolute inset-0 border-[20px] border-white/5 flex items-center justify-center">
                       <div className="w-64 h-64 border border-white/20 rounded-full flex items-center justify-center">
                          <motion.div 
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-48 h-48 border border-white/40 rounded-full" 
                          />
                       </div>
                    </div>
                  )}
                  
                  {step === 'TURN' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-full h-full bg-[repeating-linear-gradient(90deg,transparent,transparent_20px,rgba(255,255,255,0.02)_20px,rgba(255,255,255,0.02)_21px)]" />
                       <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10" />
                    </div>
                  )}

                  {isAnalyzing && (
                    <>
                      <motion.div 
                        initial={{ top: 0 }}
                        animate={{ top: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-1 bg-white shadow-[0_0_20px_white] z-20"
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/10">
                        <motion.div
                          animate={{ width: `${analysisProgress}%` }}
                          className="h-full bg-white"
                          transition={{ duration: 0.25 }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Progress Bar */}
                {(step === 'BLINK' || step === 'TURN') && (
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      className="h-full bg-white transition-all duration-300"
                    />
                  </div>
                )}
              </div>

              <div className="text-center space-y-4">
                <div className="flex flex-col items-center gap-2">
                  {step === 'BLINK' && <Eye className="animate-pulse" />}
                  {step === 'TURN' && <RotateCw className="animate-spin-slow" />}
                  {step === 'SCAN' && <Scan />}
                  
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                    {step === 'BLINK' && "Detecting Vitality"}
                    {step === 'TURN' && "Calibrating Geometry"}
                    {step === 'SCAN' && "Extracting Metrics"}
                  </h2>
                </div>

                <p className="text-white/40 text-sm font-mono uppercase tracking-[0.2em]">
                  {step === 'BLINK' && "Please blink twice for liveness confirm."}
                  {step === 'TURN' && "Slowly tilt head 45 degrees left and right."}
                  {step === 'SCAN' && "Maintain neutral expression. Keep still."}
                </p>

                {step === 'SCAN' && (
                  <button 
                    onClick={handlePslScan} 
                    disabled={isAnalyzing}
                    className="mog-button w-full flex items-center justify-center gap-2 group"
                  >
                    {isAnalyzing ? <RefreshCw className="animate-spin" /> : (
                      <>
                        <Zap size={18} />
                        <span>RUN PSL ANALYSIS</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === 'RESULT' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className="space-y-4">
                <CheckCircle2 size={80} className="mx-auto text-white shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                <h1 className="text-6xl font-black italic tracking-tighter leading-none">ANALYSIS<br/>COMPLETE</h1>
                
                <div className="mog-card p-10 space-y-4 bg-gradient-to-b from-white/10 to-transparent">
                   <div className="text-xs text-white/40 uppercase tracking-[0.3em] font-mono">Baseline PSL Rating</div>
                   <div className="text-8xl font-black italic text-white leading-none">
                     {pslResult?.score.toFixed(1)}
                   </div>
                   <p className="text-sm text-white/60 italic px-4 leading-relaxed">
                     "{pslResult?.breakdown}"
                   </p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                 <div className="flex items-center gap-2 justify-center text-white/20 text-[10px] uppercase tracking-[0.2em] font-mono">
                    <ShieldCheck size={12} /> Biometrics Linked to UUID
                 </div>
                 <button onClick={onComplete} className="mog-button w-full py-5 text-2xl tracking-[0.1em]">
                   ASCEND TO HUB
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {cameraError && (
          <div className="mt-8 p-4 bg-red-900/20 border border-red-500/50 text-red-500 text-center rounded-xl space-y-2">
            <div className="font-bold uppercase tracking-widest text-xs">Access Denied</div>
            <p className="text-sm">{cameraError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
