/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Diamond, MapPin, RefreshCcw, Trophy } from 'lucide-react';
import { Environment } from './components/World/Environment';
import { Player } from './components/World/Player';
import { Chaser } from './components/World/Chaser';
import { LevelManager } from './components/World/LevelManager';
import { Effects } from './components/World/Effects';
import { HUD } from './components/UI/HUD';
import { useStore } from './store';
import { useAuth } from '../../context/AuthContext';
import { addSpaceRunnerScore, getSpaceRunnerScores, SpaceRunnerLeaderboardEntry } from './lib/leaderboard';
import { GameStatus } from './types';

// Dynamic Camera Controller
const CameraController = () => {
  const { camera, size } = useThree();
  const { laneCount } = useStore();
  const shakeIntensity = React.useRef(0);

  React.useEffect(() => {
     const triggerShake = () => {
         shakeIntensity.current = 0.5; // Configurable intensity
     };
     window.addEventListener('player-hit', triggerShake);
     return () => window.removeEventListener('player-hit', triggerShake);
  }, []);
  
  useFrame((state, delta) => {
    // Determine if screen is narrow (mobile portrait)
    const aspect = size.width / size.height;
    const isMobile = aspect < 1.2; // Threshold for "mobile-like" narrowness or square-ish displays

    // Calculate expansion factors
    // Mobile requires backing up significantly more because vertical FOV is fixed in Three.js,
    // meaning horizontal view shrinks as aspect ratio drops.
    // We use more aggressive multipliers for mobile to keep outer lanes in frame.
    const heightFactor = isMobile ? 2.0 : 0.5;
    const distFactor = isMobile ? 4.5 : 1.0;

    // Base (3 lanes): y=5.5, z=8
    // Calculate target based on how many extra lanes we have relative to the start
    const extraLanes = Math.max(0, laneCount - 3);

    const targetY = 5.5 + (extraLanes * heightFactor);
    const targetZ = 8.0 + (extraLanes * distFactor);

    const targetPos = new THREE.Vector3(0, targetY, targetZ);
    
    // Check if shaking
    if (shakeIntensity.current > 0) {
        targetPos.x += (Math.random() - 0.5) * shakeIntensity.current;
        targetPos.y += (Math.random() - 0.5) * shakeIntensity.current;
        shakeIntensity.current -= delta * 1.5; // Dampen shake
        if (shakeIntensity.current < 0) shakeIntensity.current = 0;
    }
    
    // Smoothly interpolate camera position
    camera.position.lerp(targetPos, delta * (shakeIntensity.current > 0 ? 10.0 : 2.0));
    
    // Look further down the track to see the end of lanes
    // Adjust look target slightly based on height to maintain angle
    camera.lookAt(0, 0, -30); 
  });
  
  return null;
};

function Scene() {
  return (
    <>
        <Environment />
        <group>
            {/* Attach a userData to identify player group for LevelManager collision logic */}
            <group userData={{ isPlayer: true }} name="PlayerGroup">
                 <Player />
            </group>
            <Chaser />
            <LevelManager />
        </group>
        <Effects />
    </>
  );
}

function SpaceRunnerLeaderboard() {
  const { displayName } = useAuth();
  const { status, score, distance, gemsCollected } = useStore();
  const [scores, setScores] = useState<SpaceRunnerLeaderboardEntry[]>([]);
  const [name, setName] = useState(displayName || 'Pilot');
  const [submitting, setSubmitting] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finalScore = Math.floor(score);
  const canSubmit = status === GameStatus.GAME_OVER && finalScore > 0 && submittedScore !== finalScore;

  const refreshScores = () => {
    getSpaceRunnerScores(10)
      .then(setScores)
      .catch((err) => {
        console.error('Failed to load Space Racer leaderboard:', err);
        setError('Orbital leaderboard is warming up. Try again in a moment.');
      });
  };

  useEffect(() => {
    refreshScores();
  }, []);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      setSubmittedScore(null);
      setError(null);
    }
  }, [status]);

  const submitScore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await addSpaceRunnerScore(name, finalScore, distance, gemsCollected);
      setSubmittedScore(finalScore);
      refreshScores();
    } catch (err) {
      console.error('Failed to submit Space Racer score:', err);
      setError(err instanceof Error ? err.message : 'Score submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="space-runner-panel">
      <div className="space-runner-panel__header">
        <div>
          <p>Leaderboard</p>
          <h2>Top Pilots</h2>
        </div>
        <Trophy size={22} />
      </div>

      {status === GameStatus.GAME_OVER && (
        <form className="space-runner-submit" onSubmit={submitScore}>
          <div className="space-runner-submit__score">
            <span>Mission Score</span>
            <strong>{finalScore.toLocaleString()}</strong>
          </div>
          <label>
            <span>Pilot Name</span>
            <input value={name} maxLength={16} onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="submit" disabled={!canSubmit || submitting}>
            {submittedScore === finalScore ? 'Score Saved' : submitting ? 'Saving...' : 'Submit Score'}
          </button>
        </form>
      )}

      {error && <p className="space-runner-error">{error}</p>}

      <div className="space-runner-list">
        {scores.length === 0 ? (
          <div className="space-runner-empty">No scores yet. Claim the first orbit.</div>
        ) : (
          scores.map((entry, index) => (
            <div key={entry.id} className="space-runner-score-row">
              <span className="space-runner-rank">{index + 1}</span>
              <div>
                <strong>{entry.name}</strong>
                <small>
                  <MapPin size={12} />
                  {Math.floor(entry.distance).toLocaleString()}m
                  <Diamond size={12} />
                  {entry.gems}
                </small>
              </div>
              <b>{Math.floor(entry.score).toLocaleString()}</b>
            </div>
          ))
        )}
      </div>

      <button type="button" className="space-runner-refresh" onClick={refreshScores}>
        <RefreshCcw size={14} />
        Refresh Scores
      </button>
    </aside>
  );
}

function SpaceRunner() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Space Racer | The Honor Roll';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="space-runner-page">
      <header className="space-runner-header">
        <div>
          <p>Orbital arcade runner</p>
          <h1>Space Racer</h1>
        </div>
      </header>

      <main className="space-runner-layout">
        <section className="space-runner-stage" aria-label="Space Racer game">
          <HUD />
          <Canvas
            shadows
            dpr={[1, 1.5]}
            gl={{ antialias: false, stencil: false, depth: true, powerPreference: 'high-performance' }}
            camera={{ position: [0, 5.5, 8], fov: 60 }}
          >
            <CameraController />
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        </section>

        <SpaceRunnerLeaderboard />
      </main>
    </div>
  );
}

export default SpaceRunner;
