/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useState, type ReactNode } from 'react';
import { Game } from './components/Game';
import { MobileControls } from './components/MobileControls';
import { useGameStore } from './store';
import { useAuth } from '../../context/AuthContext';
import './index.css';

function HUD() {
  const gameState = useGameStore(state => state.gameState);
  const score = useGameStore(state => state.score);
  const wave = useGameStore(state => state.wave);
  const enemiesRemaining = useGameStore(state => state.enemiesRemaining);
  const playerState = useGameStore(state => state.playerState);
  const events = useGameStore(state => state.events);
  const leaveGame = useGameStore(state => state.leaveGame);
  const isMobile = useIsMobile();

  return (
    <>
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
        <div className="relative">
          <div className={`w-6 h-6 border-4 rounded-full ${playerState === 'disabled' ? 'border-red-600' : 'border-yellow-400 opacity-50'}`} />
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${playerState === 'disabled' ? 'bg-red-600' : 'bg-red-500'}`} />
        </div>
        {!isMobile && <div className="mt-4 text-yellow-400 text-[10px] tracking-widest font-black uppercase drop-shadow-md">STOP THE CLOWNS</div>}
      </div>

      {/* HUD Left - Score & Wave Info */}
      <div className="absolute top-2 left-2 md:top-4 md:left-4 flex flex-col gap-1 pointer-events-none">
        <div className="bg-red-600 text-white px-4 py-2 border-2 border-yellow-400 rounded-lg shadow-lg">
          <div className="text-[10px] font-black uppercase leading-none opacity-80">SURVIVAL POINTS</div>
          <div className="text-xl md:text-3xl font-black italic drop-shadow-sm">
            {score.toString().padStart(6, '0')}
          </div>
        </div>
        
        <div className="bg-yellow-400 text-red-700 px-3 py-1 border-2 border-red-600 rounded-md shadow-md mt-2 flex items-center gap-4">
          <div className="text-sm md:text-lg font-black tracking-tighter">
            ACT {wave}
          </div>
          <div className="h-4 w-[2px] bg-red-700/20" />
          <div className="text-[10px] md:text-xs font-black uppercase">
             {enemiesRemaining} CLOWNS LEFT
          </div>
        </div>
      </div>
      
      {/* HUD Right - Leave, Events */}
      <div className="absolute top-2 right-2 md:top-4 md:right-4 flex flex-col items-end gap-1 md:gap-2 pointer-events-auto">
        <button
          onClick={leaveGame}
          className="px-4 py-1 bg-white border-2 border-red-600 text-red-600 text-xs font-black rounded-full hover:bg-red-600 hover:text-white transition-all duration-200"
        >
          QUIT PERFORMANCE
        </button>
        {!isMobile && <div className="text-white/40 text-[10px] mt-1 pointer-events-none uppercase tracking-widest font-medium">ESC for cursor</div>}

        {/* Event Log */}
        <div className="mt-2 md:mt-4 flex flex-col items-end gap-1 pointer-events-none">
          {events.slice(-3).map(event => (
            <div key={event.id} className="text-[10px] font-black text-white bg-red-600/90 px-3 py-1 rounded-sm border-l-4 border-yellow-400 animate-in slide-in-from-right duration-300">
              {event.message.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      {/* Damage Overlay */}
      {playerState === 'disabled' && (
        <div className="absolute inset-0 bg-red-500/20 pointer-events-none flex items-center justify-center">
          <div className="text-red-500 text-4xl md:text-6xl font-black tracking-widest drop-shadow-[0_0_20px_rgba(239,68,68,1)] animate-pulse text-center">
            SYSTEM DISABLED
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && gameState === 'playing' && <MobileControls />}
    </>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const check = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

type MenuView = 'main' | 'settings' | 'leaderboard';

function MenuButton({ children, onClick, variant = 'primary' }: { children: ReactNode; onClick: () => void; variant?: 'primary' | 'secondary' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      className={`w-full px-5 py-3 border-4 text-lg md:text-2xl font-black rounded-lg shadow-xl active:scale-95 transition-all duration-200 ${
        isPrimary
          ? 'bg-red-600 border-white text-white hover:bg-white hover:text-red-600'
          : 'bg-white border-red-600 text-red-600 hover:bg-yellow-300'
      }`}
    >
      {children}
    </button>
  );
}

function MainMenu({ onPlay, onSettings, onLeaderboard }: { onPlay: () => void; onSettings: () => void; onLeaderboard: () => void }) {
  return (
    <>
      <div className="text-center">
        <div className="inline-block bg-white px-4 py-1 border-4 border-red-600 text-red-600 text-xs md:text-sm font-black tracking-[0.35em] uppercase rotate-[-2deg]">
          Tonight Only
        </div>
        <h1 className="mt-4 text-5xl md:text-7xl font-black text-red-600 drop-shadow-[3px_3px_0px_white] tracking-normal italic">
          FUN HOUSE
        </h1>
        <h1 className="text-5xl md:text-7xl font-black text-red-600 drop-shadow-[3px_3px_0px_white] tracking-normal">
          FRENZY
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-2 my-5">
        {['#ef4444', '#facc15', '#2563eb', '#ffffff', '#ef4444', '#facc15'].map((color, index) => (
          <div key={index} className="h-4 border-2 border-red-700" style={{ backgroundColor: color }} />
        ))}
      </div>

      <div className="space-y-3">
        <MenuButton onClick={onPlay}>PLAY</MenuButton>
        <MenuButton onClick={onSettings} variant="secondary">SETTINGS</MenuButton>
        <MenuButton onClick={onLeaderboard} variant="secondary">LEADERBOARD</MenuButton>
      </div>

      <p className="mt-5 text-center text-red-800 text-xs md:text-sm font-black uppercase leading-relaxed">
        Dodge melee clowns. Clear the tent. Climb the scoreboard.
      </p>
    </>
  );
}

function SettingsMenu({ onBack }: { onBack: () => void }) {
  const sensitivity = useGameStore(state => state.sensitivity);
  const playerName = useGameStore(state => state.playerName);
  const setSensitivity = useGameStore(state => state.setSensitivity);

  return (
    <>
      <h2 className="text-4xl md:text-5xl font-black text-red-600 text-center drop-shadow-[2px_2px_0px_white]">
        SETTINGS
      </h2>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="block mb-2 text-red-700 text-xs font-black uppercase tracking-widest">Player Name</span>
          <input
            value={playerName}
            readOnly
            className="w-full px-4 py-3 bg-white/80 border-4 border-red-600 rounded-lg text-red-700 text-lg font-black outline-none"
            maxLength={16}
          />
          <span className="mt-2 block text-[10px] text-red-700 font-black uppercase">
            Uses your website profile name
          </span>
        </label>

        <label className="block">
          <span className="flex justify-between mb-2 text-red-700 text-xs font-black uppercase tracking-widest">
            <span>Mouse Sensitivity</span>
            <span>{sensitivity.toFixed(2)}x</span>
          </span>
          <input
            type="range"
            min="0.25"
            max="2"
            step="0.05"
            value={sensitivity}
            onChange={(event) => setSensitivity(Number(event.target.value))}
            className="w-full accent-red-600"
          />
          <div className="mt-2 flex justify-between text-[10px] text-red-700 font-black uppercase">
            <span>Steady</span>
            <span>Wild</span>
          </div>
        </label>
      </div>

      <div className="mt-6">
        <MenuButton onClick={onBack} variant="secondary">BACK</MenuButton>
      </div>
    </>
  );
}

function LeaderboardMenu({ onBack }: { onBack: () => void }) {
  const highScores = useGameStore(state => state.highScores);

  return (
    <>
      <h2 className="text-4xl md:text-5xl font-black text-red-600 text-center drop-shadow-[2px_2px_0px_white]">
        LEADERBOARD
      </h2>

      <div className="mt-6 bg-red-700 border-4 border-white rounded-lg overflow-hidden">
        {highScores.length === 0 ? (
          <div className="px-4 py-8 text-center text-yellow-300 font-black uppercase">
            No high scores yet
          </div>
        ) : (
          highScores.map((entry, index) => (
            <div key={entry.id} className="grid grid-cols-[2rem_1fr_auto] gap-3 px-3 py-3 border-b-2 border-yellow-400/50 last:border-b-0 text-white font-black items-center">
              <div className="text-yellow-300 text-xl">{index + 1}</div>
              <div className="min-w-0">
                <div className="truncate">{entry.name}</div>
                <div className="text-[10px] text-yellow-200 uppercase">Act {entry.wave} - {entry.date}</div>
              </div>
              <div className="text-yellow-300">{entry.score.toString().padStart(6, '0')}</div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6">
        <MenuButton onClick={onBack} variant="secondary">BACK</MenuButton>
      </div>
    </>
  );
}

export default function App() {
  const { displayName } = useAuth();
  const gameState = useGameStore(state => state.gameState);
  const score = useGameStore(state => state.score);
  const startGame = useGameStore(state => state.startGame);
  const setPlayerName = useGameStore(state => state.setPlayerName);
  const loadHighScores = useGameStore(state => state.loadHighScores);
  const [menuView, setMenuView] = useState<MenuView>('main');

  useEffect(() => {
    if (displayName) {
      setPlayerName(displayName);
    }
  }, [displayName, setPlayerName]);

  useEffect(() => {
    void loadHighScores();
  }, [loadHighScores]);

  return (
    <div className="w-screen h-screen bg-stone-900 relative overflow-hidden font-mono select-none">
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Game />
      </div>

      {/* UI Overlay */}
      {gameState === 'playing' && <HUD />}

      {/* Menus */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-10 pointer-events-auto overflow-hidden bg-red-950">
          <div className="absolute inset-0 opacity-90" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, #b91c1c 0 42px, #facc15 42px 84px, #ffffff 84px 126px, #1d4ed8 126px 168px)',
          }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3),rgba(69,10,10,0.82)_70%)]" />

          <div className="relative h-full flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-yellow-400 p-5 md:p-8 border-8 border-red-600 rounded-lg shadow-[0_0_50px_rgba(220,38,38,0.65)]">
              {menuView === 'main' && (
                <MainMenu
                  onPlay={() => startGame()}
                  onSettings={() => setMenuView('settings')}
                  onLeaderboard={() => setMenuView('leaderboard')}
                />
              )}
              {menuView === 'settings' && <SettingsMenu onBack={() => setMenuView('main')} />}
              {menuView === 'leaderboard' && <LeaderboardMenu onBack={() => setMenuView('main')} />}
            </div>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10 pointer-events-auto">
          <h1 className="text-8xl font-black text-red-600 mb-4 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)] tracking-tighter animate-bounce">
            CURTAINS CLOSED
          </h1>
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="text-4xl text-yellow-400 font-black">
              FINAL SCORE: {score}
            </div>
            <div className="text-2xl text-white font-bold tracking-widest bg-red-600 px-4 py-1 rounded">
              SURVIVED TO WAVE {useGameStore.getState().wave}
            </div>
          </div>
          <button
            id="start-button"
            onClick={() => startGame()}
            className="px-8 py-4 bg-yellow-400 border-4 border-red-600 text-red-600 text-2xl font-black rounded-xl hover:bg-white transition-all duration-200"
          >
            TRY AGAIN?
          </button>
        </div>
      )}
    </div>
  );
}
