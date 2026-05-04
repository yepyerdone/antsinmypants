import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import Game from './components/Game';
import HistoryView from './components/HistoryView';
import Settings from './components/Settings';
import { auth } from './lib/firebase';

export default function App() {
  const [currentLobbyId, setCurrentLobbyId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'history' | 'settings'>('home');
  const [preSelectedGame, setPreSelectedGame] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(() => {
      setInitializing(false);
    });
    return unsub;
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (currentLobbyId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Game lobbyId={currentLobbyId} onExit={() => setCurrentLobbyId(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {view === 'history' ? (
        <HistoryView 
          initialGame={preSelectedGame}
          onBack={() => {
            setView('home');
            setPreSelectedGame(null);
          }} 
        />
      ) : view === 'settings' ? (
        <Settings onBack={() => setView('home')} />
      ) : (
        <Home 
          onJoinLobby={(id) => setCurrentLobbyId(id)} 
          onShowHistory={(game) => {
            if (game) setPreSelectedGame(game);
            setView('history');
          }} 
          onShowSettings={() => setView('settings')}
        />
      )}
    </div>
  );
}
